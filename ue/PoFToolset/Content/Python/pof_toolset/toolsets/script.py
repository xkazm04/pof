# Copyright PoF.
#
# PoF's UNSANDBOXED "code mode" — full-access Python exec in the editor. This is
# the power-tool Epic's first-party MCP omits (its programmatic.execute_tool_script
# is sandboxed: stdlib-only, read-only FS). Same security posture as PoF's existing
# :8090 execute_script. Gap-filler — see docs/ue58-mcp-phase2-tool-map.md.

import unreal

import toolset_registry


@unreal.uclass()
class PoFScriptTools(unreal.ToolsetDefinition):
    """Run arbitrary Python in the editor with full `unreal` access (PoF code mode)."""

    @toolset_registry.tool_call
    @staticmethod
    def run_python(script: str) -> str:
        """Execute a Python script in the editor with full engine access.

        The script runs in a fresh namespace with `unreal` pre-imported. Assign a
        `result` variable to return a value to the caller.

        Args:
            script: Python source. Set `result = ...` to return something.
        Returns:
            str(result), or '' if the script assigned no `result`.
        """
        namespace = {'unreal': unreal}
        exec(script, namespace)
        return str(namespace.get('result', ''))
