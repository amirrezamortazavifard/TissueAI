use std::path::Path;
use std::fs::File;
use std::io::Write;
use serde::{Deserialize, Serialize};
use crate::roi::manager::RoiItem;
use crate::roi::geometry::RoiShape;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportAuditMetadata {
    pub exported_at: String,
    pub exporter_version: String,
    pub source_slide_id: Option<String>,
    pub item_count: usize,
}

pub struct Exporter;

impl Exporter {
    /// Export ROIs as standard OME-TIFF / Bio-Formats compatible XML annotations
    pub fn export_ome_xml(rois: &[RoiItem]) -> String {
        let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.push_str("<OME xmlns=\"http://www.openmicroscopy.org/Schemas/OME/2016-06\"\n");
        xml.push_str("     xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n");
        
        for item in rois {
            xml.push_str(&format!("  <ROI ID=\"ROI:{}\">\n", item.id));
            xml.push_str("    <Union>\n");

            match &item.shape {
                RoiShape::Rectangle { x, y, width, height } => {
                    xml.push_str(&format!(
                        "      <Rectangle X=\"{:.2}\" Y=\"{:.2}\" Width=\"{:.2}\" Height=\"{:.2}\" StrokeColor=\"{}\" Text=\"{}\"/>\n",
                        x, y, width, height, item.color, item.name
                    ));
                }
                RoiShape::Ellipse { center_x, center_y, radius_x, radius_y } => {
                    xml.push_str(&format!(
                        "      <Ellipse X=\"{:.2}\" Y=\"{:.2}\" RadiusX=\"{:.2}\" RadiusY=\"{:.2}\" StrokeColor=\"{}\" Text=\"{}\"/>\n",
                        center_x, center_y, radius_x, radius_y, item.color, item.name
                    ));
                }
                RoiShape::Point { point } => {
                    xml.push_str(&format!(
                        "      <Point X=\"{:.2}\" Y=\"{:.2}\" StrokeColor=\"{}\" Text=\"{}\"/>\n",
                        point.x, point.y, item.color, item.name
                    ));
                }
                RoiShape::Polygon { points } => {
                    let pts_str = points.iter().map(|p| format!("{:.1},{:.1}", p.x, p.y)).collect::<Vec<_>>().join(" ");
                    xml.push_str(&format!(
                        "      <Polygon Points=\"{}\" StrokeColor=\"{}\" Text=\"{}\"/>\n",
                        pts_str, item.color, item.name
                    ));
                }
                RoiShape::Polyline { points } => {
                    let pts_str = points.iter().map(|p| format!("{:.1},{:.1}", p.x, p.y)).collect::<Vec<_>>().join(" ");
                    xml.push_str(&format!(
                        "      <Polyline Points=\"{}\" StrokeColor=\"{}\" Text=\"{}\"/>\n",
                        pts_str, item.color, item.name
                    ));
                }
                RoiShape::MultiPoint { points } => {
                    for (idx, pt) in points.iter().enumerate() {
                        xml.push_str(&format!(
                            "      <Point ID=\"{}_{}\" X=\"{:.2}\" Y=\"{:.2}\" StrokeColor=\"{}\"/>\n",
                            item.id, idx, pt.x, pt.y, item.color
                        ));
                    }
                }
            }

            xml.push_str("    </Union>\n");
            xml.push_str("  </ROI>\n");
        }

        xml.push_str("</OME>\n");
        xml
    }

    /// Export measurements to standard RFC-4180 CSV
    pub fn export_measurements_csv(rois: &[RoiItem]) -> String {
        let mut csv = String::from("id,name,class_name,area_px,area_physical,perimeter_px,perimeter_physical,circularity,unit\n");
        for item in rois {
            let (area_px, area_phys, perim_px, perim_phys, circ, unit) = if let Some(m) = &item.measurements {
                (
                    m.area_px.to_string(),
                    format!("{:.4}", m.area_physical),
                    m.perimeter_px.to_string(),
                    format!("{:.4}", m.perimeter_physical),
                    format!("{:.4}", m.circularity),
                    m.unit_name.clone(),
                )
            } else {
                (String::new(), String::new(), String::new(), String::new(), String::new(), "px".to_string())
            };

            csv.push_str(&format!(
                "\"{}\",\"{}\",\"{}\",{},{},{},{},{},\"{}\"\n",
                item.id,
                item.name.replace('\"', "\"\""),
                item.class_name.as_deref().unwrap_or("Unclassified").replace('\"', "\"\""),
                area_px,
                area_phys,
                perim_px,
                perim_phys,
                circ,
                unit
            ));
        }
        csv
    }

    /// Save content atomically to disk
    pub fn save_atomic(path: &Path, content: &str) -> Result<(), String> {
        let temp_path = path.with_extension("tmp");
        {
            let mut file = File::create(&temp_path).map_err(|e| e.to_string())?;
            file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
        }
        std::fs::rename(&temp_path, path).map_err(|e| e.to_string())?;
        Ok(())
    }
}

