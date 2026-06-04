import smtplib
import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_send(msg: MIMEMultipart) -> None:
    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASS, settings.EMAIL_FROM]):
        raise ValueError("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM in .env")
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(settings.EMAIL_FROM, msg["To"], msg.as_string())


def send_invoice_email(
    *,
    to_email: str,
    to_name: str,
    invoice_no: str,
    company_name: str,
    total: str,
    due_date: str,
    pdf_base64: str,
    pdf_filename: str,
) -> None:
    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASS, settings.EMAIL_FROM]):
        raise ValueError("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM in .env")

    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4f46e5;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">{company_name}</h1>
      </div>
      <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:15px">Hi {to_name},</p>
        <p style="font-size:15px">Please find attached <strong>Invoice {invoice_no}</strong> from {company_name}.</p>
        <table style="width:100%;margin:24px 0;border-collapse:collapse">
          <tr style="background:#f9fafb">
            <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600">Invoice #</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb">{invoice_no}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600">Amount Due</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#4f46e5;font-weight:700">{total}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600">Due Date</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb">{due_date or "—"}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#6b7280">The PDF invoice is attached to this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="font-size:12px;color:#9ca3af;margin:0">Sent via JoslaSync · Please do not reply to this email</p>
      </div>
    </div>
    """

    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"Invoice {invoice_no} from {company_name}"
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html"))

    pdf_bytes = base64.b64decode(pdf_base64)
    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=pdf_filename)
    msg.attach(attachment)

    logger.info(f"📧 Sending invoice {invoice_no} to {to_email} via {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    _smtp_send(msg)
    logger.info(f"✅ Invoice email sent to {to_email}")


def send_reminder_email(
    *,
    to_email: str,
    to_name: str,
    invoice_no: str,
    company_name: str,
    total: str,
    amount_paid: str,
    due_date: str,
    days_overdue: int,
    reminder_count: int,
) -> None:
    urgency = "Friendly Reminder" if reminder_count == 1 else ("Second Notice" if reminder_count == 2 else "Final Notice")
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#dc2626;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">{urgency} — Overdue Invoice</h1>
      </div>
      <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:15px">Hi {to_name},</p>
        <p style="font-size:15px">This is a reminder that <strong>Invoice {invoice_no}</strong> from {company_name} is
        <strong style="color:#dc2626">{days_overdue} day{"s" if days_overdue != 1 else ""} overdue</strong>.</p>
        <table style="width:100%;margin:24px 0;border-collapse:collapse">
          <tr style="background:#f9fafb">
            <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600">Invoice #</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb">{invoice_no}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600">Due Date</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#dc2626">{due_date}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600">Total</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb">{total}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600">Amount Paid</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#059669">{amount_paid}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#6b7280">Please arrange payment at your earliest convenience. If you have already paid, please disregard this notice.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="font-size:12px;color:#9ca3af;margin:0">Sent by {company_name} via JoslaSync</p>
      </div>
    </div>
    """
    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"[{urgency}] Invoice {invoice_no} is Overdue — {company_name}"
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    logger.info(f"🔔 Sending reminder #{reminder_count} for invoice {invoice_no} to {to_email}")
    _smtp_send(msg)
    logger.info(f"✅ Reminder sent to {to_email}")
