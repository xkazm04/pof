import { py } from '@/lib/blender-mcp/escape';

export interface AnimState {
  name: string;
  type: string;
  frameStart: number;
  frameEnd: number;
}

export function nlaStateMachineScript(params: {
  armatureName: string;
  states: AnimState[];
}): string {
  const strips = params.states
    .map(
      (state, i) => `
# State: ${state.name} (${state.type})
action = bpy.data.actions.new(name="${py(state.name)}")
action.frame_range = (${state.frameStart}, ${state.frameEnd})
track = armature.animation_data.nla_tracks.new()
track.name = "${py(state.name)}"
track.strips.new("${py(state.name)}", ${state.frameStart}, action)
track.mute = ${i > 0 ? 'True' : 'False'}`,
    )
    .join('\n');

  return `
import bpy

armature = bpy.data.objects.get("${py(params.armatureName)}")
if not armature:
    raise ValueError("Armature '${py(params.armatureName)}' not found")

if not armature.animation_data:
    armature.animation_data_create()

# Clear existing NLA tracks
for track in list(armature.animation_data.nla_tracks):
    armature.animation_data.nla_tracks.remove(track)

${strips}

print(f"Created NLA state machine with {len(armature.animation_data.nla_tracks)} tracks")
`.trim();
}
