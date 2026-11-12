use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

pub const DEFAULT_PREFERRED_OWNERS: &[&str] = &[
    "ggml-org",
    "bartowski",
    "unsloth",
    "AesSedai",
    "ubergarm",
    "mradermacher",
];

pub const KNOWN_GGUF_OWNERS: &[(&str, &str)] = &[
    ("unsloth", "Dominant quantizer, Unsloth Dynamic 2.0 quants"),
    ("bartowski", "High-quality imatrix quants, large catalog"),
    ("ggml-org", "Official llama.cpp org, reference quants"),
    ("lmstudio-community", "LM Studio curated models"),
    ("mradermacher", "Prolific community quantizer, i1 variants"),
    ("MaziyarPanahi", "Diverse GGUF collection"),
    ("mmnga", "Various quants including Japanese models"),
    ("QuantFactory", "Quantized models collection"),
];

pub const RECOMMENDED_MODELS: &[RecommendedModelDef] = &[
    RecommendedModelDef {
        repo_id: "unsloth/Qwen3.5-4B-GGUF",
        filename: "Qwen3.5-4B-Q4_K_M.gguf",
        name: "Qwen 3.5 4B",
        description: "Lightweight but capable. Runs on minimal hardware.",
        params_b: 4,
        family: "Qwen 3.5",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/Qwen3.5-9B-GGUF",
        filename: "Qwen3.5-9B-Q4_K_M.gguf",
        name: "Qwen 3.5 9B",
        description: "Dense 9B model. Strong all-around performance.",
        params_b: 9,
        family: "Qwen 3.5",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/gpt-oss-20b-GGUF",
        filename: "gpt-oss-20b-Q4_K_M.gguf",
        name: "GPT-OSS 20B (MoE, 3.6B active)",
        description: "OpenAI's open-weight MoE model. Apache 2.0 license.",
        params_b: 20,
        family: "GPT-OSS",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/Qwen3.5-35B-A3B-GGUF",
        filename: "Qwen3.5-35B-A3B-Q4_K_M.gguf",
        name: "Qwen 3.5 35B MoE (3B active)",
        description: "Most downloaded GGUF model. MoE with 3B active params — fast and smart.",
        params_b: 35,
        family: "Qwen 3.5",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF",
        filename: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf",
        name: "Qwen3 Coder 30B MoE (3B active)",
        description: "Coding-focused MoE model with 3B active params.",
        params_b: 30,
        family: "Qwen3 Coder",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/Qwen3.5-27B-GGUF",
        filename: "Qwen3.5-27B-Q4_K_M.gguf",
        name: "Qwen 3.5 27B",
        description: "Hybrid DeltaNet architecture. High capability dense model.",
        params_b: 27,
        family: "Qwen 3.5",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/gemma-3-27b-it-GGUF",
        filename: "gemma-3-27b-it-Q4_K_M.gguf",
        name: "Gemma 3 27B Instruct",
        description: "Google's latest 27B model. Well-rounded and capable.",
        params_b: 27,
        family: "Gemma 3",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/GLM-4.7-Flash-GGUF",
        filename: "GLM-4.7-Flash-Q4_K_M.gguf",
        name: "GLM 4.7 Flash (30B MoE, 3B active)",
        description: "Zhipu AI's fast MoE model. 3B active params, very efficient.",
        params_b: 30,
        family: "GLM 4.7",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/Nemotron-3-Nano-30B-A3B-GGUF",
        filename: "Nemotron-3-Nano-30B-A3B-Q4_K_M.gguf",
        name: "Nemotron 3 Nano (30B MoE, 3B active)",
        description: "NVIDIA's hybrid Mamba-2/Transformer MoE. Very fast inference.",
        params_b: 30,
        family: "Nemotron 3",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/Qwen3-Coder-Next-GGUF",
        filename: "Qwen3-Coder-Next-Q4_K_M.gguf",
        name: "Qwen3 Coder Next (80B MoE, 3B active)",
        description: "Largest coding MoE. Needs ~48 GB but only 3B active params.",
        params_b: 80,
        family: "Qwen3 Coder",
        quant: "Q4_K_M",
        context: None,
    },
    RecommendedModelDef {
        repo_id: "unsloth/Qwen3.5-122B-A10B-GGUF",
        filename: "Qwen3.5-122B-A10B-Q4_K_M.gguf",
        name: "Qwen 3.5 122B MoE (10B active)",
        description: "Frontier-class MoE model. Needs ~76 GB. Top benchmark scores.",
        params_b: 122,
        family: "Qwen 3.5",
        quant: "Q4_K_M",
        context: None,
    },
];

