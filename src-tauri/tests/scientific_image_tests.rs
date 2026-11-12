use std::collections::HashMap;
use tissueai_lib::scientific_models::scientific_image::{
    AssetKind, Axis, AxisOrder, CalibrationSource, ChannelMetadata, ColorModel, ImageAsset,
    ImageDimensions, MetadataRecord, NormalizedMetadata, PixelType, RawMetadata,
    SpatialCalibration, TypedPixelBuffer,
};

#[test]
fn test_spatial_calibration_physical_units() {
    // 1. Uncalibrated default check
    let uncal = SpatialCalibration::uncalibrated();
    assert!(!uncal.is_calibrated);
    assert_eq!(uncal.unit_name, "px");
    assert_eq!(uncal.source, CalibrationSource::Unknown);
    assert_eq!(uncal.format_distance(50.0), "50.0 px");
    assert_eq!(uncal.format_area(100.0), "100.0 px²");

    // 2. Calibrated microns check (0.25 µm per pixel - typical 40x scan)
    let cal = SpatialCalibration::new_microns(0.25);
    assert!(cal.is_calibrated);
    assert_eq!(cal.unit_name, "µm");
    assert_eq!(cal.source, CalibrationSource::UserDefined);

    // 100 pixels should equal 25 µm
    let (phys_x, phys_y) = cal.pixel_to_physical(100.0, 200.0);
    assert!((phys_x - 25.0).abs() < 1e-6);
    assert!((phys_y - 50.0).abs() < 1e-6);

    // Inverse physical to pixel
    let (px, py) = cal.physical_to_pixel(25.0, 50.0);
    assert!((px - 100.0).abs() < 1e-6);
    assert!((py - 200.0).abs() < 1e-6);

    // Calibrated distance calculation (300 px dx, 400 px dy -> 500 px * 0.25 = 125 µm)
    let dist = cal.calculate_calibrated_distance(300.0, 400.0);
    assert!((dist - 125.0).abs() < 1e-6);

    // Area calculation (10,000 px^2 * 0.0625 = 625 µm^2)
    let area = cal.calculate_calibrated_area(10000.0);
    assert!((area - 625.0).abs() < 1e-6);
    assert_eq!(cal.format_area(10000.0), "625.00 µm²");

    // 3. Anisotropic calibration check (e.g. electron microscopy or confocal with different x/y step)
    let aniso = SpatialCalibration::new_anisotropic(0.2, 0.4, Some(1.0), "µm", CalibrationSource::Metadata);
    assert!(aniso.is_calibrated);
    assert_eq!(aniso.source, CalibrationSource::Metadata);
    let aniso_area = aniso.calculate_calibrated_area(100.0);
    assert!((aniso_area - (100.0 * 0.2 * 0.4)).abs() < 1e-6);
    assert_eq!(aniso.format_area(100.0), "8.00 µm²");
}

