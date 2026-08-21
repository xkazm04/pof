"""PoF TRELLIS.2 runner — image->mesh via Microsoft's TRELLIS.2-4B
(Trellis2ImageTo3DPipeline, ~24GB VRAM at fp16). The first PoF provider that emits
GEOMETRY **AND** PBR TEXTURE in one pass — Hunyuan3D and TripoSR are shape-only, so
their texturing is a separate Leonardo-PBR/rasterizer stage. TRELLIS.2 is MIT
licensed (Microsoft), which also makes it the first COMMERCIAL-SAFE high-quality
local route: Hunyuan3D is non-commercial and Tripo3D's free tier is CC BY 4.0.

`--decimation-target` is a NATIVE face budget (o_voxel.postprocess.to_glb), so a
class budget can steer generation instead of being enforced by a later decimate
pass — unlike Hunyuan3D, which emits ~360K faces and accepts no budget input.

Locates the checkout via --trellis-root (no pip install -e). Emits POF_T2_* markers.

  python pof_trellis.py --image in.png --output out.glb --trellis-root <repo>
"""
import argparse
import os
import sys

# Must precede torch import — the example script sets both.
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")


def _preview(mesh, glb_path: str, trellis_root: str) -> None:
    """Best-effort preview render for the critique tiers. A TEXTURED mesh must be
    judged lit — a gray shape render would hide the half of the output that is new
    here — so try the repo's PBR renderer first and only then fall back."""
    out = os.path.splitext(glb_path)[0] + ".preview.png"
    try:
        import cv2
        import imageio
        import numpy as np
        import torch
        from trellis2.utils import render_utils
        from trellis2.renderers import EnvMap

        hdri = os.path.join(trellis_root, "assets", "hdri", "forest.exr")
        envmap = EnvMap(torch.tensor(
            cv2.cvtColor(cv2.imread(hdri, cv2.IMREAD_UNCHANGED), cv2.COLOR_BGR2RGB),
            dtype=torch.float32, device="cuda",
        ))
        frames = render_utils.make_pbr_vis_frames(render_utils.render_video(mesh, envmap=envmap))
        imageio.imwrite(out, np.asarray(frames[len(frames) // 2]))
        print("POF_T2_PREVIEW=" + out.replace("\\", "/"))
        return
    except Exception as e:  # noqa: BLE001
        print("POF_T2_PREVIEW_PBR_ERROR=" + repr(e)[:160])

    try:  # fallback: load the exported glb and let trimesh render it
        import trimesh
        scene = trimesh.load(glb_path)
        png = scene.scene().save_image(resolution=(512, 640)) if hasattr(scene, "scene") else scene.save_image(resolution=(512, 640))
        with open(out, "wb") as f:
            f.write(png)
        print("POF_T2_PREVIEW=" + out.replace("\\", "/"))
    except Exception as e:  # noqa: BLE001
        print("POF_T2_PREVIEW_ERROR=" + repr(e)[:160])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--trellis-root", required=True, help="dir containing the trellis2 package")
    ap.add_argument("--model", default="microsoft/TRELLIS.2-4B")
    ap.add_argument("--decimation-target", type=int, default=1000000,
                    help="native face budget handed to o_voxel.postprocess.to_glb")
    ap.add_argument("--texture-size", type=int, default=4096,
                    help="PBR texture resolution; the first lever to drop when VRAM is tight")
    ap.add_argument("--no-preview", action="store_true")
    args = ap.parse_args()

    sys.path.insert(0, args.trellis_root)
    try:
        import time
        import torch
        from PIL import Image
        from trellis2.pipelines import Trellis2ImageTo3DPipeline
        import o_voxel

        t0 = time.time()
        pipeline = Trellis2ImageTo3DPipeline.from_pretrained(args.model)
        pipeline.cuda()
        print(f"POF_T2_LOAD_S={time.time() - t0:.1f}")

        image = Image.open(args.image).convert("RGB")

        ti = time.time()
        mesh = pipeline.run(image)[0]
        mesh.simplify(16777216)  # nvdiffrast vertex limit
        print(f"POF_T2_GEN_S={time.time() - ti:.1f}")
        if torch.cuda.is_available():
            print(f"POF_T2_VRAM_GB={torch.cuda.max_memory_allocated() / 1e9:.1f}")

        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        tb = time.time()
        glb = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=args.decimation_target,
            texture_size=args.texture_size,
            remesh=True,
            remesh_band=1,
            remesh_project=0,
            verbose=False,
        )
        glb.export(args.output, extension_webp=True)
        print(f"POF_T2_BAKE_S={time.time() - tb:.1f}")

        # Report the DELIVERED counts (post-decimation), not the pre-bake mesh's —
        # the .glb is what the gate grades and what UE would import.
        try:
            print(f"POF_T2_VERTS={len(glb.vertices)}")
            print(f"POF_T2_FACES={len(glb.faces)}")
        except Exception:  # noqa: BLE001
            pass

        if not args.no_preview:
            _preview(mesh, args.output, args.trellis_root)

        print("POF_T2_DONE=" + args.output.replace("\\", "/"))
        return 0
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("POF_T2_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