pub struct RecommendedModelDef {
    pub repo_id: &'static str,
    pub filename: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub params_b: u32,
    pub family: &'static str,
    pub quant: &'static str,
    pub context: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfModel {
    pub repo_id: String,
    pub name: String,
    pub author: String,
    pub tags: Vec<String>,
    pub files: Vec<HfFile>,
    pub downloads: u64,
    pub likes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfFile {
    pub filename: String,
    pub size_bytes: u64,
    pub quant: Option<String>,
    pub download_url: String,
    #[serde(default)]
    pub is_split: bool,
    #[serde(default)]
    pub split_parts: Vec<HfFilePart>,
    #[serde(default)]
    pub is_mmproj: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfFilePart {
    pub filename: String,
    pub size_bytes: u64,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HfApiModel {
    id: String,
    #[serde(rename = "modelId")]
    model_id: Option<String>,
    author: Option<String>,
    tags: Option<Vec<String>>,
    downloads: Option<u64>,
    likes: Option<u64>,
    siblings: Option<Vec<HfApiFile>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HfApiFile {
    rfilename: String,
    size: Option<u64>,
}

pub async fn search_models(
    client: &reqwest::Client,
    query: &str,
    owner: Option<&str>,
) -> Result<Vec<HfModel>> {
    let mut url = format!(
        "https://huggingface.co/api/models?search={}&filter=gguf&limit=30&sort=downloads",
        urlencoding_simple(query)
    );
    if let Some(owner) = owner {
        url = format!(
            "https://huggingface.co/api/models?author={}&search={}&filter=gguf&limit=50&sort=downloads",
            owner,
            urlencoding_simple(query)
        );
    }

    let response = client
        .get(&url)
        .header("User-Agent", "llm-launcher/0.1")
        .send()
        .await
        .context("Failed to search HuggingFace")?;

    if !response.status().is_success() {
        anyhow::bail!("HuggingFace API error: {}", response.status());
    }

    let models: Vec<HfApiModel> = response.json().await.context("Failed to parse HF response")?;
    Ok(models.into_iter().map(convert_model).collect())
}

pub async fn validate_hf_gguf_author(client: &reqwest::Client, author: &str) -> Result<bool> {
    let url = format!(
        "https://huggingface.co/api/models?author={}&filter=gguf&limit=1",
        urlencoding_simple(author)
    );
    let response = client
        .get(&url)
        .header("User-Agent", "llm-launcher/0.1")
        .send()
        .await
        .context("Failed to validate HuggingFace author")?;

    if !response.status().is_success() {
        return Ok(false);
    }
    let models: Vec<HfApiModel> = response.json().await.unwrap_or_default();
    Ok(!models.is_empty())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HfTreeEntry {
    #[serde(rename = "type")]
    entry_type: String,
    oid: Option<String>,
    size: Option<u64>,
    path: String,
}

pub fn is_imatrix_file(filename: &str) -> bool {
    let lower = filename.to_lowercase();
    lower.contains("imatrix") || lower.contains("importance_matrix")
}

pub fn is_mmproj_file(filename: &str) -> bool {
    filename.to_lowercase().contains("mmproj")
}

pub fn parse_split_filename(filename: &str) -> Option<(String, u32, u32)> {
    let name = filename.rsplit('/').next().unwrap_or(filename);
    let re = regex::Regex::new(r"^(.+)-(\d{5})-of-(\d{5})\.gguf$").ok()?;
    let caps = re.captures(name)?;
    let base = caps.get(1)?.as_str().to_string();
    let part: u32 = caps.get(2)?.as_str().parse().ok()?;
    let total: u32 = caps.get(3)?.as_str().parse().ok()?;
    Some((base, part, total))
}

fn split_group_key(path: &str) -> Option<String> {
    let dir_prefix = match path.rfind('/') {
        Some(pos) => &path[..=pos],
        None => "",
    };
    let (base, _, total) = parse_split_filename(path)?;
    Some(format!("{}{}-{:05}", dir_prefix, base, total))
}

fn consolidate_files(files: Vec<HfFile>) -> Vec<HfFile> {
    use std::collections::BTreeMap;

    let mut singles: Vec<HfFile> = Vec::new();
    let mut split_groups: BTreeMap<String, Vec<HfFile>> = BTreeMap::new();

    for file in files {
        if let Some(key) = split_group_key(&file.filename) {
            split_groups.entry(key).or_default().push(file);
        } else {
            let basename = file.filename.rsplit('/').next().unwrap_or(&file.filename).to_string();
            let is_mmproj = is_mmproj_file(&basename);
            singles.push(HfFile {
                filename: basename,
                is_split: false,
                split_parts: vec![],
                is_mmproj,
                ..file
            });
        }
    }

    for (_key, mut parts) in split_groups {
        parts.sort_by_key(|f| {
            parse_split_filename(&f.filename).map(|(_, n, _)| n).unwrap_or(0)
        });

        let total_size: u64 = parts.iter().map(|p| p.size_bytes).sum();
        let quant = parts[0].quant.clone();

        let split_parts: Vec<HfFilePart> = parts
            .iter()
            .map(|p| {
                let basename = p.filename.rsplit('/').next().unwrap_or(&p.filename).to_string();
                HfFilePart {
                    filename: basename,
                    size_bytes: p.size_bytes,
                    download_url: p.download_url.clone(),
                }
            })
            .collect();

        let first = &parts[0];
        let first_basename = first.filename.rsplit('/').next().unwrap_or(&first.filename).to_string();

        singles.push(HfFile {
            filename: first_basename,
            size_bytes: total_size,
            quant,
            download_url: first.download_url.clone(),
            is_split: true,
            split_parts,
            is_mmproj: false,
        });
    }

    singles
}

fn fetch_tree_recursive<'a>(
    client: &'a reqwest::Client,
    repo_id: &'a str,
    path: &'a str,
    max_depth: u32,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<HfTreeEntry>>> + Send + 'a>> {
    Box::pin(async move {
        if max_depth == 0 {
            return Ok(vec![]);
        }

        let url = if path.is_empty() {
            format!("https://huggingface.co/api/models/{}/tree/main", repo_id)
        } else {
            format!(
                "https://huggingface.co/api/models/{}/tree/main/{}",
                repo_id, path
            )
        };

        let response = client
            .get(&url)
            .header("User-Agent", "llm-launcher/0.1")
            .send()
            .await
            .context("Failed to fetch repo tree")?;

        if !response.status().is_success() {
            return Ok(vec![]);
        }

        let entries: Vec<HfTreeEntry> = response.json().await.unwrap_or_default();
        let mut result = Vec::new();

        for entry in entries {
            if entry.entry_type == "directory" {
                let sub = fetch_tree_recursive(client, repo_id, &entry.path, max_depth - 1).await?;
                result.extend(sub);
            } else {
                result.push(entry);
            }
        }

        Ok(result)
    })
}

pub async fn get_repo_files(client: &reqwest::Client, repo_id: &str) -> Result<Vec<HfFile>> {
    let entries = fetch_tree_recursive(client, repo_id, "", 3).await?;

    let files: Vec<HfFile> = entries
        .into_iter()
        .filter(|e| e.entry_type == "file" && e.path.ends_with(".gguf"))
        .filter(|e| !is_imatrix_file(&e.path))
        .map(|e| {
            let quant = extract_quant(&e.path);
            let download_url = format!(
                "https://huggingface.co/{}/resolve/main/{}",
                repo_id, e.path
            );
            let is_mmproj = is_mmproj_file(&e.path);
            HfFile {
                filename: e.path,
                size_bytes: e.size.unwrap_or(0),
                quant,
                download_url,
                is_split: false,
                split_parts: vec![],
                is_mmproj,
            }
        })
        .collect();

    Ok(consolidate_files(files))
}

fn convert_model(m: HfApiModel) -> HfModel {
    let repo_id = m.id.clone();
    let author = m.author.unwrap_or_else(|| {
        repo_id.split('/').next().unwrap_or("unknown").to_string()
    });
    let name = repo_id.split('/').last().unwrap_or(&repo_id).to_string();

    let files: Vec<HfFile> = m
        .siblings
        .unwrap_or_default()
        .into_iter()
        .filter(|f| f.rfilename.ends_with(".gguf"))
        .filter(|f| !is_imatrix_file(&f.rfilename))
        .map(|f| {
            let quant = extract_quant(&f.rfilename);
            let download_url = format!(
                "https://huggingface.co/{}/resolve/main/{}",
                repo_id, f.rfilename
            );
            let is_mmproj = is_mmproj_file(&f.rfilename);
            HfFile {
                filename: f.rfilename,
                size_bytes: f.size.unwrap_or(0),
                quant,
                download_url,
                is_split: false,
                split_parts: vec![],
                is_mmproj,
            }
        })
        .collect();

    let files = consolidate_files(files);

    HfModel {
        repo_id,
        name,
        author,
        tags: m.tags.unwrap_or_default(),
        files,
        downloads: m.downloads.unwrap_or(0),
        likes: m.likes.unwrap_or(0),
    }
}

pub fn extract_quant(filename: &str) -> Option<String> {
    let re = regex::Regex::new(r"(?i)(MXFP\d|IQ\d[_A-Z]*|Q\d[_KM0-9A-Z]+|F16|F32|BF16)").ok()?;
    re.find(filename).map(|m| m.as_str().to_uppercase())
}

fn urlencoding_simple(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => '+'.to_string(),
            c => format!("%{:02X}", c as u32),
        })
        .collect()
}

// presets.ini support

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct HfPresetParams {
    pub temperature: Option<f32>,
    pub top_k: Option<i32>,
    pub top_p: Option<f32>,
    pub min_p: Option<f32>,
    pub n_predict: Option<i32>,
    pub seed: Option<u64>,
    pub repeat_penalty: Option<f32>,
    pub repeat_last_n: Option<i32>,
}

impl HfPresetParams {
    pub fn is_empty(&self) -> bool {
        self.temperature.is_none()
            && self.top_k.is_none()
            && self.top_p.is_none()
            && self.min_p.is_none()
            && self.n_predict.is_none()
            && self.seed.is_none()
            && self.repeat_penalty.is_none()
            && self.repeat_last_n.is_none()
    }
}

pub async fn fetch_presets_ini(
    client: &reqwest::Client,
    repo_id: &str,
) -> Result<Option<HfPresetParams>> {
    let url = format!(
        "https://huggingface.co/{}/resolve/main/presets.ini",
        repo_id
    );
    let resp = client.get(&url).send().await?;
    if resp.status() == 404 {
        return Ok(None);
    }
    if !resp.status().is_success() {
        return Ok(None);
    }
    let text = resp.text().await?;
    Ok(Some(parse_presets_ini(&text)))
}

fn parse_presets_ini(content: &str) -> HfPresetParams {
    let mut params = HfPresetParams::default();
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.starts_with(';') || line.starts_with('[') || line.is_empty() {
            continue;
        }
        if let Some((key, val)) = line.split_once('=') {
            let key = key.trim().to_lowercase();
            let val = val.trim();
            match key.as_str() {
                "temperature" | "temp" => { params.temperature = val.parse().ok(); }
                "top_k" | "top-k" => { params.top_k = val.parse().ok(); }
                "top_p" | "top-p" => { params.top_p = val.parse().ok(); }
                "min_p" | "min-p" => { params.min_p = val.parse().ok(); }
                "n_predict" | "max_new_tokens" | "max_tokens" | "max-new-tokens" => { params.n_predict = val.parse().ok(); }
                "seed" => { params.seed = val.parse().ok(); }
                "repeat_penalty" | "repeat-penalty" | "repetition_penalty" => { params.repeat_penalty = val.parse().ok(); }
                "repeat_last_n" | "repeat-last-n" => { params.repeat_last_n = val.parse().ok(); }
                _ => {}
            }
        }
    }
    params
}
