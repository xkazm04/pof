import { py } from '@/lib/blender-mcp/escape';

/**
 * Scene Composer object operations, as real scripts.
 *
 * These used to be template literals inlined in `useSceneComposerStore`, built
 * with `name.replace(/"/g, '\\"')` — which escapes the quote but NOT the
 * backslash, so an object called `a\b` produced
 * `bpy.data.objects.get("a\b")` (Python `\b` = backspace) and silently
 * addressed a DIFFERENT object, or none. Both scripts also ended in a bare
 * `if obj:` with no `else`, so "not found" and "deleted" were the same
 * observable outcome: a transport OK and a tree that refreshed looking
 * identical. Every other script in this folder uses `py()` and RAISES — see
 * `optimize-mesh.ts`, which is the shape these now match.
 *
 * A raise becomes an addon `status:'error'`, which becomes an `err()` Result,
 * which the caller must surface. That is the entire point.
 */

/** Remove an object from the scene, failing loudly if it is not there. */
export function deleteObjectScript(name: string): string {
  return `
import bpy

obj = bpy.data.objects.get("${py(name)}")
if not obj:
    raise ValueError("Object '${py(name)}' not found — nothing was deleted")

bpy.data.objects.remove(obj, do_unlink=True)
# Deliberately NOT an f-string: the name is interpolated by us, and a name
# containing braces would make Python try to evaluate it as a field.
print("Deleted object: ${py(name)}")
`.trim();
}

/**
 * Duplicate an object (linked copy of the object, independent copy of its data),
 * failing loudly if the source is not there.
 */
export function duplicateObjectScript(name: string): string {
  return `
import bpy

obj = bpy.data.objects.get("${py(name)}")
if not obj:
    raise ValueError("Object '${py(name)}' not found — nothing was duplicated")

new_obj = obj.copy()
if obj.data:
    new_obj.data = obj.data.copy()
bpy.context.collection.objects.link(new_obj)
print(f"Duplicated {obj.name} as {new_obj.name}")
`.trim();
}
