# Copyright PoF.
#
# PoF viewport capture — Epic ships NO screenshot/rendered-frame tool. This is the
# highest-value gap-filler: it powers PoF's L4 visual-verification gate (an agent
# reads a rendered frame as ground truth). Requires a RENDERED editor — launch
# without -nullrhi (e.g. -RenderOffScreen); the capture is async (file appears
# within a frame or two).

import unreal

import toolset_registry


@unreal.uclass()
class PoFViewportTools(unreal.ToolsetDefinition):
    """Capture rendered frames for verification (PoF gap-filler — powers L4)."""

    @toolset_registry.tool_call
    @staticmethod
    def capture_viewport(out_path: str, res_x: int, res_y: int) -> str:
        """Capture the active viewport to a PNG at `out_path` (async).

        Needs a rendered editor (no -nullrhi). The file is written a frame or two
        later, so callers should poll for it.

        Args:
            out_path: Absolute PNG output path.
            res_x: Width in pixels.
            res_y: Height in pixels.
        Returns:
            The requested out_path (the file appears asynchronously).
        """
        unreal.AutomationLibrary.take_high_res_screenshot(res_x, res_y, out_path)
        return out_path