#[test]
fn test_pixel_type_properties_and_buffer_conversions() {
    // 1. PixelType properties
    assert_eq!(PixelType::U8.bytes_per_sample(), 1);
    assert_eq!(PixelType::U16.bytes_per_sample(), 2);
    assert_eq!(PixelType::I16.bytes_per_sample(), 2);
    assert_eq!(PixelType::U32.bytes_per_sample(), 4);
    assert_eq!(PixelType::I32.bytes_per_sample(), 4);
    assert_eq!(PixelType::F32.bytes_per_sample(), 4);
    assert_eq!(PixelType::F64.bytes_per_sample(), 8);
    assert_eq!(PixelType::Rgb24.bytes_per_pixel(), 3);
    assert_eq!(PixelType::Rgba32.bytes_per_pixel(), 4);

    assert!(PixelType::I16.is_signed());
    assert!(!PixelType::U16.is_signed());
    assert!(PixelType::F32.is_floating_point());
    assert!(PixelType::I16.is_integer());

    // 2. I16 buffer test (M1-01 critical requirement)
    let i16_samples = vec![-1000i16, -500, 0, 500, 1000];
    let i16_buffer = TypedPixelBuffer::I16(i16_samples.clone());
    assert_eq!(i16_buffer.pixel_type(), PixelType::I16);
    assert_eq!(i16_buffer.len(), 5);
    assert_eq!(i16_buffer.byte_size(), 10);

    let (min, max, mean, std_dev) = i16_buffer.compute_statistics();
    assert_eq!(min, -1000.0);
    assert_eq!(max, 1000.0);
    assert_eq!(mean, 0.0);
    assert!(std_dev > 0.0);

    // 3. Normalization to 0..255 for display
    let u8_norm = i16_buffer.to_u8_normalized();
    assert_eq!(u8_norm.len(), 5);
    assert_eq!(u8_norm[0], 0);   // -1000 -> 0
    assert_eq!(u8_norm[2], 128); // 0 -> 128
    assert_eq!(u8_norm[4], 255); // 1000 -> 255

    // 4. Little-Endian serialization & deserialization round-trip
    let le_bytes = i16_buffer.to_bytes_le();
    assert_eq!(le_bytes.len(), 10);
    let decoded_buffer = TypedPixelBuffer::from_bytes_le(PixelType::I16, &le_bytes).expect("Decode I16 failed");
    for i in 0..5 {
        assert_eq!(decoded_buffer.get_sample_f64(i), Some(i16_samples[i] as f64));
    }

    // 5. F32 buffer test
    let f32_samples = vec![0.0f32, 0.25, 0.5, 0.75, 1.0];
    let f32_buffer = TypedPixelBuffer::F32(f32_samples);
    let (f_min, f_max, f_mean, _) = f32_buffer.compute_statistics();
    assert_eq!(f_min, 0.0);
    assert_eq!(f_max, 1.0);
    assert!((f_mean - 0.5).abs() < 1e-6);

    let f32_bytes = f32_buffer.to_bytes_le();
    let decoded_f32 = TypedPixelBuffer::from_bytes_le(PixelType::F32, &f32_bytes).expect("Decode F32 failed");
    assert_eq!(decoded_f32.len(), 5);
    assert_eq!(decoded_f32.get_sample_f64(4), Some(1.0));
}

#[test]
fn test_axis_model_strides_and_transposition() {
    // 1. Dimensions and coordinates round-trip
    let dims = ImageDimensions::new_5d(10, 20, 3, 5, 2, AxisOrder::XYCZT);
    assert_eq!(dims.width, 10);
    assert_eq!(dims.height, 20);
    assert_eq!(dims.channels, 3);
    assert_eq!(dims.z_slices, 5);
    assert_eq!(dims.time_points, 2);
    assert_eq!(dims.total_pixels_per_plane().unwrap(), 200);
    assert_eq!(dims.total_samples().unwrap(), 10 * 20 * 3 * 5 * 2);

    let idx = dims.linear_index(4, 7, 2, 3, 1).expect("Valid index");
    let (rx, ry, rc, rz, rt) = dims.coords_from_index(idx);
    assert_eq!((rx, ry, rc, rz, rt), (4, 7, 2, 3, 1));

    // Stride inspection
    let stride_x = dims.stride_for_axis(Axis::X);
    assert_eq!(stride_x, 1);
    let stride_y = dims.stride_for_axis(Axis::Y);
    assert_eq!(stride_y, 10);
    let stride_c = dims.stride_for_axis(Axis::Channel);
    assert_eq!(stride_c, 10 * 20);

    // 2. Transposition test: convert from planar (CXY) to interleaved/canonical (XYC)
    let planar_dims = ImageDimensions {
        width: 4,
        height: 4,
        channels: 2,
        z_slices: 1,
        time_points: 1,
        axis_order: AxisOrder::CXY,
    };
    assert_eq!(planar_dims.total_samples().unwrap(), 32);

    // Fill sample buffer where val = channel * 100 + y * 10 + x
    let mut samples = vec![0.0f64; 32];
    for c in 0..2 {
        for y in 0..4 {
            for x in 0..4 {
                let idx = planar_dims.linear_index(x, y, c, 0, 0).expect("linear index");
                samples[idx] = (c * 100 + y * 10 + x) as f64;
            }
        }
    }

    let (canonical_dims, canonical_samples) = planar_dims
        .transpose_to_canonical(&samples)
        .expect("Transposition failed");

    assert_eq!(canonical_dims.axis_order, AxisOrder::XYCZT);
    // Verify sample at (x=2, y=3, c=1)
    let can_idx = canonical_dims.linear_index(2, 3, 1, 0, 0).expect("can index");
    assert_eq!(canonical_samples[can_idx], 132.0); // c=1 -> 100 + y=3 -> 30 + x=2 -> 2
}

