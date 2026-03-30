import { py } from '@/lib/blender-mcp/escape';

export interface IKChainDef {
  boneName: string;
  targetBone: string;
  chainLength: number;
}

export function setupIKScript(params: {
  armatureName: string;
  chains: IKChainDef[];
}): string {
  const chainStatements = params.chains
    .map(
      (c) => `
bone = obj.pose.bones["${py(c.boneName)}"]
ik = bone.constraints.new('IK')
ik.target = obj
ik.subtarget = "${py(c.targetBone)}"
ik.chain_count = ${c.chainLength}`,
    )
    .join('\n');

  return `
import bpy

obj = bpy.data.objects.get("${py(params.armatureName)}")
if not obj or obj.type != 'ARMATURE':
    raise ValueError("Armature '${py(params.armatureName)}' not found")

bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode='POSE')

${chainStatements}

bpy.ops.object.mode_set(mode='OBJECT')
print("IK constraints applied")
`.trim();
}
