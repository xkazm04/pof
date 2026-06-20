"""PoF text->image — the upstream 2D step for the local 3D pipeline. Turns a text
prompt into a single clean reference image (SDXL on the GPU) that TripoSR can lift to
3D. This is the missing front of `text -> 2D -> TripoSR(.glb) -> critique`. Free/local.
Emits POF_TXT2IMG_DONE=<path>.

  python pof_txt2img.py --prompt "..." --output out.png --seed 1
"""
import argparse
import os
import sys

DEFAULT_NEG = "blurry, low quality, deformed, extra limbs, multiple people, cropped, watermark, text, busy background"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--negative", default=DEFAULT_NEG)
    ap.add_argument("--model", default="stabilityai/stable-diffusion-xl-base-1.0")
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--guidance", type=float, default=7.0)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--width", type=int, default=1024)
    ap.add_argument("--height", type=int, default=1024)
    args = ap.parse_args()
    try:
        import torch
        from diffusers import AutoPipelineForText2Image

        pipe = AutoPipelineForText2Image.from_pretrained(
            args.model, torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
        ).to("cuda")
        pipe.set_progress_bar_config(disable=True)
        gen = torch.Generator("cuda").manual_seed(args.seed)
        image = pipe(
            prompt=args.prompt, negative_prompt=args.negative,
            num_inference_steps=args.steps, guidance_scale=args.guidance,
            width=args.width, height=args.height, generator=gen,
        ).images[0]
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        image.save(args.output)
        print("POF_TXT2IMG_DONE=" + args.output.replace("\\", "/"))
        return 0
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("POF_TXT2IMG_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
