# app/utils/file_utils.py
import os
import uuid
from fastapi import UploadFile, HTTPException

STATIC_ROOT = os.getenv("STATIC_ROOT", "static")
LOGO_DIR = os.path.join(STATIC_ROOT, "logos")
SIGN_DIR = os.path.join(STATIC_ROOT, "signatures")

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def _ensure_static_dirs() -> None:
    os.makedirs(LOGO_DIR, exist_ok=True)
    os.makedirs(SIGN_DIR, exist_ok=True)


def _save_upload(file: UploadFile, dest_dir: str, web_prefix: str) -> str:
    _ensure_static_dirs()
    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PNG, JPG, GIF, or WEBP.")

    contents = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB).")

    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(dest_dir, fname)
    with open(fpath, "wb") as out:
        out.write(contents)
    return f"/static/{web_prefix}/{fname}"


def save_logo_file(file: UploadFile) -> str:
    return _save_upload(file, LOGO_DIR, "logos")


def save_signature_file(file: UploadFile) -> str:
    return _save_upload(file, SIGN_DIR, "signatures")