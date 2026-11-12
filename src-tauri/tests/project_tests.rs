use tissueai_lib::project::{TissueAiProject, ImageAssetRef, DatasetRef, PROJECT_SCHEMA_VERSION, PROJECT_FILE_NAME};
use tissueai_lib::scientific_models::{SpatialCalibration, CalibrationSource};
use tissueai_lib::roi::manager::RoiItem;
use tissueai_lib::roi::geometry::RoiShape;

#[test]
fn test_project_creation_and_atomic_persistence() {
    let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
    let dir_path = temp_dir.path();

    let mut project = TissueAiProject::new("Study_01_Carcinoma", Some("Biopsy analysis study".to_string()));
    assert_eq!(project.name, "Study_01_Carcinoma");
    assert_eq!(project.schema_version, PROJECT_SCHEMA_VERSION);
    assert_eq!(project.datasets.len(), 1);

    let calib = SpatialCalibration::new_microns(0.495);
    let img_ref = ImageAssetRef {
        id: "img_001".to_string(),
        filename: "slide_001.svs".to_string(),
        original_path: "/data/slides/slide_001.svs".to_string(),
        relative_storage_path: None,
        width: 40000,
        height: 30000,
        channels: 3,
        is_pyramidal: true,
        calibration: calib,
        rois: vec![RoiItem {
            id: "roi_test".to_string(),
            name: "Tumor Bed".to_string(),
            shape: RoiShape::Rectangle { x: 100.0, y: 100.0, width: 500.0, height: 400.0 },
            color: "#ff0000".to_string(),
            group_name: "Tumor".to_string(),
            slide_id: Some("img_001".to_string()),
            parent_id: None,
            class_id: Some("cls_tumor".to_string()),
            class_name: Some("Invasive Ductal Carcinoma".to_string()),
            tags: vec!["IDC".to_string()],
            is_locked: true,
            notes: Some("High-grade region".to_string()),
            is_visible: true,
            measurements: None,
        }],
        metadata: None,
    };

    project.add_image(img_ref, None);
    assert_eq!(project.images.len(), 1);
    assert!(project.datasets[0].image_ids.contains(&"img_001".to_string()));

    // Save project atomically
    let saved_path = project.save_to_directory(dir_path).expect("Failed to save project");
    assert!(saved_path.exists());
    assert_eq!(saved_path.file_name().unwrap(), PROJECT_FILE_NAME);

    // Reopen and verify data round-trip
    let loaded = TissueAiProject::load_from_directory(dir_path).expect("Failed to load project");
    assert_eq!(loaded.name, "Study_01_Carcinoma");
    assert_eq!(loaded.images.len(), 1);
    assert_eq!(loaded.images[0].filename, "slide_001.svs");
    assert_eq!(loaded.images[0].rois.len(), 1);
    assert_eq!(loaded.images[0].rois[0].name, "Tumor Bed");
    assert_eq!(loaded.images[0].rois[0].is_locked, true);
    assert_eq!(loaded.images[0].rois[0].class_name.as_deref(), Some("Invasive Ductal Carcinoma"));
    assert_eq!(loaded.images[0].calibration.source, CalibrationSource::UserDefined);
}

