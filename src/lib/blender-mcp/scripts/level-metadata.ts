export interface SpawnPoint {
  x: number;
  y: number;
  type: string;
}

export function levelMetadataScript(params: {
  spawnPoints: SpawnPoint[];
}): string {
  const spawns = params.spawnPoints
    .map(
      (sp, i) => `
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(${sp.x}, ${sp.y}, 0))
obj = bpy.context.active_object
obj.name = "Spawn_${sp.type}_${i}"
obj.empty_display_size = 0.5
meta_coll.objects.link(obj)
bpy.context.scene.collection.objects.unlink(obj)`,
    )
    .join('\n');

  return `
import bpy

meta_coll = bpy.data.collections.new("Level_Metadata")
bpy.context.scene.collection.children.link(meta_coll)

${spawns}

print(f"Added ${params.spawnPoints.length} spawn points")
`.trim();
}
