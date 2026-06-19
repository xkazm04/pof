# Editor-run unit tests for the Phase-2 gap-filler toolsets. Need the live
# `unreal` runtime — run via the PythonTestRunner (Automation:
# PoF.Toolsets.PoFSpikeToolset), not vitest. The autonomous headless check in
# the ue58-mcp Phase-2 spec is the primary gate; these mirror Epic's pattern.

import unittest

import unreal

from pof_toolset.toolsets.script import PoFScriptTools
from pof_toolset.toolsets.character import PoFCharacterTools
from pof_toolset.toolsets.input_actions import PoFInputTools
from pof_toolset.toolsets.niagara import PoFNiagaraTools
from pof_toolset.toolsets.mesh_instances import PoFInstancedMeshTools


class PoFScriptToolsTestCase(unittest.TestCase):
    def test_run_python_returns_result(self):
        self.assertEqual(PoFScriptTools.run_python('result = 2 + 2'), '4')

    def test_run_python_no_result_is_empty(self):
        self.assertEqual(PoFScriptTools.run_python('x = 1'), '')

    def test_run_python_has_unreal(self):
        out = PoFScriptTools.run_python("result = 'ok' if unreal else 'no'")
        self.assertEqual(out, 'ok')


class PoFCharacterToolsTestCase(unittest.TestCase):
    def setUp(self):
        sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        self._actor = sub.spawn_actor_from_class(unreal.Character, unreal.Vector(0, 0, 100))
        self._label = self._actor.get_actor_label()

    def tearDown(self):
        sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        sub.destroy_actor(self._actor)

    def test_set_then_get_round_trips(self):
        PoFCharacterTools.set_movement(self._label, 600.0, 800.0, 1.5)
        out = PoFCharacterTools.get_movement(self._label)
        self.assertIn('max_walk_speed=600.0', out)
        self.assertIn('jump_z_velocity=800.0', out)


class PoFInputToolsTestCase(unittest.TestCase):
    def test_list_returns_a_list(self):
        self.assertIsInstance(PoFInputTools.list_input_actions(), list)


class PoFNiagaraToolsTestCase(unittest.TestCase):
    def test_list_returns_a_list(self):
        # capture_viewport is verified via a -RenderOffScreen launch, not here
        # (it needs RHI). list_niagara_systems works in any editor.
        self.assertIsInstance(PoFNiagaraTools.list_niagara_systems(), list)


class PoFInstancedMeshToolsTestCase(unittest.TestCase):
    def setUp(self):
        sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        self._actor = sub.spawn_actor_from_class(unreal.Actor, unreal.Vector(0, 0, 0))
        self._actor.add_component_by_class(unreal.InstancedStaticMeshComponent, False, unreal.Transform(), False)
        self._label = self._actor.get_actor_label()

    def tearDown(self):
        unreal.get_editor_subsystem(unreal.EditorActorSubsystem).destroy_actor(self._actor)

    def test_add_then_count_then_remove(self):
        PoFInstancedMeshTools.add_instance(self._label, 100, 0, 0)
        PoFInstancedMeshTools.add_instance(self._label, 200, 0, 0)
        self.assertIn('count=2', PoFInstancedMeshTools.get_instance_count(self._label))
        PoFInstancedMeshTools.remove_instance(self._label, 0)
        self.assertIn('count=1', PoFInstancedMeshTools.get_instance_count(self._label))
