# ComfyUI-Purz Development Plan

## Roadmap

### Interactive Image Filter Enhancements

- [x] **Custom WebGL Effects** - Break out Interactive Image Filter effects into separate shader files, allowing users to create and share their own custom WebGL effects
  - Shaders extracted to `shaders/` directory by category
  - Custom shaders go in `shaders/custom/` with optional .json metadata
  - Template provided at `shaders/custom/_template.glsl`
- [ ] **Mask Support** - Apply filter effects selectively using masks
- [ ] **More Effects** - Expand the library of available WebGL filter effects
- [ ] **Layer Reordering** - Drag and drop to re-arrange effect layers
