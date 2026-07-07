"""PoF VLM batch critique — loads an open VLM ONCE and scores many 2D game-art renders
from a manifest, so a fan-out gate over N images pays the model load a single time.
Emits one POF_VLM_ITEM= json line per entry + POF_VLM_BATCH_DONE. Sibling of
pof_vlm_critique.py (single-image, 3D-framed); this one is 2D-art framed and batched.

  python pof_vlm_batch.py --manifest gate.json --model Qwen/Qwen3-VL-4B-Instruct
    manifest = [{"id": "...", "file": "abs.jpg", "subject": "what it should be + criteria"}]
"""
import argparse
import json
import re
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--max-new-tokens", type=int, default=200)
    args = ap.parse_args()
    try:
        import time
        import torch
        from PIL import Image
        from transformers import AutoModelForImageTextToText, AutoProcessor

        with open(args.manifest, "r", encoding="utf-8") as fh:
            items = json.load(fh)

        t0 = time.time()
        model = AutoModelForImageTextToText.from_pretrained(args.model, dtype="auto", device_map="cuda")
        proc = AutoProcessor.from_pretrained(args.model)
        print(f"POF_VLM_LOAD_S={time.time() - t0:.1f}")

        for it in items:
            try:
                img = Image.open(it["file"]).convert("RGB")
            except Exception as e:  # noqa: BLE001
                print("POF_VLM_ITEM=" + json.dumps({"id": it["id"], "score": None, "error": repr(e)}))
                continue
            prompt = (
                f"This image is an AI-generated 2D game asset that should be: {it['subject']}. "
                "Judge it strictly as a shippable GAME ASSET (icon/art). Reply on ONE line EXACTLY as: "
                "SCORE=<0-10 integer>; DEFECTS=<comma-separated visual problems>; VERDICT=<one short sentence>."
            )
            messages = [{"role": "user", "content": [
                {"type": "image", "image": img},
                {"type": "text", "text": prompt},
            ]}]
            inputs = proc.apply_chat_template(
                messages, add_generation_prompt=True, tokenize=True, return_dict=True, return_tensors="pt",
            ).to(model.device)
            with torch.no_grad():
                out = model.generate(**inputs, max_new_tokens=args.max_new_tokens, do_sample=False)
            gen = proc.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()
            gen = gen.replace("\n", " ").strip()
            rec = {"id": it["id"], "raw": gen[:400]}
            for key in ("SCORE", "DEFECTS", "VERDICT"):
                m = re.search(key + r"=([^;]+)", gen)
                if m:
                    rec[key.lower()] = m.group(1).strip()
            try:
                rec["score"] = int(re.search(r"\d+", rec.get("score", "")).group())
            except Exception:  # noqa: BLE001
                rec["score"] = None
            print("POF_VLM_ITEM=" + json.dumps(rec))
            sys.stdout.flush()

        print("POF_VLM_BATCH_DONE=ok")
        return 0
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("POF_VLM_BATCH_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
