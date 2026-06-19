# Copyright PoF.
#
# Instanced Static Mesh (ISM) per-instance management — add / query / update /
# remove instances on an actor's InstancedStaticMeshComponent. A true gap-filler:
# Epic's 5.8 EditorToolset covers static/skeletal meshes as ASSETS, but ships no
# per-instance ISM management (audit 2026-06-19). Operates on the editor world.

import unreal

import toolset_registry


def _find_actor(actor_path: str) -> unreal.Actor:
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in sub.get_all_level_actors():
        if actor.get_path_name() == actor_path or actor.get_actor_label() == actor_path:
            return actor
    raise RuntimeError('actor not found: ' + actor_path)


def _ism(actor_path: str) -> unreal.InstancedStaticMeshComponent:
    comp = _find_actor(actor_path).get_component_by_class(unreal.InstancedStaticMeshComponent)
    if comp is None:
        raise RuntimeError('no InstancedStaticMeshComponent on: ' + actor_path)
    return comp


@unreal.uclass()
class PoFInstancedMeshTools(unreal.ToolsetDefinition):
    """Instanced Static Mesh per-instance management (PoF gap-filler — Epic ships none)."""

    @toolset_registry.tool_call
    @staticmethod
    def add_instance(actor_path: str, x: float, y: float, z: float) -> str:
        """Add an ISM instance at a world location.

        Args:
            actor_path: Object path or label of an actor with an InstancedStaticMeshComponent.
            x: World X. y: World Y. z: World Z.
        Returns:
            'index=<i> count=<n>' — the new instance index and resulting count.
        """
        ism = _ism(actor_path)
        idx = ism.add_instance(unreal.Transform(location=unreal.Vector(x, y, z)), world_space=True)
        return 'index=%d count=%d' % (idx, ism.get_instance_count())

    @toolset_registry.tool_call
    @staticmethod
    def get_instance_count(actor_path: str) -> str:
        """Return the actor's ISM instance count, 'count=<n>'."""
        return 'count=%d' % _ism(actor_path).get_instance_count()

    @toolset_registry.tool_call
    @staticmethod
    def update_instance_transform(actor_path: str, index: int, x: float, y: float, z: float) -> str:
        """Move an existing ISM instance to a world location.

        Args:
            actor_path: Object path or label of the actor.
            index: Instance index. x/y/z: New world location.
        Returns:
            'updated index=<i>'.
        """
        ism = _ism(actor_path)
        ism.update_instance_transform(index, unreal.Transform(location=unreal.Vector(x, y, z)),
                                      world_space=True, mark_render_state_dirty=True)
        return 'updated index=%d' % index

    @toolset_registry.tool_call
    @staticmethod
    def remove_instance(actor_path: str, index: int) -> str:
        """Remove an ISM instance by index.

        Returns:
            'removed=<bool> count=<n>'.
        """
        ism = _ism(actor_path)
        ok = ism.remove_instance(index)
        return 'removed=%s count=%d' % (ok, ism.get_instance_count())
