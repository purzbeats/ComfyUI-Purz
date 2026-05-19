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
    from . import media_extractor as _media_extractor_routes  # noqa: F401
    from . import video_trim as _video_trim_routes  # noqa: F401
    from . import image_crop as _image_crop_routes  # noqa: F401
    from . import video_crop as _video_crop_routes  # noqa: F401

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
            from .media_extractor_v3 import MediaExtractor, MediaExtractorUpload
            from .video_trim_v3 import VideoTrim, VideoTrimUpload
            from .image_crop_v3 import ImageCrop as ImageCropV3, ImageCropUpload as ImageCropUploadV3
            from .video_crop_v3 import VideoCrop as VideoCropV3, VideoCropUpload as VideoCropUploadV3

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
                MediaExtractor,
                MediaExtractorUpload,
                VideoTrim,
                VideoTrimUpload,
                ImageCropV3,
                ImageCropUploadV3,
                VideoCropV3,
                VideoCropUploadV3,
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
