# TissueAI — Remaining Work & Roadmap Extensions
**Date:** 2026-11-12  
**Status:** M0–M11 Verified & Shipped. The tasks below represent future long-term extensions.

---

## 1. Optional Extensions Catalog (from `options.md` and Deep Audit)

| Category | Capability ID | Description | Dependencies / Blocker | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **IO** | `IO-002` | DICOM Whole Slide Microscopy (SOP Class support) | Requires DICOM Part 10 parser & test DICOM WSI dataset | P2 |
| **IO** | `IO-001` | OME-Zarr NGFF Reader/Writer (Zarr v2/v3 multiscale) | Local filesystem supported; remote cloud S3 requires opt-in network creds | P2 |
| **TRACK** | `TRACK-01..23` | 4D Live-Cell Particle Tracking (LAP / TrackMate algorithm) | Temporal fluorescence microscopy series dataset | P3 |
| **SNT** | `SNT-01..15` | Simple Neurite Tracer (3D neuronal axon/dendrite tracing) | High-resolution confocal volumetric stacks | P3 |
| **BONE** | `BONE-01..12` | BoneJ Micro-CT trabecular bone morphometry | Volumetric 3D micro-CT data | P3 |
| **SECURITY** | `SEC-004` | Complete migration from AES-CBC legacy model loader to AES-GCM / XChaCha20 | Requires re-encrypting existing model fixtures with new format | P1 |

---

## 2. Maintenance and Deployment Next Steps

1. **Native OpenSlide C-Binding Packaging**:
   - When deploying to platforms without pre-installed `libopenslide-0.dll` / `libopenslide.so`, package the dynamic library alongside the Tauri bundle.
2. **GPU Acceleration Backend**:
   - DirectML / CUDA execution providers for the ONNX Runtime adapter on compatible client systems.