#[test]
fn test_metadata_normalization_and_provenance() {
    let mut raw_entries = HashMap::new();
    raw_entries.insert("Aperio.AppMag".to_string(), "40".to_string());
    raw_entries.insert("Aperio.MPP".to_string(), "0.2520".to_string());
    raw_entries.insert("TIFF.Make".to_string(), "Leica Biosystems".to_string());
    raw_entries.insert("TIFF.Model".to_string(), "Aperio AT2".to_string());

    let raw = RawMetadata {
        vendor_format: Some("Aperio SVS".to_string()),
        entries: raw_entries,
        raw_json: None,
    };

    let mut provenance_map = HashMap::new();
    provenance_map.insert("nominal_magnification".to_string(), "Aperio.AppMag".to_string());
    provenance_map.insert("instrument_model".to_string(), "TIFF.Model".to_string());

    let normalized = NormalizedMetadata {
        acquisition_date: Some("2026-05-18T10:30:00Z".to_string()),
        instrument_make: Some("Leica Biosystems".to_string()),
        instrument_model: Some("Aperio AT2".to_string()),
        nominal_magnification: Some(40.0),
        numerical_aperture: Some(0.75),
        exposure_time_ms: Some(15.2),
        channels: vec![ChannelMetadata {
            index: 0,
            name: "Brightfield H&E".to_string(),
            color_hex: "#FFFFFF".to_string(),
            emission_wavelength_nm: None,
        }],
        source_provenance: provenance_map,
    };

    let metadata_record = MetadataRecord { raw, normalized };

    let dims = ImageDimensions::new_2d(512, 512, 1);
    let cal = SpatialCalibration::from_metadata(0.252, 0.252, None, "µm");

    let source_asset = ImageAsset {
        asset_id: "raw-source-001".to_string(),
        asset_name: "Biopsy_H&E.svs".to_string(),
        asset_kind: AssetKind::WholeSlideImage,
        source_uri: Some("/path/to/Biopsy_H&E.svs".to_string()),
        dimensions: dims,
        pixel_type: PixelType::U8,
        calibration: cal,
        color_model: ColorModel::Grayscale,
        metadata: Some(metadata_record),
        provenance: None,
        buffer: Some(TypedPixelBuffer::U8(vec![128; 512 * 512])),
    };

    assert!(source_asset.metadata.is_some());
    let meta = source_asset.metadata.as_ref().unwrap();
    assert_eq!(meta.raw.vendor_format.as_deref(), Some("Aperio SVS"));
    assert_eq!(meta.normalized.nominal_magnification, Some(40.0));
    assert_eq!(meta.normalized.instrument_model.as_deref(), Some("Aperio AT2"));

    // Derived asset after processing
    let derived = source_asset.create_derived(
        "derived-proc-002".to_string(),
        "Biopsy_Filtered.svs".to_string(),
        TypedPixelBuffer::U8(vec![130; 512 * 512]),
        PixelType::U8,
        ColorModel::Grayscale,
        "PROC-FILTER",
        serde_json::json!({ "sigma": 1.5 }),
    );

    assert_eq!(derived.asset_kind, AssetKind::DerivedImage);
    assert!(derived.provenance.is_some());
    let prov = derived.provenance.unwrap();
    assert_eq!(prov.parent_asset_id, Some("raw-source-001".to_string()));
    assert_eq!(prov.operation_id, "PROC-FILTER");
    assert_eq!(prov.parameters["sigma"], 1.5);
    // Derived asset retains metadata reference
    assert!(derived.metadata.is_some());
}
