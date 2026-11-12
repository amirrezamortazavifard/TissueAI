use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub format: String,
    pub project_name: String,
    pub output_dir: String,
    pub epochs: usize,
    pub batch_size: usize,
    pub image_size: usize,
    pub learning_rate: f32,
    pub model_type: String,
    pub train_ratio: f32,
    pub val_ratio: f32,
}

impl Default for ExportSettings {
    fn default() -> Self {
        Self {
            format: "yolo".to_string(),
            project_name: "dataset".to_string(),
            output_dir: String::new(),
            epochs: 50,
            batch_size: 16,
            image_size: 640,
            learning_rate: 0.001,
            model_type: "yolov8n".to_string(),
            train_ratio: 0.7,
            val_ratio: 0.2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BBoxAnnotation {
    pub class_id: usize,
    pub x_center: f32,
    pub y_center: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAnnotations {
    pub file_name: String,
    pub image_width: u32,
    pub image_height: u32,
    pub annotations: Vec<BBoxAnnotation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetClass {
    pub id: usize,
    pub name: String,
}

fn shuffle_and_split<T: Clone>(items: &mut Vec<T>, train_r: f32, val_r: f32) -> (Vec<T>, Vec<T>, Vec<T>) {
    use rand::seq::SliceRandom;
    let mut rng = rand::thread_rng();
    items.shuffle(&mut rng);

    let n = items.len();
    let train_n = (n as f32 * train_r).ceil() as usize;
    let val_n = (n as f32 * val_r).floor() as usize;

    let val_end = train_n + val_n;
    let test = items[val_end..].to_vec();
    let val = items[train_n..val_end].to_vec();
    let train = items[..train_n].to_vec();
    (train, val, test)
}

#[allow(dead_code)]
fn write_yolo_label(path: &Path, annotations: &[BBoxAnnotation]) -> std::io::Result<()> {
    let mut content = String::new();
    for a in annotations {
        content.push_str(&format!(
            "{} {:.6} {:.6} {:.6} {:.6}\n",
            a.class_id, a.x_center, a.y_center, a.width, a.height
        ));
    }
    std::fs::write(path, content)
}

fn write_pascal_voc_xml(
    path: &Path,
    file_name: &str,
    width: u32,
    height: u32,
    annotations: &[BBoxAnnotation],
    class_names: &[DatasetClass],
) -> std::io::Result<()> {
    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<annotation>\n");
    xml.push_str(&format!("  <filename>{}</filename>\n", file_name));
    xml.push_str(&format!("  <size>\n    <width>{}</width>\n    <height>{}</height>\n    <depth>3</depth>\n  </size>\n", width, height));

    for a in annotations {
        let class_name = class_names.get(a.class_id).map(|c| c.name.as_str()).unwrap_or("unknown");
        let xmin = ((a.x_center - a.width / 2.0) * width as f32).max(0.0) as i32;
        let ymin = ((a.y_center - a.height / 2.0) * height as f32).max(0.0) as i32;
        let xmax = ((a.x_center + a.width / 2.0) * width as f32).min(width as f32) as i32;
        let ymax = ((a.y_center + a.height / 2.0) * height as f32).min(height as f32) as i32;
        xml.push_str(&format!(
            "  <object>\n    <name>{}</name>\n    <bndbox>\n      <xmin>{}</xmin>\n      <ymin>{}</ymin>\n      <xmax>{}</xmax>\n      <ymax>{}</ymax>\n    </bndbox>\n  </object>\n",
            class_name, xmin, ymin, xmax, ymax
        ));
    }
    xml.push_str("</annotation>\n");
    std::fs::write(path, xml)
}

pub fn export_yolo_dataset(
    images: &[ImageAnnotations],
    classes: &[DatasetClass],
    settings: &ExportSettings,
) -> Result<String, String> {
    let base = Path::new(&settings.output_dir).join(&settings.project_name);
    let images_dir = base.join("images");
    let labels_dir = base.join("labels");

    for split in &["train", "val", "test"] {
        std::fs::create_dir_all(images_dir.join(split)).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(labels_dir.join(split)).map_err(|e| e.to_string())?;
    }

    let mut annotated: Vec<ImageAnnotations> = images.iter()
        .filter(|i| !i.annotations.is_empty())
        .cloned()
        .collect();

    let (train, val, test) = shuffle_and_split(&mut annotated, settings.train_ratio, settings.val_ratio);

    for (split_name, split_data) in [("train", &train), ("val", &val), ("test", &test)] {
        for img in split_data {
            let stem = Path::new(&img.file_name).file_stem().unwrap().to_str().unwrap();
            let label_content: String = img.annotations.iter().map(|a| {
                format!("{} {:.6} {:.6} {:.6} {:.6}\n", a.class_id, a.x_center, a.y_center, a.width, a.height)
            }).collect();
            std::fs::write(
                labels_dir.join(split_name).join(format!("{}.txt", stem)),
                label_content,
            ).map_err(|e| e.to_string())?;
        }
    }

    let class_names: Vec<String> = classes.iter().map(|c| c.name.clone()).collect();
    let yaml = format!(
        "train: ./images/train\nval: ./images/val\ntest: ./images/test\n\nnc: {}\nnames: {:?}\n",
        classes.len(), class_names
    );
    std::fs::write(base.join("data.yaml"), yaml).map_err(|e| e.to_string())?;

    let train_script = generate_yolo_train_script(settings, base.to_str().unwrap());
    std::fs::write(base.join("train_yolo.py"), train_script).map_err(|e| e.to_string())?;

    let reqs = "torch\ntorchvision\nultralytics\n";
    std::fs::write(base.join("requirements.txt"), reqs).map_err(|e| e.to_string())?;

    let readme = format!(
        "# {} YOLO Dataset\n\nGenerated by TissueAI.\n\n## Classes\n{}\n\n## Usage\n```bash\npip install -r requirements.txt\npython train_yolo.py\n```\n",
        settings.project_name,
        classes.iter().map(|c| format!("- {}: {}", c.id, c.name)).collect::<Vec<_>>().join("\n")
    );
    std::fs::write(base.join("README.md"), readme).map_err(|e| e.to_string())?;

    Ok(base.to_str().unwrap().to_string())
}

pub fn export_pytorch_dataset(
    images: &[ImageAnnotations],
    classes: &[DatasetClass],
    settings: &ExportSettings,
) -> Result<String, String> {
    let base = Path::new(&settings.output_dir).join(&settings.project_name);
    let images_dir = base.join("images");
    let labels_dir = base.join("labels");
    let outputs_dir = base.join("outputs");

    for split in &["train", "val"] {
        std::fs::create_dir_all(images_dir.join(split)).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(labels_dir.join(split)).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(&outputs_dir).map_err(|e| e.to_string())?;

    let mut annotated: Vec<ImageAnnotations> = images.iter()
        .filter(|i| !i.annotations.is_empty())
        .cloned()
        .collect();

    let val_ratio = settings.val_ratio;
    let (train, val, _) = shuffle_and_split(&mut annotated, 1.0 - val_ratio, val_ratio);

    for (split_name, split_data) in [("train", &train), ("val", &val)] {
        for img in split_data {
            let stem = Path::new(&img.file_name).file_stem().unwrap().to_str().unwrap();
            write_pascal_voc_xml(
                &labels_dir.join(split_name).join(format!("{}.xml", stem)),
                &img.file_name,
                img.image_width,
                img.image_height,
                &img.annotations,
                classes,
            ).map_err(|e| e.to_string())?;
        }
    }

    let class_names: Vec<String> = classes.iter().map(|c| c.name.clone()).collect();

    let config_py = format!(
        "CLASSES = {:?}\nNUM_CLASSES = {}\nIMAGE_SIZE = {}\nBATCH_SIZE = {}\nEPOCHS = {}\nLEARNING_RATE = {}\n",
        class_names, classes.len(), settings.image_size, settings.batch_size, settings.epochs, settings.learning_rate
    );
    std::fs::write(base.join("config.py"), config_py).map_err(|e| e.to_string())?;

    let model_py = r#"import torchvision
from torchvision.models.detection import fasterrcnn_resnet50_fpn
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

def create_model(num_classes):
    model = fasterrcnn_resnet50_fpn(pretrained=True)
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
    return model
"#;
    std::fs::write(base.join("model.py"), model_py).map_err(|e| e.to_string())?;

    let dataset_py = r#"import os
import torch
from torch.utils.data import Dataset
from PIL import Image
import xml.etree.ElementTree as ET

class TissueDataset(Dataset):
    def __init__(self, images_dir, labels_dir, transforms=None):
        self.images_dir = images_dir
        self.labels_dir = labels_dir
        self.transforms = transforms
        self.images = [f for f in os.listdir(images_dir) if f.endswith(('.png', '.jpg', '.jpeg', '.bmp'))]

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_name = self.images[idx]
        img_path = os.path.join(self.images_dir, img_name)
        label_path = os.path.join(self.labels_dir, os.path.splitext(img_name)[0] + '.xml')
        image = Image.open(img_path).convert("RGB")
        boxes, labels = [], []
        if os.path.exists(label_path):
            tree = ET.parse(label_path)
            root = tree.getroot()
            for obj in root.findall('object'):
                name = obj.find('name').text
                bndbox = obj.find('bndbox')
                xmin = float(bndbox.find('xmin').text)
                ymin = float(bndbox.find('ymin').text)
                xmax = float(bndbox.find('xmax').text)
                ymax = float(bndbox.find('ymax').text)
                boxes.append([xmin, ymin, xmax, ymax])
                labels.append(1)
        target = {}
        target['boxes'] = torch.tensor(boxes, dtype=torch.float32) if boxes else torch.zeros((0, 4), dtype=torch.float32)
        target['labels'] = torch.tensor(labels, dtype=torch.int64) if labels else torch.zeros(0, dtype=torch.int64)
        if self.transforms:
            image = self.transforms(image)
        return image, target
"#;
    std::fs::write(base.join("dataset.py"), dataset_py).map_err(|e| e.to_string())?;

    let utils_py = r#"import albumentations as A
from albumentations.pytorch import ToTensorV2

def get_train_transform():
    return A.Compose([
        A.Flip(p=0.5),
        A.RandomRotate90(p=0.5),
        A.MotionBlur(p=0.2),
        A.Normalize(mean=[0,0,0], std=[1,1,1]),
        ToTensorV2(p=1.0),
    ], bbox_params=A.BboxParams(format='pascal_voc', label_fields=['labels']))

def get_valid_transform():
    return A.Compose([
        A.Normalize(mean=[0,0,0], std=[1,1,1]),
        ToTensorV2(p=1.0),
    ], bbox_params=A.BboxParams(format='pascal_voc', label_fields=['labels']))

def collate_fn(batch):
    return tuple(zip(*batch))
"#;
    std::fs::write(base.join("utils.py"), utils_py).map_err(|e| e.to_string())?;

    let train_script = generate_pytorch_train_script(settings, base.to_str().unwrap());
    std::fs::write(base.join("train.py"), train_script).map_err(|e| e.to_string())?;

    let reqs = "torch\ntorchvision\nopencv-python-headless\nalbumentations\ntqdm\nnumpy\n";
    std::fs::write(base.join("requirements.txt"), reqs).map_err(|e| e.to_string())?;

    let readme = format!(
        "# {} PyTorch Dataset\n\nGenerated by TissueAI.\n\n## Classes\n{}\n\n## Usage\n```bash\npip install -r requirements.txt\npython train.py\n```\n",
        settings.project_name,
        classes.iter().map(|c| format!("- {}: {}", c.id, c.name)).collect::<Vec<_>>().join("\n")
    );
    std::fs::write(base.join("README.md"), readme).map_err(|e| e.to_string())?;

    Ok(base.to_str().unwrap().to_string())
}

fn generate_yolo_train_script(settings: &ExportSettings, project_path: &str) -> String {
    format!(
        r#"from ultralytics import YOLO
import os

if __name__ == "__main__":
    data_yaml = os.path.join("{project}", "data.yaml")
    model = YOLO("{model}.pt")
    results = model.train(
        data=data_yaml,
        epochs={epochs},
        imgsz={img_size},
        batch={batch_size},
        name="exp",
        project="{project}",
    )
    print("Training complete!")
    print(f"Results saved to: {{results.save_dir}}")
"#,
        project = project_path.replace('\\', "/"),
        model = settings.model_type,
        epochs = settings.epochs,
        img_size = settings.image_size,
        batch_size = settings.batch_size,
    )
}

fn generate_pytorch_train_script(settings: &ExportSettings, project_path: &str) -> String {
    format!(
        r#"import os
import torch
from torch.utils.data import DataLoader
from torchvision.transforms import ToTensor
from dataset import TissueDataset
from model import create_model
from utils import collate_fn
from config import CLASSES, NUM_CLASSES, IMAGE_SIZE, BATCH_SIZE, EPOCHS, LEARNING_RATE

def main():
    train_dataset = TissueDataset(
        os.path.join("{project}", "images", "train"),
        os.path.join("{project}", "labels", "train"),
        transforms=ToTensor()
    )
    val_dataset = TissueDataset(
        os.path.join("{project}", "images", "val"),
        os.path.join("{project}", "labels", "val"),
        transforms=ToTensor()
    )
    train_loader = DataLoader(train_dataset, batch_size={batch_size}, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_dataset, batch_size={batch_size}, shuffle=False, collate_fn=collate_fn)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = create_model({num_classes})
    model.to(device)

    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.SGD(params, lr={lr}, momentum=0.9, weight_decay=0.0005)

    for epoch in range({epochs}):
        model.train()
        for images, targets in train_loader:
            images = list(image.to(device) for image in images)
            targets = [{{k: v.to(device) for k, v in t.items()}} for t in targets]
            loss_dict = model(images, targets)
            losses = sum(loss for loss in loss_dict.values())
            optimizer.zero_grad()
            losses.backward()
            optimizer.step()
        print(f"Epoch {{epoch+1}}/{{ {epochs} }} Complete")

        save_path = os.path.join("{project}", "outputs", f"model_epoch_{{epoch+1}}.pth")
        torch.save(model.state_dict(), save_path)

    print("Training complete!")

if __name__ == "__main__":
    main()
"#,
        project = project_path.replace('\\', "/"),
        batch_size = settings.batch_size,
        num_classes = settings.epochs,
        lr = settings.learning_rate,
        epochs = settings.epochs,
    )
}
