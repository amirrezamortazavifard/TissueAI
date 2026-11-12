use tissueai_lib::scientific_models::scientific_image::{
    AssetKind, ColorModel, ImageAsset, ImageDimensions, PixelType, SpatialCalibration,
    TypedPixelBuffer,
};

#[test]
fn test_spatial_calibration_physical_units() {
    // 0.25 µm per pixel (typical 40x whole slide scanner resolution)
    let cal = SpatialCalibration::new_microns(0.25);
    assert!(cal.is_calibrated);
    assert_eq!(cal.unit_name, "µm");

    // 100 pixels should equal 25 µm
    let (phys_x, phys_y) = cal.pixel_to_physical(100.0, 200.0);
    assert!((phys_x - 25.0).abs() < 1e-6);
    assert!((phys_y - 50.0).abs() < 1e-6);

    // Distance calculation
    let dist = cal.calculate_calibrated_distance(300.0, 400.0);
    assert!((dist - 125.0).abs() < 1e-6); // 500 px * 0.25 = 125 µm

    // Area calculation (10,000 px^2 * 0.0625 = 625 µm^2)
    let area = cal.calculate_calibrated_area(10000.0);
    assert!((area - 625.0).abs() < 1e-6);
    assert_eq!(cal.format_area(10000.0), "625.00 µm²");
}

#[test]
fn test_typed_pixel_buffer_statistics_and_histogram() {
    let raw_data: Vec<u8> = (0..=255).collect();
    let buffer = TypedPixelBuffer::U8(raw_data);

    let (min, max, mean, _std_dev) = buffer.compute_statistics();
    assert_eq!(min, 0.0);
    assert_eq!(max, 255.0);
    assert!((mean - 127.5).abs() < 1e-6);

    let (bins, hist_min, hist_max) = buffer.compute_histogram(16);
    assert_eq!(bins.len(), 16);
    assert_eq!(hist_min, 0.0);
    assert_eq!(hist_max, 255.0);
    let total_counted: u32 = bins.iter().sum();
    assert_eq!(total_counted, 256);
}

#[test]
fn test_image_asset_provenance_lineage() {
    let dims = ImageDimensions::new_2d(512, 512, 1);
    let cal = SpatialCalibration::new_microns(0.5);

    let source_asset = ImageAsset {
        asset_id: "raw-source-001".to_string(),
        asset_name: "Biopsy_H&E.tif".to_string(),
        asset_kind: AssetKind::SourceRaster,
        source_uri: Some("/path/to/Biopsy_H&E.tif".to_string()),
        dimensions: dims,
        pixel_type: PixelType::U8,
        calibration: cal,
        color_model: ColorModel::Grayscale,
        provenance: None,
        buffer: Some(TypedPixelBuffer::U8(vec![128; 512 * 512])),
    };

    // Derived asset after Gaussian Blur (PROC-02)
    let derived = source_asset.create_derived(
        "derived-proc-002".to_string(),
        "Biopsy_Blurred.tif".to_string(),
        TypedPixelBuffer::U8(vec![130; 512 * 512]),
        PixelType::U8,
        ColorModel::Grayscale,
        "PROC-02",
        serde_json::json!({ "sigma": 2.0, "kernel_size": 5 }),
    );

    assert_eq!(derived.asset_kind, AssetKind::DerivedImage);
    assert!(derived.provenance.is_some());
    let prov = derived.provenance.unwrap();
    assert_eq!(prov.parent_asset_id, Some("raw-source-001".to_string()));
    assert_eq!(prov.operation_id, "PROC-02");
    assert_eq!(prov.parameters["sigma"], 2.0);
}

