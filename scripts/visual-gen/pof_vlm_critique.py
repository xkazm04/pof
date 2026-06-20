"""PoF VLM critique — Tier-3 (free, local) aesthetic/fidelity judge for a generated 3D
mesh. Feeds a render of the mesh (+ optionally the input reference) to an open VLM and
asks for a structured verdict CLIP can't give (score + named defects). Model-agnostic:
one code path via transformers' unified `apply_chat_template(..., tokenize=True)`, so the
SAME script runs Qwen3-VL-4B, Gemma 4 12B, InternVL3.5, etc. Emits POF_VLM_* markers.

  python pof_vlm_critique.py --render preview.png --reference chair.png \
    --model Qwen/Qwen3-VL-4B-Instruct --subject chair [--load-4bit]
"""
import argparse
import re
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--render", required=True, help="render of the generated mesh")
    ap.add_argument("--reference", help="optional input reference image to match against")
    ap.add_argument("--model", required=True, help="HF model id (any AutoModelForImageTextToText VLM)")
    ap.add_argument("--subject", default="object")
    ap.add_argument("--load-4bit", action="store_true", help="bitsandbytes 4-bit (for big models on 24GB)")
    ap.add_argument("--load-8bit", action="store_true", help="bitsandbytes 8-bit (fallback if 4-bit inference is buggy)")
    ap.add_argument("--max-new-tokens", type=int, default=220)
    args = ap.parse_args()
    try:
        import time
        import torch
        from PIL import Image
        from transformers import AutoModelForImageTextToText, AutoProcessor

        t0 = time.time()
        load_kwargs = {"dtype": "auto", "device_map": "cuda"}
        if args.load_4bit:
            from transformers import BitsAndBytesConfig
            load_kwargs = {
                "quantization_config": BitsAndBytesConfig(
                    load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16,
                ),
                "device_map": "cuda",
            }
        elif args.load_8bit:
            from transformers import BitsAndBytesConfig
            load_kwargs = {"quantization_config": BitsAndBytesConfig(load_in_8bit=True), "device_map": "cuda"}
        model = AutoModelForImageTextToText.from_pretrained(args.model, **load_kwargs)
        proc = AutoProcessor.from_pretrained(args.model)
        print(f"POF_VLM_LOAD_S={time.time() - t0:.1f}")
        if torch.cuda.is_available():
            print(f"POF_VLM_VRAM_GB={torch.cuda.max_memory_allocated() / 1e9:.1f}")

        content = [{"type": "image", "image": Image.open(args.render).convert("RGB")}]
        if args.reference:
            content.append({"type": "image", "image": Image.open(args.reference).convert("RGB")})
        prompt = (
            f"The first image is a render of an AI-generated 3D model of a '{args.subject}'."
            + (" The second image is the reference photo it is supposed to match." if args.reference else "")
            + " Judge it as a GAME ASSET. Reply on ONE line EXACTLY as:"
            + " SCORE=<0-10 integer>; DEFECTS=<comma-separated visual problems>; VERDICT=<one short sentence>."
        )
        content.append({"type": "text", "text": prompt})
        messages = [{"role": "user", "content": content}]

        inputs = proc.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=True, return_dict=True, return_tensors="pt",
        ).to(model.device)
        ti = time.time()
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=args.max_new_tokens, do_sample=False)
        gen = proc.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()
        print(f"POF_VLM_INFER_S={time.time() - ti:.1f}")
        print("POF_VLM_RAW=" + gen.replace("\n", " ").strip())
        for key in ("SCORE", "DEFECTS", "VERDICT"):
            m = re.search(key + r"=([^;]+)", gen)
            if m:
                print(f"POF_VLM_{key}=" + m.group(1).strip())
        print("POF_VLM_DONE=ok")
        return 0
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("POF_VLM_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
