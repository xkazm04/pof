# Copyright PoF.
#
# PoF Enhanced Input introspection — Epic's first-party input tooling is reportedly
# non-functional (empty methods), so listing/inspecting Input Actions is a real
# gap-filler. Read-only AssetRegistry query.

import unreal

import toolset_registry


@unreal.uclass()
class PoFInputTools(unreal.ToolsetDefinition):
    """Introspect Enhanced Input assets (PoF gap-filler)."""

    @toolset_registry.tool_call
    @staticmethod
    def list_input_actions() -> list[str]:
        """List the project's Enhanced Input Action assets.

        Returns:
            A list of InputAction asset names (e.g. 'IA_Move').
        """
        registry = unreal.AssetRegistryHelpers.get_asset_registry()
        class_path = unreal.TopLevelAssetPath('/Script/EnhancedInput', 'InputAction')
        assets = registry.get_assets_by_class(class_path, True)
        return [str(a.asset_name) for a in assets]
