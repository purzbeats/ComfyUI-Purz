"""
ComfyUI-Purz Custom Node Pack

Supports both V1 (legacy) and V3 (modern) ComfyUI node schemas.
V3 nodes provide improved UI with proper slider controls.
"""

# Web directory for custom JavaScript extensions
WEB_DIRECTORY = "./web"

# Try to use V3 API if available, fall back to V1 otherwise
try:
    from comfy_api.latest import io, ComfyExtension

    # Import V1 interactive_filters module to register server routes
    # (routes are registered at import time via decorators)
    from . import interactive_filters as _interactive_filters_routes  # noqa: F401

    # V3 is available - define the combined extension
    class PurzExtension(ComfyExtension):
        """V3 Extension containing all Purz nodes with slider UI."""

        async def get_node_list(self) -> list[type[io.ComfyNode]]:
            # Import V3 node classes
            from .image_effects_v3 import (
                ImageToBlackWhite, ImageRotate, ImageBlur,
                ColorAdjust, ImageFlip, Pixelate, EdgeDetect
            )
            from .pattern_generators_v3 import (
                CheckerboardPattern, StripesPattern, PolkaDotPattern,
                GridPattern, SimpleNoisePattern, HexagonPattern, GradientPattern
            )
            from .animated_patterns_v3 import (
                AnimatedCheckerboardPattern, AnimatedStripesPattern,
                AnimatedPolkaDotPattern, AnimatedNoisePattern
            )
            from .interactive_filters_v3 import InteractiveImageFilter

            return [
                # Image Effects
                ImageToBlackWhite,
                ImageRotate,
                ImageBlur,
                ColorAdjust,
                ImageFlip,
                Pixelate,
                EdgeDetect,
                # Pattern Generators
                CheckerboardPattern,
                StripesPattern,
                PolkaDotPattern,
                GridPattern,
                SimpleNoisePattern,
                HexagonPattern,
                GradientPattern,
                # Animated Patterns
                AnimatedCheckerboardPattern,
                AnimatedStripesPattern,
                AnimatedPolkaDotPattern,
                AnimatedNoisePattern,
                # Interactive
                InteractiveImageFilter,
            ]

    async def comfy_entrypoint() -> PurzExtension:
        """V3 entry point for the extension system."""
        return PurzExtension()

    # Don't export NODE_CLASS_MAPPINGS when V3 is available
    # This forces ComfyUI to use the V3 entrypoint
    __all__ = ["WEB_DIRECTORY", "comfy_entrypoint"]

except ImportError:
    # V3 API not available - fall back to V1
    from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

    __all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
