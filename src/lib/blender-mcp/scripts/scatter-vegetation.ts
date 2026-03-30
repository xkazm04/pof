export interface ScatterPoint {
  x: number;
  y: number;
  speciesId: string;
  rotation: number;
  scale: number;
}

export function scatterVegetationScript(params: {
  points: ScatterPoint[];
  speciesNames: Record<string, string>;
}): string {
  const pointsJson = JSON.stringify(params.points);
  const speciesJson = JSON.stringify(params.speciesNames);

  return `
import bpy
import json
import math

points = json.loads('${pointsJson.replace(/'/g, "\\'")}')
species = json.loads('${speciesJson.replace(/'/g, "\\'")}')

collection = bpy.data.collections.new("Vegetation")
bpy.context.scene.collection.children.link(collection)

for i, pt in enumerate(points):
    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=0.3 * pt["scale"],
        location=(pt["x"], pt["y"], 0),
    )
    obj = bpy.context.active_object
    name = species.get(pt["speciesId"], pt["speciesId"])
    obj.name = f"{name}_{i}"
    obj.rotation_euler.z = math.radians(pt["rotation"])
    collection.objects.link(obj)
    bpy.context.scene.collection.objects.unlink(obj)

print(f"Scattered {len(points)} vegetation objects")
`.trim();
}
