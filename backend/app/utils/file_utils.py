# app/utils/file_utils.py
import os
import shutil
from fastapi import UploadFile
from app.core.logger import logger
import os
import uuid
from fastapi import UploadFile

STATIC_ROOT = os.getenv("STATIC_ROOT", "static")
LOGO_DIR = os.path.join(STATIC_ROOT, "logos")
SIGN_DIR = os.path.join(STATIC_ROOT, "signatures")


UPLOAD_DIR = "static/logos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_logo_file(logoFile: UploadFile) -> str:
    logo_filename = logoFile.filename
    logo_path = os.path.join(UPLOAD_DIR, logo_filename)
    with open(logo_path, "wb") as buffer:
        shutil.copyfileobj(logoFile.file, buffer)
    logger.info(f"Logo saved at {logo_path}")
    return f"/{logo_path}"


def _ensure_static_dirs() -> None:
    os.makedirs(LOGO_DIR, exist_ok=True)
    os.makedirs(SIGN_DIR, exist_ok=True)


def _save_upload(file: UploadFile, dest_dir: str, web_prefix: str) -> str:
    _ensure_static_dirs()
    _, ext = os.path.splitext(file.filename or "")
    ext = (ext or ".png").lower()
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(dest_dir, fname)
    with open(fpath, "wb") as out:
        out.write(file.file.read())
    return f"/static/{web_prefix}/{fname}"


def save_logo_file(file: UploadFile) -> str:
    return _save_upload(file, LOGO_DIR, "logos")


def save_signature_file(file: UploadFile) -> str:
    return _save_upload(file, SIGN_DIR, "signatures")