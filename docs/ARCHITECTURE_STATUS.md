# TissueAI — Architecture Status
**Date:** 2026-11-12  
**Architecture Paradigm:** Tauri 2.x + Native Rust Scientific Domain + React 19 Frontend  

---

## 1. Architectural Principles

1. **Rust Owns the Compute**:
   - Heavy scientific computing (EDT, Watershed, Convolution, Deconvolution, StarDist decode, NMS, and file I/O) runs strictly in the Rust backend.
   - Frontend is restricted to UI rendering, user interaction, canvas manipulation, and viewport management.
2. **Deterministic, Calibrated Science**:
   - No arbitrary units or fabricated calibration constants. Measurements default strictly to pixels unless valid calibration metadata is present.
   - Anisotropic physical pixel spacing ($dx \neq dy$) is respected in all area and perimeter calculations.
3. **Data Safety by Default**:
   - Non-destructive processing: transformations yield derived assets (`create_derived()`) preserving original raw buffers.
   - Atomic disk writes: projects and annotations use write-then-rename patterns to guarantee zero corruption on power loss.
4. **Security Boundaries**:
   - Content Security Policy (CSP) is explicitly enforced in `tauri.conf.json`.
   - Web Server listeners bind strictly to `127.0.0.1` unless explicitly instructed to enable LAN mode.

---

## 2. Component Architecture

```
TissueAI/
├── src/                                  # React 19 / TypeScript 5.6
│   ├── components/tools/                 # Scientific analysis tools (Detection, Color, Editor, etc.)
│   ├── types/                            # Domain contracts (scientific-image, wsi, roi, job, project)
│   └── lib/                              # UI client adapters
│
├── src-tauri/src/                        # Native Rust backend
│   ├── scientific_models/                # N-D Axis, Typed Pixel Buffer, Calibration domain
│   ├── wsi/                              # Pyramidal tile reader & LRU Cache
│   ├── roi/                              # Geometry, Hierarchy, Measurements & Undo/Redo
│   ├── image_processing/                 # Filters, Thresholding, Distance Transform & Watershed
│   ├── histology/                        # Tissue detection, Beer-Lambert deconvolution, Morphometry
│   ├── ai_segmentation/                  # StarDist inference decoder & tile planning
│   ├── jobs/                             # Thread-safe job manager & cancellation tokens
│   ├── project/                          # Unified project persistence & dataset models
│   ├── export/                           # OME-TIFF XML and CSV generation
│   ├── registration/                     # Affine registration & landmark fitting
│   ├── spatial_analysis/                 # Colocalization (Pearson/Manders) & Directionality
│   ├── skeleton/                         # Zhang-Suen thinning & branch graph analysis
│   └── workflow/                         # Pipeline recording & audit reporting
```
