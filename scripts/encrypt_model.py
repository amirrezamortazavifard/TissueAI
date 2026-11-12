#!/usr/bin/env python3
"""
TissueAI - Proprietary Model Encryption & Decryption Tool
Encrypts ONNX models using AES-256-CBC with PKCS#7 padding compatible with TissueAI runtime.

Usage:
  python encrypt_model.py encrypt <input_model.onnx> <output_model.enc> [--key <passphrase>]
  python encrypt_model.py decrypt <input_model.enc> <output_model.onnx> [--key <passphrase>]
"""

import sys
import os
import hashlib
import argparse

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("Error: 'cryptography' library is required. Install via: pip install cryptography")
    sys.exit(1)

DEFAULT_SALT = b"TissueAI::ProprietaryModel::Key::v1"
DEFAULT_SECRET = b"@TissueAI_Proprietary_Vision_Core_2026#"

def derive_credentials(passphrase: str = None):
    if passphrase:
        key = hashlib.sha256(passphrase.strip().encode("utf-8")).digest()
        iv_hash = hashlib.sha256(b"TissueAI_IV_SALT" + key).digest()
        iv = iv_hash[:16]
    else:
        # Check environment variable
        env_key = os.environ.get("TISSUEAI_MODEL_KEY")
        if env_key and env_key.strip():
            key = hashlib.sha256(env_key.strip().encode("utf-8")).digest()
            iv_hash = hashlib.sha256(b"TissueAI_IV_SALT" + key).digest()
            iv = iv_hash[:16]
        else:
            # Default built-in derivation
            h = hashlib.sha256()
            h.update(DEFAULT_SALT)
            h.update(DEFAULT_SECRET)
            key = h.digest()

            iv_h = hashlib.sha256()
            iv_h.update(b"TissueAI_Default_IV_Vector_2026")
            iv_h.update(key)
            iv = iv_h.digest()[:16]

    return key, iv

def encrypt_file(input_path: str, output_path: str, key_str: str = None):
    key, iv = derive_credentials(key_str)

    with open(input_path, "rb") as f:
        data = f.read()

    # PKCS#7 padding
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(data) + padder.finalize()

    # AES-CBC encryption
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded_data) + encryptor.finalize()

    with open(output_path, "wb") as f:
        f.write(encrypted)

    print(f"[+] Successfully encrypted '{input_path}' -> '{output_path}' ({len(encrypted):,} bytes)")

def decrypt_file(input_path: str, output_path: str, key_str: str = None):
    key, iv = derive_credentials(key_str)

    with open(input_path, "rb") as f:
        encrypted_data = f.read()

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    padded_data = decryptor.update(encrypted_data) + decryptor.finalize()

    unpadder = padding.PKCS7(128).unpadder()
    raw_data = unpadder.update(padded_data) + unpadder.finalize()

    with open(output_path, "wb") as f:
        f.write(raw_data)

    print(f"[+] Successfully decrypted '{input_path}' -> '{output_path}' ({len(raw_data):,} bytes)")

def main():
    parser = argparse.ArgumentParser(description="TissueAI Proprietary Model Encryptor/Decryptor")
    subparsers = parser.add_subparsers(dest="command", required=True)

    enc_parser = subparsers.add_parser("encrypt", help="Encrypt an ONNX model")
    enc_parser.add_argument("input", help="Path to raw .onnx model")
    enc_parser.add_argument("output", help="Path to output encrypted model (.enc)")
    enc_parser.add_argument("--key", help="Optional custom passphrase", default=None)

    dec_parser = subparsers.add_parser("decrypt", help="Decrypt an encrypted model")
    dec_parser.add_argument("input", help="Path to encrypted model (.enc)")
    dec_parser.add_argument("output", help="Path to output decrypted .onnx model")
    dec_parser.add_argument("--key", help="Optional custom passphrase", default=None)

    args = parser.parse_args()

    if args.command == "encrypt":
        encrypt_file(args.input, args.output, args.key)
    elif args.command == "decrypt":
        decrypt_file(args.input, args.output, args.key)

if __name__ == "__main__":
    main()

