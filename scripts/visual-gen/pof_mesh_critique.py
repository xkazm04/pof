"""PoF mesh critique — Tier-1 (free, local, deterministic) quality signals for a
generated 3D mesh. Loads a .glb/.obj with trimesh and emits POF_CRITIQUE_<key>=<value>
markers (structural health: watertight, connected components/floaters, vert/face counts,
degenerate faces, bbox/scale, volume, area). No model, no GPU, no cost — the asset
analog of the experiment lab's deterministic behavioralVerdict. Run with the TripoSR
venv python (which already has trimesh).
"""
import argparse
import sys

# A shattered mesh can have thousands of shells; the histogram only has to be long
# enough to separate parts from specks, and a bounded marker keeps stdout parseable.
MAX_COMPONENT_HISTOGRAM = 4096


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mesh", required=True)
    args = ap.parse_args()
    try:
        import numpy as np  # noqa: F401  (trimesh pulls it; kept explicit)
        import trimesh

        mesh = trimesh.load(args.mesh, force="mesh")  # concatenate a Scene into one mesh

        def emit(k: str, v: object) -> None:
            print(f"POF_CRITIQUE_{k}={v}")

        emit("VERTS", len(mesh.vertices))
        emit("FACES", len(mesh.faces))
        emit("WATERTIGHT", int(bool(mesh.is_watertight)))
        emit("WINDING_CONSISTENT", int(bool(mesh.is_winding_consistent)))
        # Component COUNT alone cannot tell an assembled character (head, lashes, brows,
        # eye layers, mouth interior, teeth, tongue, body, hands, hair, cape) from a
        # shattered mesh. Emit the per-component face histogram so the scorer can judge
        # specks by face share instead of failing a correct multi-part character.
        parts = mesh.split(only_watertight=False)
        emit("COMPONENTS", len(parts))
        part_faces = sorted((len(p.faces) for p in parts), reverse=True)
        kept = part_faces[:MAX_COMPONENT_HISTOGRAM]
        emit("COMPONENT_FACES", ",".join(str(n) for n in kept))
        # Largest-first, so anything dropped is no bigger than the smallest kept entry.
        # Say how many were dropped — silently truncating hides exactly the specks.
        emit("COMPONENT_FACES_OMITTED", len(part_faces) - len(kept))
        emit("EULER", mesh.euler_number)
        ext = mesh.extents if mesh.extents is not None else [0, 0, 0]
        emit("BBOX", f"{ext[0]:.4f},{ext[1]:.4f},{ext[2]:.4f}")
        emit("VOLUME", f"{mesh.volume:.6f}" if mesh.is_watertight else "nan")
        emit("AREA", f"{mesh.area:.6f}")
        try:
            nd = mesh.nondegenerate_faces()
            emit("DEGENERATE_FACES", int((~nd).sum()))
        except Exception:
            emit("DEGENERATE_FACES", 0)
        print("POF_CRITIQUE_DONE=ok")
        return 0
    except Exception as e:  # noqa: BLE001 — any failure is a parseable marker
        import traceback
        traceback.print_exc()
        print("POF_CRITIQUE_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
