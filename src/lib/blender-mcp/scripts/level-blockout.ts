import { py } from '@/lib/blender-mcp/escape';

export interface BlockoutRoom {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
}

export function levelBlockoutScript(params: {
  rooms: BlockoutRoom[];
  wallHeight: number;
}): string {
  const roomStatements = params.rooms
    .map(
      (r) => `
# Room: ${r.name} (${r.type})
bpy.ops.mesh.primitive_cube_add(size=1, location=(${r.x}, ${r.y}, ${params.wallHeight / 2}))
obj = bpy.context.active_object
obj.name = "Room_${py(r.id)}"
obj.scale = (${r.width / 2}, ${r.height / 2}, ${params.wallHeight / 2})
bpy.ops.object.transform_apply(scale=True)
mat = bpy.data.materials.new(name="Mat_${py(r.id)}")
mat.diffuse_color = (${r.color[0]}, ${r.color[1]}, ${r.color[2]}, 0.6)
obj.data.materials.append(mat)
obj.display_type = 'SOLID'
rooms_coll.objects.link(obj)
bpy.context.scene.collection.objects.unlink(obj)`,
    )
    .join('\n');

  return `
import bpy

rooms_coll = bpy.data.collections.new("Rooms")
bpy.context.scene.collection.children.link(rooms_coll)

${roomStatements}

print(f"Created level blockout: ${params.rooms.length} rooms")
`.trim();
}
