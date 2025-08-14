# app/validators/company_profile_validator.py
import re
from fastapi import HTTPException
from app.core.logger import logger

def validate_fields(company_email, company_mobile, city, zip_code, tax_rate, logoFile):
    if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", company_email):
        logger.warning("Invalid email format")
        raise HTTPException(status_code=400, detail="Invalid email format")

    if not company_mobile.isdigit() or len(company_mobile) != 10:
        logger.warning("Invalid mobile number")
        raise HTTPException(status_code=400, detail="Mobile number must be exactly 10 digits")

    if not zip_code.isdigit() or len(zip_code) != 5:
        logger.warning("Invalid zip code")
        raise HTTPException(status_code=400, detail="Zip Code must be 5 digits")

    if not re.match(r"^[a-zA-Z\s]+$", city):
        logger.warning("Invalid city format")
        raise HTTPException(status_code=400, detail="City must contain only letters")

    try:
        float(tax_rate)
    except ValueError:
        logger.warning("Invalid tax rate")
        raise HTTPException(status_code=400, detail="Tax Rate must be a number")

    ext = (logoFile.filename or "").lower().rsplit(".", 1)[-1]
    if ext not in ["jpg", "jpeg", "png"]:
        logger.warning("Invalid logo file format")
        raise HTTPException(status_code=400, detail="Logo must be .jpg, .jpeg, or .png")
