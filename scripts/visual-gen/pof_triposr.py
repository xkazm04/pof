"""PoF TripoSR inference — minimal image->mesh entry point for the zero-budget local
3D pipeline. Deliberately avoids TripoSR's run.py (which imports xatlas/moderngl for
texture-baking/rendering we don't need). Loads the model on the GPU, removes the
background, runs the NeRF, extracts a mesh (marching cubes — patched to scikit-image),
and exports .obj/.glb. Emits POF_TRIPOSR_DONE=<path> on success, POF_TRIPOSR_ERROR=<e>
on failure, so the TS runner can parse the result from stdout.

Invoked by src/lib/visual-gen/triposr-runner.ts via the TripoSR venv python:
  <triposr>/.venv/Scripts/python.exe scripts/visual-gen/pof_triposr.py \
    --image in.png --output out/mesh.glb --triposr-root <triposr>
"""
import argparse
import os
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True, help="input image path")
    ap.add_argument("--output", required=True, help="full output mesh path (.obj/.glb)")
    ap.add_argument("--triposr-root", required=True, help="dir containing the `tsr` package")
    ap.add_argument("--device", default="cuda:0")
    ap.add_argument("--mc-resolution", type=int, default=256)
    ap.add_argument("--chunk-size", type=int, default=8192)
    ap.add_argument("--no-remove-bg", action="store_true")
    ap.add_argument("--foreground-ratio", type=float, default=0.85)
    ap.add_argument("--model", default="stabilityai/TripoSR")
    ap.add_argument("--fidelity", action="store_true", help="render NeRF views + CLIP-compare to the input image")
    ap.add_argument("--fidelity-views", type=int, default=4)
    args = ap.parse_args()

    sys.path.insert(0, args.triposr_root)
    try:
        import numpy as np
        import torch
        from PIL import Image
        from tsr.system import TSR
        from tsr.utils import remove_background, resize_foreground

        device = args.device if torch.cuda.is_available() else "cpu"
        print(f"POF_TRIPOSR_DEVICE={device}")

        model = TSR.from_pretrained(args.model, config_name="config.yaml", weight_name="model.ckpt")
        model.renderer.set_chunk_size(args.chunk_size)
        model.to(device)

        if args.no_remove_bg:
            image = np.array(Image.open(args.image).convert("RGB"))
        else:
            import rembg
            session = rembg.new_session()
            img = remove_background(Image.open(args.image), session)
            img = resize_foreground(img, args.foreground_ratio)
            arr = np.array(img).astype(np.float32) / 255.0
            arr = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
            image = Image.fromarray((arr * 255.0).astype(np.uint8))

        with torch.no_grad():
            scene_codes = model([image], device=device)
        meshes = model.extract_mesh(scene_codes, True, resolution=args.mc_resolution)

        out = args.output
        os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
        meshes[0].export(out)
        print(f"POF_TRIPOSR_VERTS={len(meshes[0].vertices)}")
        print(f"POF_TRIPOSR_FACES={len(meshes[0].faces)}")

        # Tier-2 fidelity (free, local): render the generated object from a few views via
        # the NeRF (torch/GPU, no moderngl) and CLIP-compare each to the input reference.
        # Max cosine similarity over views = "does the 3D look like the 2D input". The first
        # render is saved as a preview thumbnail (also feeds a later local VLM).
        if args.fidelity:
            try:
                from transformers import CLIPModel, CLIPProcessor
                clip_input = image if isinstance(image, Image.Image) else Image.fromarray(image)
                renders = model.render(scene_codes, n_views=args.fidelity_views, return_type="pil")[0]
                preview = os.path.splitext(out)[0] + ".preview.png"
                renders[0].save(preview)
                clip = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
                proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
                inp = proc(images=[clip_input] + list(renders), return_tensors="pt").to(device)
                with torch.no_grad():
                    feats = clip.get_image_features(**inp)
                feats = feats / feats.norm(dim=-1, keepdim=True)
                sims = (feats[1:] @ feats[0]).tolist()  # each render vs the input
                print(f"POF_TRIPOSR_CLIP_MAX={max(sims):.4f}")
                print(f"POF_TRIPOSR_CLIP_MEAN={sum(sims) / len(sims):.4f}")
                print("POF_TRIPOSR_PREVIEW=" + preview.replace("\\", "/"))
            except Exception as fe:  # noqa: BLE001 — fidelity is best-effort, never blocks the mesh
                print("POF_TRIPOSR_CLIP_ERROR=" + repr(fe))

        print("POF_TRIPOSR_DONE=" + out.replace("\\", "/"))
        return 0
    except Exception as e:  # noqa: BLE001 — report any failure as a parseable marker
        import traceback
        traceback.print_exc()
        print("POF_TRIPOSR_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
