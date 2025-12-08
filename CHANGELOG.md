# Changelog

All notable changes to ComfyUI-Purz are documented here. This includes every change, even ephemeral ones that may break things.

## [Unreleased]

## [1.3.0] - 2025-12-08

### Added
- Video batch processing support for Interactive Image Filter
- Built-in playback controls with play/pause button
- Frame scrubber slider for video preview
- Adjustable FPS selector (6, 8, 12, 16, 24, 30, 48, 60 fps)
- Real-time filter preview while scrubbing through video frames
- Backend-frontend synchronization using WebSocket events (`purz.batch_pending`)
- Polling fallback for reliable event delivery
- Chunked upload system (10 frames per request) for large video batches
- `PURZ_BATCH_PENDING` and `PURZ_BATCH_READY` global state dictionaries
- `/purz/interactive/set_rendered_batch` endpoint with chunk support
- `/purz/interactive/batch_pending/{node_id}` endpoint for polling

### Changed
- Backend `process()` method now waits for frontend WebGL processing to complete
- Frame upload endpoint accepts `chunk_index`, `total_chunks`, and `is_final` parameters

### Fixed
- Node ID lookup now tries both string and parseInt versions for `app.graph._nodes_by_id`
- Large batch uploads no longer fail with `HTTPRequestEntityTooLarge` error

## [1.2.0] - 2025-12-08

### Added
- Preset system for Interactive Image Filter
- 25 built-in professional presets across 6 categories
- Save custom presets as JSON files in `presets/` folder
- Load presets via dropdown menu
- Presets are portable and shareable

## [1.1.0] - 2025-12-07

### Added
- Interactive Image Filter node
- 42 filter effects across 8 categories (Basic, Color, Tone, Detail, Effects, Artistic, Creative, Lens)
- Real-time WebGL preview
- Layer system with per-layer opacity control
- Save button to export filtered images

## [1.0.1] - Initial Release

### Added
- Image effects nodes (Black & White, Rotate, Flip, Blur, Pixelate, Edge Detection, Color Adjust)
- Pattern generation nodes (Checkerboard, Stripes, Polka Dots, Grid, Gradient, Noise)
- Animated pattern nodes (Animated Checkerboard, Stripes, Polka Dots, Noise)
- Mathematical operations for texture combination
- Wave generation with multiple types and directions
- Color ramp interpolation methods
