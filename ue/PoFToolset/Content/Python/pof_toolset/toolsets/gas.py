# Copyright PoF.
#
# PoF GAS mutation + inspection — Epic's GASToolsets is INSPECTION-ONLY; ours
# mutates (the differentiator). Uses the Python-exposed UAbilitySystemComponent
# API (apply_gameplay_effect_to_self / get_all_abilities / make_effect_context),
# confirmed available in UE 5.8. Operates on an editor-world actor (transient).

import unreal

import toolset_registry


def _find_actor(actor_path: str) -> unreal.Actor:
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in sub.get_all_level_actors():
        if actor.get_path_name() == actor_path or actor.get_actor_label() == actor_path:
            return actor
    raise RuntimeError('actor not found: ' + actor_path)


def _asc(actor: unreal.Actor) -> unreal.AbilitySystemComponent:
    comp = actor.get_component_by_class(unreal.AbilitySystemComponent)
    if comp is None:
        raise RuntimeError('no AbilitySystemComponent on: ' + actor.get_actor_label())
    return comp


def _load_ge_class(effect_path: str):
    obj = unreal.load_asset(effect_path)
    if isinstance(obj, unreal.Blueprint):
        return obj.generated_class()
    if obj is not None:
        return obj
    return unreal.load_class(None, effect_path)


@unreal.uclass()
class PoFGasTools(unreal.ToolsetDefinition):
    """Mutate + inspect GAS on an editor-world actor (PoF gap-filler — Epic only inspects)."""

    @toolset_registry.tool_call
    @staticmethod
    def apply_effect(actor_path: str, effect_class_path: str, level: float) -> str:
        """Apply a GameplayEffect to an actor's AbilitySystemComponent (transient).

        Args:
            actor_path: Object path or label of an ASC-bearing actor.
            effect_class_path: GameplayEffect class/asset path.
            level: Effect level.
        Returns:
            A confirmation string.
        """
        asc = _asc(_find_actor(actor_path))
        ge = _load_ge_class(effect_class_path)
        if ge is None:
            raise RuntimeError('GameplayEffect class not found: ' + effect_class_path)
        asc.apply_gameplay_effect_to_self(ge, level, asc.make_effect_context())
        return 'applied %s @L%s' % (effect_class_path, level)

    @toolset_registry.tool_call
    @staticmethod
    def list_abilities(actor_path: str) -> int:
        """Count the abilities granted to an actor's AbilitySystemComponent.

        Args:
            actor_path: Object path or label of an ASC-bearing actor.
        Returns:
            The number of granted abilities.
        """
        return len(_asc(_find_actor(actor_path)).get_all_abilities())
