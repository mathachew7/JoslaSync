from decimal import Decimal
from datetime import datetime
from typing import List, Optional
from uuid import UUID as UUID_T

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.tenant.invoice import Invoice
from app.db.models.tenant.payment import Payment


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def recompute_amount_paid(db: Session, invoice_id: UUID_T) -> Decimal:
    """Recompute invoice.amount_paid as SUM(amount) over ACTIVE ledger rows. Source of truth is the ledger."""
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise ValueError("Invoice not found")

    total_paid = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.invoice_id == invoice_id, Payment.status == "ACTIVE"
        )
    ) or Decimal("0")
    total_paid = _dec(total_paid)

    clamped = max(Decimal("0"), min(total_paid, _dec(inv.total)))
    if clamped != total_paid:
        logger.warning(f"⚠️ payment ledger sum out of range for invoice={invoice_id}: raw={total_paid} clamped={clamped}")

    inv.amount_paid = clamped
    db.commit()
    db.refresh(inv)
    return clamped


def list_payments(db: Session, invoice_id: UUID_T) -> List[Payment]:
    stmt = select(Payment).where(Payment.invoice_id == invoice_id).order_by(Payment.created_at.asc())
    return db.execute(stmt).scalars().all()


def record_payment(db: Session, invoice_id: UUID_T, amount: Decimal, note: Optional[str], recorded_by: Optional[str]) -> Invoice:
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise ValueError("Invoice not found")
    if (inv.status or "").upper() != "INVOICE":
        raise ValueError("Payments can only be recorded against issued invoices.")

    remaining = _dec(inv.total) - _dec(inv.amount_paid)
    amount = _dec(amount)
    if amount <= 0:
        raise ValueError("Payment amount must be greater than zero.")
    if amount > remaining:
        raise ValueError(
            f"Payment of ${amount} exceeds the remaining balance of ${remaining:.2f}. "
            f"Use 'Correct' to fix a payment mistake."
        )

    row = Payment(invoice_id=invoice_id, amount=amount, kind="PAYMENT", note=note, recorded_by=recorded_by, status="ACTIVE")
    db.add(row)
    db.commit()

    recompute_amount_paid(db, invoice_id)
    db.refresh(inv)
    logger.info(f"💰 Payment recorded id={invoice_id} amount={amount} amount_paid={inv.amount_paid}")
    return inv


def correct_payment(db: Session, invoice_id: UUID_T, new_amount_paid: Decimal, note: Optional[str], recorded_by: Optional[str]) -> Invoice:
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise ValueError("Invoice not found")

    new_amount_paid = _dec(new_amount_paid)
    if new_amount_paid < 0 or new_amount_paid > _dec(inv.total):
        raise ValueError(f"Corrected amount ${new_amount_paid} must be between $0 and the invoice total ${inv.total:.2f}.")

    delta = new_amount_paid - _dec(inv.amount_paid)
    if delta != 0:
        row = Payment(
            invoice_id=invoice_id, amount=delta, kind="CORRECTION",
            note=note, recorded_by=recorded_by, status="ACTIVE",
        )
        db.add(row)
        db.commit()
        recompute_amount_paid(db, invoice_id)
        db.refresh(inv)

    logger.info(f"✏️ Payment corrected id={invoice_id} delta={delta} amount_paid={inv.amount_paid}")
    return inv


def void_payment(db: Session, invoice_id: UUID_T, payment_id: UUID_T, voided_by: Optional[str]) -> Invoice:
    row = db.get(Payment, payment_id)
    if not row or row.invoice_id != invoice_id:
        raise ValueError("Payment not found")
    if row.status != "ACTIVE":
        raise ValueError("This payment has already been voided.")

    row.status = "VOID"
    row.voided_at = datetime.utcnow().isoformat()
    row.voided_by = voided_by
    db.add(row)
    db.commit()

    inv = recompute_amount_paid(db, invoice_id)
    logger.info(f"🗑️ Payment voided id={payment_id} invoice={invoice_id} amount_paid={inv}")
    return db.get(Invoice, invoice_id)
