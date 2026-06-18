# Copyright PoF.
#
# PoF Niagara FX control — Epic's NiagaraToolsets ships 0 callable tools (skills/
# docs only), so listing + spawning Niagara systems is a real gap-filler.

import unreal

import toolset_registry


@unreal.uclass()
class PoFNiagaraTools(unreal.ToolsetDefinition):
    """List and spawn Niagara FX systems (PoF gap-filler — Epic ships none)."""

    @toolset_registry.tool_call
    @staticmethod
    def list_niagara_systems() -> list[str]:
        """List the project's NiagaraSystem assets.

        Returns:
            A list of NiagaraSystem object paths (load/spawn-ready).
        """
        registry = unreal.AssetRegistryHelpers.get_asset_registry()
        class_path = unreal.TopLevelAssetPath('/Script/Niagara', 'NiagaraSystem')
        assets = registry.get_assets_by_class(class_path, True)
        return ['%s.%s' % (a.package_name, a.asset_name) for a in assets]

    @toolset_registry.tool_call
    @staticmethod
    def spawn_niagara(system_path: str, x: float, y: float, z: float) -> str:
        """Spawn a Niagara system at a world location in the editor world (transient).

        Args:
            system_path: NiagaraSystem object path (from list_niagara_systems).
            x: World X. y: World Y. z: World Z.
        Returns:
            The spawned component's path name.
        """
        system = unreal.load_asset(system_path)
        if system is None:
            raise RuntimeError('NiagaraSystem not found: ' + system_path)
        world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
        comp = unreal.NiagaraFunctionLibrary.spawn_system_at_location(
            world, system, unreal.Vector(x, y, z))
        return comp.get_path_name() if comp else 'spawn returned None'
