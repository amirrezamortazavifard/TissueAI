use aes::Aes128;
use aes::Aes192;
use aes::Aes256;
use cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

type Aes128CbcDec = cbc::Decryptor<Aes128>;
type Aes192CbcDec = cbc::Decryptor<Aes192>;
type Aes256CbcDec = cbc::Decryptor<Aes256>;

type Aes256CbcEnc = cbc::Encryptor<Aes256>;

/// Default internal salt for proprietary model key derivation.
const DEFAULT_MODEL_SALT: &[u8] = b"TissueAI::ProprietaryModel::Key::v1";

/// Resolve the 32-byte AES key and 16-byte IV for proprietary models.
/// Key resolution order:
/// 1. Environment variable `TISSUEAI_MODEL_KEY`
/// 2. Key file next to model (`<model_path>.key` or directory `model_key.txt`)
/// 3. Secure deterministic derivation based on application signature
pub fn resolve_model_credentials(model_path: Option<&str>) -> (Vec<u8>, [u8; 16]) {
    // 1. Check environment variable
    if let Ok(env_key) = std::env::var("TISSUEAI_MODEL_KEY") {
        if !env_key.trim().is_empty() {
            let mut hasher = Sha256::new();
            hasher.update(env_key.trim().as_bytes());
            let key = hasher.finalize().to_vec();

            let mut iv_hasher = Sha256::new();
            iv_hasher.update(b"TissueAI_IV_SALT");
            iv_hasher.update(key.as_slice());
            let iv_hash = iv_hasher.finalize();
            let mut iv = [0u8; 16];
            iv.copy_from_slice(&iv_hash[..16]);
            return (key, iv);
        }
    }

    // 2. Check for key file next to model or in models directory
    if let Some(m_path) = model_path {
        let p = Path::new(m_path);
        let candidates = vec![
            p.with_extension("key"),
            p.parent().map(|dir| dir.join("model_key.txt")).unwrap_or_else(|| PathBuf::from("model_key.txt")),
            p.parent().map(|dir| dir.join(".model_key")).unwrap_or_else(|| PathBuf::from(".model_key")),
        ];

        for cand in candidates {
            if cand.exists() {
                if let Ok(content) = std::fs::read_to_string(&cand) {
                    let trimmed = content.trim();
                    if !trimmed.is_empty() {
                        let mut hasher = Sha256::new();
                        hasher.update(trimmed.as_bytes());
                        let key = hasher.finalize().to_vec();

                        let mut iv_hasher = Sha256::new();
                        iv_hasher.update(b"TissueAI_IV_SALT");
                        iv_hasher.update(key.as_slice());
                        let mut iv = [0u8; 16];
                        iv.copy_from_slice(&iv_hasher.finalize()[..16]);
                        return (key, iv);
                    }
                }
            }
        }
    }

    // 3. Built-in default derivation for official proprietary models
    let mut key_hasher = Sha256::new();
    key_hasher.update(DEFAULT_MODEL_SALT);
    key_hasher.update(b"@TissueAI_Proprietary_Vision_Core_2026#");
    let key = key_hasher.finalize().to_vec();

    let mut iv_hasher = Sha256::new();
    iv_hasher.update(b"TissueAI_Default_IV_Vector_2026");
    iv_hasher.update(&key);
    let iv_hash = iv_hasher.finalize();
    let mut iv = [0u8; 16];
    iv.copy_from_slice(&iv_hash[..16]);

    (key, iv)
}

/// Decrypt AES-CBC encoded data using byte slices for key and IV.
pub fn decrypt_aes_cbc_bytes(data: &[u8], key: &[u8], iv: &[u8]) -> Result<Vec<u8>, String> {
    if iv.len() != 16 {
        return Err(format!("IV must be 16 bytes, got {}", iv.len()));
    }

    let mut buf = data.to_vec();
    let iv_arr: [u8; 16] = iv.try_into().map_err(|_| "Invalid IV slice".to_string())?;

    let padded_len = (buf.len() / 16) * 16;
    if padded_len == 0 {
        return Err("Data too short for AES-CBC".to_string());
    }

    match key.len() {
        16 => {
            let key_arr: [u8; 16] = key.try_into().unwrap();
            let decryptor = Aes128CbcDec::new(&key_arr.into(), &iv_arr.into());
            decryptor
                .decrypt_padded_mut::<block_padding::Pkcs7>(&mut buf[..padded_len])
                .map(|dec| dec.to_vec())
                .map_err(|e| format!("AES-128-CBC decrypt failed: {:?}", e))
        }
        24 => {
            let key_arr: [u8; 24] = key.try_into().unwrap();
            let decryptor = Aes192CbcDec::new(&key_arr.into(), &iv_arr.into());
            decryptor
                .decrypt_padded_mut::<block_padding::Pkcs7>(&mut buf[..padded_len])
                .map(|dec| dec.to_vec())
                .map_err(|e| format!("AES-192-CBC decrypt failed: {:?}", e))
        }
        32 => {
            let key_arr: [u8; 32] = key.try_into().unwrap();
            let decryptor = Aes256CbcDec::new(&key_arr.into(), &iv_arr.into());
            decryptor
                .decrypt_padded_mut::<block_padding::Pkcs7>(&mut buf[..padded_len])
                .map(|dec| dec.to_vec())
                .map_err(|e| format!("AES-256-CBC decrypt failed: {:?}", e))
        }
        len => Err(format!(
            "Invalid AES key length: {} bytes (must be 16, 24, or 32)",
            len
        )),
    }
}

