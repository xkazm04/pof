# Copyright PoF.
#
# PoF ARPG character movement tuning — no first-party equivalent (Epic ships no
# game-character movement-config tool). Operates on an editor-world actor by path
# or label; transient (no asset save). Gap-filler.

import unreal

import toolset_registry


def _find_actor(actor_path: str) -> unreal.Actor:
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in sub.get_all_level_actors():
        if actor.get_path_name() == actor_path or actor.get_actor_label() == actor_path:
            return actor
    raise RuntimeError('actor not found: ' + actor_path)


def _movement(actor: unreal.Actor) -> unreal.CharacterMovementComponent:
    comp = actor.get_component_by_class(unreal.CharacterMovementComponent)
    if comp is None:
        raise RuntimeError('no CharacterMovementComponent on: ' + actor.get_actor_label())
    return comp


@unreal.uclass()
class PoFCharacterTools(unreal.ToolsetDefinition):
    """Read/write an ARPG character's movement config (PoF gap-filler)."""

    @toolset_registry.tool_call
    @staticmethod
    def get_movement(actor_path: str) -> str:
        """Read an editor-world character's movement config.

        Args:
            actor_path: Object path or actor label of an ACharacter.
        Returns:
            'max_walk_speed=..; jump_z_velocity=..; gravity_scale=..'.
        """
        m = _movement(_find_actor(actor_path))
        return 'max_walk_speed=%s; jump_z_velocity=%s; gravity_scale=%s' % (
            m.max_walk_speed, m.jump_z_velocity, m.gravity_scale)

    @toolset_registry.tool_call
    @staticmethod
    def set_movement(actor_path: str, max_walk_speed: float, jump_z_velocity: float,
                     gravity_scale: float) -> str:
        """Set an editor-world character's movement config (transient — no asset save).

        Args:
            actor_path: Object path or actor label of an ACharacter.
            max_walk_speed: Walk speed, cm/s.
            jump_z_velocity: Jump impulse, cm/s.
            gravity_scale: Gravity multiplier.
        Returns:
            The new config, same format as get_movement.
        """
        m = _movement(_find_actor(actor_path))
        m.set_editor_property('max_walk_speed', max_walk_speed)
        m.set_editor_property('jump_z_velocity', jump_z_velocity)
        m.set_editor_property('gravity_scale', gravity_scale)
        return PoFCharacterTools.get_movement(actor_path)
