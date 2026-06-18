# PoF Toolset — Phase-0 spike for the UE 5.8 first-party MCP convergence.
#
# UE's PythonScriptPlugin auto-runs this `init_unreal.py` for every enabled
# plugin that has a Content/Python directory. We register our toolset with the
# Toolset Registry here so the ModelContextProtocol server exposes it. Mirrors
# Epic's shipped pattern (e.g. ConversationToolset/.../init_unreal.py).

import unreal

from pof_toolset import toolsets
from pof_toolset import tests

# Register first — this is the load-bearing line the spike validates.
toolsets._registration.register()

# Editor-run unit tests (Automation: PoF.Toolsets.PoFSpikeToolset). Wrapped so a
# test-runner API mismatch can never break registration above.
try:
    tests._test_runner = unreal.PythonTestRunner.create(
        'PoF.Toolsets.PoFSpikeToolset',
        unreal.PythonTestRunnerSearchOptions(root_module=tests.__name__))
except Exception as exc:  # noqa: BLE001 — spike: never let test wiring break load
    unreal.log_warning(f'[PoFToolset] test runner not registered: {exc}')
