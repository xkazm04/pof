# Editor-run unit tests for PoFSpikeTools. These need the live `unreal` runtime,
# so they run INSIDE the editor via the PythonTestRunner registered in
# init_unreal.py (Automation tab → PoF.Toolsets.PoFSpikeToolset), not vitest.

import unittest

from pof_toolset.toolsets.spike import PoFSpikeTools


class PoFSpikeToolsTestCase(unittest.TestCase):
    """Verify the spike toolset's tools return as designed."""

    def test_ping_returns_sentinel(self):
        self.assertEqual(PoFSpikeTools.ping(), 'PoF toolset alive')

    def test_project_info_reports_engine(self):
        info = PoFSpikeTools.project_info()
        self.assertIsInstance(info, str)
        self.assertIn('on UE', info)
