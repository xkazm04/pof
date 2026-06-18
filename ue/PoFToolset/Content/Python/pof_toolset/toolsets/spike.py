# Copyright PoF.
#
# Phase-0 spike toolset: the minimal proof that a PoF-AUTHORED toolset loads via
# the UE 5.8 Toolset Registry and is callable by an MCP client (Claude Code).
# Deliberately tiny + dependency-free so it runs in ANY 5.8 project. Phase 2
# replaces these with the real PoF tools (the 37 MCPUnreal ops + execute_script).

import unreal

import toolset_registry


@unreal.uclass()
class PoFSpikeTools(unreal.ToolsetDefinition):
    """PoF Phase-0 spike — proves the custom-toolset authoring path works."""

    @toolset_registry.tool_call
    @staticmethod
    def ping() -> str:
        """Liveness probe for the PoF toolset path.

        Returns:
            A sentinel string proving PoFSpikeTools is registered and callable.
        """
        return 'PoF toolset alive'

    @toolset_registry.tool_call
    @staticmethod
    def project_info() -> str:
        """Report the running editor's project name and engine version.

        Proves the toolset can reach the live `unreal` API (not just echo).

        Returns:
            "<project_name> on UE <engine_version>".
        """
        version = unreal.SystemLibrary.get_engine_version()
        project_file = unreal.Paths.get_project_file_path()
        name = unreal.Paths.get_base_filename(project_file) if project_file else 'unknown'
        return f'{name} on UE {version}'
