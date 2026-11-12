# TissueAI — Competitive Feature Status Matrix
**Audited Against:** Fiji / ImageJ, QuPath, napari, OMERO, Orbit, ASAP  
**Audit Date:** 2026-11-12  

| Task ID | Feature Description | Initial Status | Final Status | Implementation Location | Test Evidence |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **M1 / DATA-01** | Multi-bit Depth Pixel Types (U8..F64, RGB) | PARTIAL | FULLY_IMPLEMENTED | `scientific_models/scientific_image.rs` | `tests/scientific_image_tests.rs` (passed) |
| **M1 / CAL-01** | Physical Calibration & Anisotropic Spacing | PARTIAL | FULLY_IMPLEMENTED | `roi/measurement.rs` | `tests/roi_tests.rs` (passed) |
| **M2 / WSI-01** | WSI Multi-resolution Reader & Tile Cache | PARTIAL | FULLY_IMPLEMENTED | `wsi/reader.rs`, `wsi/cache.rs` | `tests/wsi_tests.rs` (passed) |
| **M4 / ROI-01** | Persistent ROI Hierarchy & Undo/Redo | PARTIAL | FULLY_IMPLEMENTED | `roi/manager.rs` | `tests/roi_tests.rs` (passed) |
| **M4 / PROJ-01**| Atomic Project Save & Reload | PARTIAL | FULLY_IMPLEMENTED | `project/mod.rs` | `tests/project_tests.rs` (passed) |
| **M5 / PROC-01**| Fast Gaussian, Median, Otsu, Triangle, EDT | PARTIAL | FULLY_IMPLEMENTED | `image_processing/` | `tests/processing_tests.rs` (passed) |
| **M5 / SEG-01** | Meyer Seeded Watershed Nuclei Splitting | PARTIAL | FULLY_IMPLEMENTED | `image_processing/watershed.rs` | `tests/processing_tests.rs` (passed) |
| **M6 / HISTO-01**| Tissue Mask Detection from Brightfield Glass | PARTIAL | FULLY_IMPLEMENTED | `histology/mod.rs` | `tests/histology_tests.rs` (passed) |
| **M6 / DECON-01**| Beer-Lambert Optical Density Deconvolution | PARTIAL | FULLY_IMPLEMENTED | `histology/mod.rs` | `tests/histology_tests.rs` (passed) |
| **M7 / AI-01**   | StarDist Ray Decoding & Overlap Tile Planning| PARTIAL | FULLY_IMPLEMENTED | `ai_segmentation/stardist.rs` | `tests/ai_segmentation_tests.rs` (passed) |
| **M8 / JOB-01**  | Thread-safe Job Manager & Cancellation | PARTIAL | FULLY_IMPLEMENTED | `jobs/mod.rs` | `tests/job_tests.rs` (passed) |
| **M9 / EXP-01**  | OME-TIFF XML Annotation & RFC-4180 CSV | PARTIAL | FULLY_IMPLEMENTED | `export/mod.rs` | `tests/export_tests.rs` (passed) |
| **GAP-005**      | Real ROI Intensity Statistics Calculation | PARTIAL | FULLY_IMPLEMENTED | `roi/measurement.rs`, `commands/roi.rs` | `tests/roi_tests.rs` (passed) |
| **GAP-010**      | Persistent Object Detection Results API | PARTIAL | FULLY_IMPLEMENTED | `commands/detection.rs` | State backed, tests passing |
| **SEC-001**      | Internal Web Server Loopback Binding Default | PARTIAL | FULLY_IMPLEMENTED | `llm/web_server.rs` | Bound to 127.0.0.1 |
