import { py, pyNum } from '@/lib/blender-mcp/escape';
import { pyReceipt } from '@/lib/blender-mcp/receipt';

export interface ComboHit {
  time: number;
  type: string;
  damage: number;
  rootMotion: number;
}

export function comboAnimationScript(params: {
  comboName: string;
  hits: ComboHit[];
  totalDuration: number;
}): string {
  const fps = 30;
  const endFrame = pyNum(Math.round(params.totalDuration * fps));
  const keyframes = params.hits
    .map((hit) => {
      const frame = pyNum(Math.round(hit.time * fps));
      return `
# ${hit.type} hit at frame ${frame}
bpy.context.scene.frame_set(${frame})
armature.pose.bones["Spine"].rotation_quaternion = (0.95, 0.3, 0, 0)
armature.pose.bones["Spine"].keyframe_insert(data_path="rotation_quaternion")
armature.pose.bones["UpperArm.R"].rotation_quaternion = (0.7, 0.7, 0, 0)
armature.pose.bones["UpperArm.R"].keyframe_insert(data_path="rotation_quaternion")`;
    })
    .join('\n');

  return `
import bpy

# Create basic armature for preview
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature = bpy.context.active_object
armature.name = "${py(params.comboName)}_Preview"
amt = armature.data

# armature_add makes one bone named "Bone"; replace it with the bones the keyframes pose
amt.edit_bones.remove(amt.edit_bones[0])
spine = amt.edit_bones.new("Spine")
spine.head = (0, 0, 0)
spine.tail = (0, 0, 1)
upper_arm = amt.edit_bones.new("UpperArm.R")
upper_arm.head = (0, 0, 1)
upper_arm.tail = (0.5, 0, 1)
upper_arm.parent = spine

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = ${endFrame}

bpy.ops.object.mode_set(mode='POSE')

# Reset pose at frame 1
scene.frame_set(1)
for bone in armature.pose.bones:
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.keyframe_insert(data_path="rotation_quaternion")

${keyframes}

# Reset at end
scene.frame_set(${endFrame})
for bone in armature.pose.bones:
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.keyframe_insert(data_path="rotation_quaternion")

bpy.ops.object.mode_set(mode='OBJECT')
scene.frame_set(1)
print(f"Created combo preview: ${py(params.comboName)} (${params.hits.length} hits, ${pyNum(params.totalDuration)}s)")
${pyReceipt('combo-preview', { name: 'armature.name', bones: 'len(amt.bones)', hits: pyNum(params.hits.length) })}
`.trim();
}
