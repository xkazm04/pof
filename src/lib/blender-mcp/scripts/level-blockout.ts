import { py, pyNum } from '@/lib/blender-mcp/escape';
import { pyReceipt } from '@/lib/blender-mcp/receipt';

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
      (r, i) => `
# Room ${i + 1}
bpy.ops.mesh.primitive_cube_add(size=1, location=(${pyNum(r.x)}, ${pyNum(r.y)}, ${pyNum(params.wallHeight / 2)}))
obj = bpy.context.active_object
obj.name = "Room_${py(r.id)}"
obj["pof_room_name"] = "${py(r.name)}"
obj["pof_room_type"] = "${py(r.type)}"
obj.scale = (${pyNum(r.width / 2)}, ${pyNum(r.height / 2)}, ${pyNum(params.wallHeight / 2)})
bpy.ops.object.transform_apply(scale=True)
mat = bpy.data.materials.new(name="Mat_${py(r.id)}")
mat.diffuse_color = (${pyNum(r.color[0])}, ${pyNum(r.color[1])}, ${pyNum(r.color[2])}, 0.6)
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
${pyReceipt('level-blockout', { rooms: 'len(rooms_coll.objects)' })}
`.trim();
}
