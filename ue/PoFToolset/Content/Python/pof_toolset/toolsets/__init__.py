# Collects this plugin's toolsets and builds the Registration the
# init_unreal.py registers. Mirrors Epic's shipped toolsets/__init__.py.

from pof_toolset.toolsets.spike import PoFSpikeTools
from pof_toolset.toolsets.script import PoFScriptTools
from pof_toolset.toolsets.character import PoFCharacterTools
from pof_toolset.toolsets.input_actions import PoFInputTools
from toolset_registry.registration import Registration

_registration = Registration([
    PoFSpikeTools,
    PoFScriptTools,
    PoFCharacterTools,
    PoFInputTools,
])