/// Encrypt data with AES-256-CBC and PKCS#7 padding.
pub fn encrypt_aes_256_cbc(data: &[u8], key: &[u8], iv: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != 32 {
        return Err(format!("AES-256 requires 32-byte key, got {}", key.len()));
    }
    if iv.len() != 16 {
        return Err(format!("IV must be 16 bytes, got {}", iv.len()));
    }

    let key_arr: [u8; 32] = key.try_into().unwrap();
    let iv_arr: [u8; 16] = iv.try_into().unwrap();

    let encryptor = Aes256CbcEnc::new(&key_arr.into(), &iv_arr.into());
    let mut buf = vec![0u8; data.len() + 16];
    buf[..data.len()].copy_from_slice(data);

    match encryptor.encrypt_padded_mut::<block_padding::Pkcs7>(&mut buf, data.len()) {
        Ok(enc) => Ok(enc.to_vec()),
        Err(e) => Err(format!("AES-256-CBC encryption failed: {:?}", e)),
    }
}

/// Legacy string-based AES-CBC decryptor for backward compatibility.
pub fn decrypt_aes_cbc(data: &[u8], key: &str, iv: &str) -> Result<Vec<u8>, String> {
    decrypt_aes_cbc_bytes(data, key.as_bytes(), iv.as_bytes())
}

/// Load a model file into memory, automatically handling raw or encrypted models.
///
/// If the model is raw ONNX (starts with 0x08 0x09), it is loaded directly.
/// If the model is encrypted, it is decrypted purely in RAM using the resolved
/// proprietary model key, ensuring unencrypted weights are never written to disk.
pub fn try_decrypt_or_raw(model_path: &str) -> Result<Vec<u8>, String> {
    let data = std::fs::read(model_path)
        .map_err(|e| format!("Failed to read model file: {}", e))?;

    // Check if raw ONNX protobuf (magic bytes 0x08 0x09)
    if data.len() >= 4 && data[0] == 0x08 && data[1] == 0x09 {
        return Ok(data);
    }

    // Proprietary encrypted model: decrypt purely in memory
    let (key, iv) = resolve_model_credentials(Some(model_path));
    decrypt_aes_cbc_bytes(&data, &key, &iv)
        .map_err(|e| format!("Failed to decrypt proprietary model: {}", e))
}

/// Utility function to encrypt a raw model file to an encrypted proprietary model file.
pub fn encrypt_model_file(
    input_path: &str,
    output_path: &str,
    custom_passphrase: Option<&str>,
) -> Result<(), String> {
    let raw_data = std::fs::read(input_path)
        .map_err(|e| format!("Failed to read input model: {}", e))?;

    let (key, iv) = match custom_passphrase {
        Some(pass) if !pass.trim().is_empty() => {
            let mut hasher = Sha256::new();
            hasher.update(pass.trim().as_bytes());
            let k = hasher.finalize().to_vec();

            let mut iv_hasher = Sha256::new();
            iv_hasher.update(b"TissueAI_IV_SALT");
            iv_hasher.update(&k);
            let mut iv_arr = [0u8; 16];
            iv_arr.copy_from_slice(&iv_hasher.finalize()[..16]);
            (k, iv_arr)
        }
        _ => resolve_model_credentials(Some(output_path)),
    };

    let encrypted_data = encrypt_aes_256_cbc(&raw_data, &key, &iv)?;
    std::fs::write(output_path, encrypted_data)
        .map_err(|e| format!("Failed to write encrypted model: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption_roundtrip() {
        let sample_weights = b"fake_proprietary_model_weights_data_block_padding_test";
        let (key, iv) = resolve_model_credentials(None);

        let encrypted = encrypt_aes_256_cbc(sample_weights, &key, &iv).expect("Encryption failed");
        assert_ne!(encrypted, sample_weights);

        let decrypted = decrypt_aes_cbc_bytes(&encrypted, &key, &iv).expect("Decryption failed");
        assert_eq!(decrypted, sample_weights);
    }

    #[test]
    fn test_raw_onnx_detection() {
        let fake_onnx = vec![0x08, 0x09, 0x01, 0x02, 0x03];
        let temp_dir = tempfile::tempdir().unwrap();
        let model_path = temp_dir.path().join("model.onnx");
        std::fs::write(&model_path, &fake_onnx).unwrap();

        let loaded = try_decrypt_or_raw(model_path.to_str().unwrap()).unwrap();
        assert_eq!(loaded, fake_onnx);
    }

    #[test]
    fn test_encrypted_model_detection_and_decrypt() {
        let proprietary_weights = b"PROPRIETARY_YOLO_ONNX_MODEL_CONTENT_2026";
        let temp_dir = tempfile::tempdir().unwrap();
        let enc_path = temp_dir.path().join("model.enc");

        let (key, iv) = resolve_model_credentials(None);
        let encrypted = encrypt_aes_256_cbc(proprietary_weights, &key, &iv).unwrap();
        std::fs::write(&enc_path, &encrypted).unwrap();

        let loaded = try_decrypt_or_raw(enc_path.to_str().unwrap()).unwrap();
        assert_eq!(loaded, proprietary_weights);
    }
}
