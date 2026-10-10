import logging
import sys
from logging.handlers import RotatingFileHandler
import os

# Set up logs directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "..", "..", "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# Define log file path
LOG_FILE = os.path.join(LOG_DIR, "app.log")

# Configure logger
logger = logging.getLogger("joslasync")
logger.setLevel(logging.INFO)

# Avoid duplicate handlers
if not logger.handlers:
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

    # Container stdout — this is what `docker logs` / Coolify's Runtime Logs tab show.
    # Without this, the file handler below writes into the container's ephemeral
    # filesystem only, so every log line is invisible in prod and lost on redeploy.
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=5_000_000, backupCount=5
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
