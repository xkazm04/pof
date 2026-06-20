"""PoF Hunyuan3D shape runner — image->mesh via Hunyuan3D-2's shape model
(Hunyuan3DDiTFlowMatchingPipeline, ~6GB VRAM, flow-matching DiT). The geometry-quality
upgrade candidate over TripoSR. SHAPE ONLY (no texgen — that needs a custom CUDA
rasterizer); the mesh carries no texture, judged on geometry. Locates hy3dgen via
--hunyuan-root (no pip install -e, no build). Emits POF_HY3D_* markers.
NOTE: Hunyuan3D is NON-COMMERCIAL licensed — evaluation only, not for shipping.

  python pof_hunyuan.py --image in.png --output out.glb --hunyuan-root <repo>
"""
import argparse
import os
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--hunyuan-root", required=True, help="dir containing the hy3dgen package")
    ap.add_argument("--model", default="tencent/Hunyuan3D-2")
    args = ap.parse_args()

    sys.path.insert(0, args.hunyuan_root)
    try:
        import time
        import torch
        from PIL import Image
        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
        from hy3dgen.rembg import BackgroundRemover

        t0 = time.time()
        pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(args.model)
        print(f"POF_HY3D_LOAD_S={time.time() - t0:.1f}")

        image = Image.open(args.image).convert("RGB")
        image = BackgroundRemover()(image)  # -> RGBA with the subject isolated

        ti = time.time()
        mesh = pipe(image=image)[0]
        print(f"POF_HY3D_GEN_S={time.time() - ti:.1f}")
        if torch.cuda.is_available():
            print(f"POF_HY3D_VRAM_GB={torch.cuda.max_memory_allocated() / 1e9:.1f}")

        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        mesh.export(args.output)
        try:
            print(f"POF_HY3D_VERTS={len(mesh.vertices)}")
            print(f"POF_HY3D_FACES={len(mesh.faces)}")
        except Exception:
            pass

        # Gray-shape preview render (pyglet) for the critique tiers + UI badge (shape
        # has no texture, so this shows pure geometry — the right thing to judge).
        try:
            png = mesh.scene().save_image(resolution=(512, 640))
            preview = os.path.splitext(args.output)[0] + ".preview.png"
            with open(preview, "wb") as f:
                f.write(png)
            print("POF_HY3D_PREVIEW=" + preview.replace("\\", "/"))
        except Exception as re:
            print("POF_HY3D_PREVIEW_ERROR=" + repr(re)[:120])

        print("POF_HY3D_DONE=" + args.output.replace("\\", "/"))
        return 0
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("POF_HY3D_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
