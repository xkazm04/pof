# Copyright PoF.
#
# PoF world/editor control gap-fillers: run an arbitrary console command, read the
# current level, teleport an editor-world actor. Long-tail PORT items from the
# Phase 2 tool map (not covered by Epic's first-party toolsets). All transient.

import unreal

import toolset_registry


def _editor_world() -> unreal.World:
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()


def _find_actor(actor_path: str) -> unreal.Actor:
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in sub.get_all_level_actors():
        if actor.get_path_name() == actor_path or actor.get_actor_label() == actor_path:
            return actor
    raise RuntimeError('actor not found: ' + actor_path)


@unreal.uclass()
class PoFWorldTools(unreal.ToolsetDefinition):
    """World/editor control: console commands, level info, actor teleport (PoF gap-fillers)."""

    @toolset_registry.tool_call
    @staticmethod
    def run_console_command(command: str) -> str:
        """Execute a UE console command in the editor world.

        Args:
            command: e.g. 'stat fps', 'r.ScreenPercentage 50'.
        Returns:
            A confirmation string.
        """
        unreal.SystemLibrary.execute_console_command(_editor_world(), command)
        return 'ran: ' + command

    @toolset_registry.tool_call
    @staticmethod
    def get_current_level() -> str:
        """Return the current editor world's name.

        Returns:
            The world/level name (e.g. 'VerticalSlice').
        """
        return _editor_world().get_name()

    @toolset_registry.tool_call
    @staticmethod
    def teleport_actor(actor_path: str, x: float, y: float, z: float) -> str:
        """Move an editor-world actor to a world location (transient).

        Args:
            actor_path: Object path or label of the actor.
            x: World X. y: World Y. z: World Z.
        Returns:
            The actor's resulting location, 'loc=x,y,z'.
        """
        actor = _find_actor(actor_path)
        actor.set_actor_location(unreal.Vector(x, y, z), False, False)
        loc = actor.get_actor_location()
        return 'loc=%.1f,%.1f,%.1f' % (loc.x, loc.y, loc.z)
