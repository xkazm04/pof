import { py } from '@/lib/blender-mcp/escape';

export interface BoneDefinition {
  name: string;
  head: [number, number, number];
  tail: [number, number, number];
  parent?: string;
}

export function createArmatureScript(params: {
  armatureName: string;
  bones: BoneDefinition[];
}): string {
  const boneStatements = params.bones
    .map(
      (b) => `
bone = amt.edit_bones.new("${py(b.name)}")
bone.head = (${b.head.join(', ')})
bone.tail = (${b.tail.join(', ')})
${b.parent ? `bone.parent = amt.edit_bones["${py(b.parent)}"]` : ''}`,
    )
    .join('\n');

  return `
import bpy

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature_obj = bpy.context.active_object
armature_obj.name = "${py(params.armatureName)}"
amt = armature_obj.data
amt.name = "${py(params.armatureName)}_Data"

# Remove default bone
amt.edit_bones.remove(amt.edit_bones[0])

${boneStatements}

bpy.ops.object.mode_set(mode='OBJECT')
print(f"Created armature: ${py(params.armatureName)} with {len(amt.bones)} bones")
`.trim();
}
