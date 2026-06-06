from __future__ import annotations

from typing import Optional, Sequence, Union
from uuid import UUID as UUID_T
from calendar import month_abbr
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import select, func, extract, or_, and_, asc, desc
from sqlalchemy.exc import IntegrityError

from app.core.logger import logger
from app.schemas.invoice import InvoiceCreate
from app.validators.invoice_validator import validate_invoice_create
from app.db.models.tenant.invoice import Invoice, InvoiceItem
from app.db.models.tenant.client import Client as ClientModel
from app.services.invoice_service import (
    compute_totals,
    next_invoice_no,
    build_frozen_payload,
)


# ---------------------------
# Errors / Helpers (filters/sorting)
# ---------------------------

class InvoiceNotFound(Exception):
    pass


def _to_date(d: Optional[Union[str, date]]) -> Optional[date]:
    if d is None:
        return None
    if isinstance(d, date):
        return d
    s = str(d).strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s)  # expects "YYYY-MM-DD"
    except ValueError:
        logger.warning("Invalid date filter value ignored: %r", d)
        return None


def _apply_common_filters(
    stmt,
    *,
    client_id: Optional[UUID_T] = None,
    status: Optional[str] = None,
    qtext: Optional[str] = None,
    date_from: Optional[Union[str, date]] = None,  # "YYYY-MM-DD" or date
    date_to: Optional[Union[str, date]] = None,    # "YYYY-MM-DD" or date
):
    if client_id:
        stmt = stmt.where(Invoice.client_id == client_id)
    if status:
        stmt = stmt.where(Invoice.status == status)

    df = _to_date(date_from)
    dt = _to_date(date_to)
    if df:
        stmt = stmt.where(Invoice.invoice_date >= df)
    if dt:
        stmt = stmt.where(Invoice.invoice_date <= dt)

    if qtext:
        like = f"%{qtext.strip()}%"
        # join client to search its fields too
        stmt = (
            stmt.join(ClientModel, ClientModel.id == Invoice.client_id, isouter=True)
            .where(
                or_(
                    Invoice.invoice_no.ilike(like),
                    ClientModel.name.ilike(like),
                    ClientModel.email.ilike(like),
                    ClientModel.company.ilike(like),
                )
            )
        )
    return stmt


def _apply_sort(stmt, *, sort: Optional[str], order: Optional[str]):
    sort_map = {
        "invoice_date": Invoice.invoice_date,
        "created_at": Invoice.created_at,
        "total": Invoice.total,
        "invoice_no": Invoice.invoice_no,
    }
    sort_col = sort_map.get((sort or "invoice_date"), Invoice.invoice_date)
    return stmt.order_by(asc(sort_col) if (order or "desc") == "asc" else desc(sort_col))


# ---------------------------
# Create / Read / Delete (edits disabled)
# ---------------------------

def create_invoice(db: Session, data: InvoiceCreate) -> Invoice:
    """
    Finalize-on-create:
    - validate request
    - compute totals
    - generate invoice_no (per company) with retry on collision
    - build frozen payload (PDF snapshot)
    - insert invoice with status=INVOICE + items (one transaction)
    """
    logger.info(f"🧾 Creating invoice for client={data.client_id} company={data.company_id}")
    validate_invoice_create(data)

    items_dicts = [
        {"quantity": i.quantity, "unit_price": i.unit_price, "description": i.description, "sno": i.sno}
        for i in data.items
    ]

    totals = compute_totals(
        items=items_dicts,
        discount_enabled=data.discount_enabled,
        discount_type=(data.discount_type.value if getattr(data.discount_type, "value", None) else data.discount_type),
        discount_value=data.discount_value,
        tax_rate=data.tax_rate,
    )

    MAX_ATTEMPTS = 6
    for attempt in range(1, MAX_ATTEMPTS + 1):
        inv_no = next_invoice_no(db, data.company_id)

        frozen = build_frozen_payload(
            db=db,
            create=data,
            invoice_no=inv_no,
            totals=totals,
            created_by_name=data.created_by_name,
        )

        invoice = Invoice(
            invoice_no=inv_no,
            status=data.status.value if hasattr(data.status, "value") else str(data.status),
            client_id=data.client_id,
            company_id=data.company_id,
            created_by_user_id=data.created_by_user_id,
            created_by_name=data.created_by_name,

            invoice_date=data.invoice_date,
            due_date=data.due_date,
            place_of_supply=data.place_of_supply,
            invoice_title=(data.invoice_title or "").strip() or None,

            discount_enabled=data.discount_enabled,
            discount_type=(data.discount_type.value if getattr(data.discount_type, "value", None) else data.discount_type),
            discount_value=data.discount_value,
            tax_rate=data.tax_rate,

            subtotal=totals["subtotal"],
            discount_amount=totals["discount_amount"],
            tax_amount=totals["tax_amount"],
            total=totals["total"],  # ✅ fixed comma

            footer_message=data.footer_message,
            additional_information_raw=data.additional_information_raw,

            frozen_payload_json=frozen,
            template_version="v1",
        )

        invoice.items = [
            InvoiceItem(
                sno=i["sno"],
                description=i["description"],
                quantity=i["quantity"],
                unit_price=i["unit_price"],
            )
            for i in sorted(items_dicts, key=lambda x: x["sno"])
        ]

        try:
            db.add(invoice)
            db.commit()
            db.refresh(invoice)
            logger.info(f"✅ Invoice created id={invoice.id} no={invoice.invoice_no}")
            return invoice
        except IntegrityError as e:
            db.rollback()
            # Retry only on our unique constraint for (company_id, invoice_no)
            if "uq_invoices_company_invoice_no" in str(e.orig):
                logger.warning(
                    "🔁 invoice_no collision on %s (company_id=%s), retrying... attempt=%d/%d",
                    inv_no, data.company_id, attempt, MAX_ATTEMPTS
                )
                continue
            # Unknown integrity error -> re-raise
            raise

    # If we exhausted retries
    raise ValueError("Failed to allocate a unique invoice number after multiple attempts.")


def get_invoice(db: Session, invoice_id: UUID_T) -> Optional[Invoice]:
    logger.debug(f"🔍 Fetching invoice id={invoice_id}")
    return db.get(Invoice, invoice_id)


def get_invoice_by_no(db: Session, company_id: Optional[UUID_T], invoice_no: str) -> Optional[Invoice]:
    logger.debug(f"🔍 Fetching invoice company={company_id} no={invoice_no}")
    stmt = select(Invoice).where(Invoice.company_id == company_id, Invoice.invoice_no == invoice_no)
    return db.execute(stmt).scalars().first()


def list_invoices(
    db: Session,
    *,
    client_id: Optional[UUID_T] = None,
    status: Optional[str] = None,
    qtext: Optional[str] = None,
    date_from: Optional[Union[str, date]] = None,   # "YYYY-MM-DD" or date
    date_to: Optional[Union[str, date]] = None,     # "YYYY-MM-DD" or date
    sort: Optional[str] = "invoice_date",
    order: Optional[str] = "desc",
    limit: int = 50,
    offset: int = 0,
) -> Sequence[Invoice]:
    logger.debug(
        f"📜 Listing invoices client={client_id} status={status} q={qtext!r} "
        f"from={date_from} to={date_to} sort={sort} order={order} limit={limit} offset={offset}"
    )
    stmt = select(Invoice)
    stmt = _apply_common_filters(
        stmt,
        client_id=client_id,
        status=status,
        qtext=qtext,
        date_from=date_from,
        date_to=date_to,
    )
    stmt = _apply_sort(stmt, sort=sort, order=order)
    return db.execute(stmt.limit(limit).offset(offset)).scalars().all()


def count_invoices(
    db: Session,
    *,
    client_id: Optional[UUID_T] = None,
    status: Optional[str] = None,
    qtext: Optional[str] = None,
    date_from: Optional[Union[str, date]] = None,
    date_to: Optional[Union[str, date]] = None,
) -> int:
    # ensure FROM clause is Invoice so joins in filters work
    stmt = select(func.count(Invoice.id)).select_from(Invoice)
    stmt = _apply_common_filters(
        stmt,
        client_id=client_id,
        status=status,
        qtext=qtext,
        date_from=date_from,
        date_to=date_to,
    )
    return int(db.execute(stmt).scalar() or 0)


# --- Edits disabled: keep function but block to prevent accidental use ---
def update_invoice(db: Session, invoice_id: UUID_T, data: InvoiceCreate) -> Optional[Invoice]:
    logger.info(f"✏️ Updating invoice id={invoice_id}")
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise ValueError("Invoice not found")

    # VOID invoices can never be edited; INVOICE requires edit_note (enforced at route level)
    if (inv.status or "").upper() == "VOID":
        raise ValueError("VOID invoices cannot be edited.")

    # Validate incoming payload
    validate_invoice_create(data)

    # Normalize items (plain dicts) for totals + persistence
    items_dicts = [
        {
            "sno": i.sno,
            "description": i.description,
            "quantity": i.quantity,
            "unit_price": i.unit_price,
        }
        for i in data.items
    ]

    totals = compute_totals(
        items=items_dicts,
        discount_enabled=data.discount_enabled,
        discount_type=(data.discount_type.value if getattr(data.discount_type, "value", None) else data.discount_type),
        discount_value=data.discount_value,
        tax_rate=data.tax_rate,
    )

    # Rebuild frozen payload with SAME invoice_no
    frozen = build_frozen_payload(
        db=db,
        create=data,
        invoice_no=inv.invoice_no,
        totals=totals,
        created_by_name=data.created_by_name or inv.created_by_name,
    )

    # --------- update header fields (do NOT change status or invoice_no) ----------
    inv.client_id = data.client_id
    inv.company_id = data.company_id
    inv.created_by_user_id = data.created_by_user_id or inv.created_by_user_id
    inv.created_by_name = data.created_by_name or inv.created_by_name

    inv.invoice_date = data.invoice_date
    inv.due_date = data.due_date
    inv.place_of_supply = data.place_of_supply
    inv.invoice_title = (data.invoice_title or "").strip() or None

    inv.discount_enabled = data.discount_enabled
    inv.discount_type = (data.discount_type.value if getattr(data.discount_type, "value", None) else data.discount_type)
    inv.discount_value = data.discount_value
    inv.tax_rate = data.tax_rate

    inv.subtotal = totals["subtotal"]
    inv.discount_amount = totals["discount_amount"]
    inv.tax_amount = totals["tax_amount"]
    inv.total = totals["total"]

    inv.footer_message = data.footer_message
    inv.additional_information_raw = data.additional_information_raw

    inv.frozen_payload_json = frozen
    inv.template_version = inv.template_version or "v1"

    # Stamp amendment audit trail when editing a finalized invoice
    if (inv.status or "").upper() == "INVOICE" and data.edit_note:
        inv.edit_note = data.edit_note
        from datetime import datetime as _dt
        inv.last_edited_at = _dt.utcnow().isoformat()

    # --------- REPLACE ITEMS SAFELY ----------
    # 1) Clear the relationship (lets SQLAlchemy issue DELETEs)
    inv.items.clear()
    # 2) Flush to ensure deletes happen now (prevents "deleted instance reused")
    db.flush()
    # 3) Append fresh children (NEW instances only)
    for it in sorted(items_dicts, key=lambda x: x["sno"]):
        inv.items.append(
            InvoiceItem(
                sno=it["sno"],
                description=it["description"],
                quantity=it["quantity"],
                unit_price=it["unit_price"],
            )
        )

    db.commit()
    db.refresh(inv)

    logger.info(f"✅ Invoice updated id={invoice_id}")
    return inv


def delete_invoice(db: Session, invoice_id: UUID_T) -> bool:
    logger.info(f"🗑️ Deleting invoice id={invoice_id}")
    inv = db.get(Invoice, invoice_id)
    if not inv:
        logger.warning(f"❌ Invoice not found id={invoice_id}")
        return False
    db.delete(inv)
    db.commit()
    logger.info(f"✅ Invoice deleted id={invoice_id}")
    return True


def void_invoice(db: Session, invoice_id: UUID_T, reason: Optional[str] = None) -> Optional[Invoice]:
    logger.info(f"🚫 Voiding invoice id={invoice_id} reason={reason}")
    inv = db.get(Invoice, invoice_id)
    if not inv:
        logger.error(f"❌ Invoice not found id={invoice_id}")
        return None
    if inv.status != "INVOICE":
        logger.error(f"❌ Cannot void invoice id={invoice_id}, status={inv.status}")
        return None

    inv.status = "VOID"
    db.commit()
    db.refresh(inv)
    logger.info(f"✅ Invoice voided id={invoice_id}")
    return inv


# ---------------------------
# Clone for replacement
# ---------------------------

def clone_invoice_template(db: Session, invoice_id: UUID_T) -> Optional[InvoiceCreate]:
    """
    Build an InvoiceCreate-shaped payload from an existing invoice.
    - invoice_date = today
    - due_date = today + (old_due - old_date) if both set, else today + 15
    - copies client/company refs, POS, title, discounts, tax, notes
    - copies items with sno/description/quantity/unit_price
    """
    logger.info(f"🧬 Cloning invoice template from id={invoice_id}")
    inv = db.get(Invoice, invoice_id)
    if not inv:
        logger.warning(f"❌ Invoice not found id={invoice_id}")
        return None

    today = date.today()
    default_terms_days = 15
    if inv.invoice_date and inv.due_date:
        delta_days = max(0, (inv.due_date - inv.invoice_date).days)
    else:
        delta_days = default_terms_days
    new_due = today + timedelta(days=delta_days)

    items_payload = [
        {
            "sno": (it.sno or idx + 1),
            "description": it.description or "",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
        }
        for idx, it in enumerate(sorted(inv.items or [], key=lambda x: (x.sno or 0, x.id)))
    ]

    template_dict = {
        "client_id": inv.client_id,
        "company_id": inv.company_id,
        "invoice_date": today.isoformat(),
        "due_date": new_due.isoformat(),
        "place_of_supply": inv.place_of_supply,
        "invoice_title": inv.invoice_title or None,
        "discount_enabled": bool(inv.discount_enabled),
        "discount_type": (inv.discount_type or None),
        "discount_value": str(inv.discount_value or 0),
        "tax_rate": str(inv.tax_rate or 0),
        "footer_message": inv.footer_message or None,
        "additional_information_raw": inv.additional_information_raw or None,
        "items": items_payload,
        "created_by_user_id": inv.created_by_user_id,
        "created_by_name": inv.created_by_name,
    }

    try:
        payload = InvoiceCreate.model_validate(template_dict)
    except Exception as e:
        logger.error(f"❌ Failed to build clone template for invoice {invoice_id}: {e}")
        raise

    logger.info(f"✅ Clone template ready for invoice id={invoice_id}")
    return payload


def clone_invoice(
    db: Session,
    *,
    source_id: UUID_T,
    overrides: Optional[dict] = None,
    actor: Optional[dict] = None,
) -> Invoice:
    """
    Create a NEW invoice by cloning an existing one.
    - status defaults to "DRAFT" (or override to "INVOICE")
    - invoice_date defaults to today; due_date keeps original net terms by default
    - returns the persisted Invoice ORM object
    """
    overrides = overrides or {}
    inv = db.get(Invoice, source_id)
    if not inv:
        raise InvoiceNotFound()

    # dates
    today = date.today()
    invoice_date_str = overrides.get("invoice_date") or today.isoformat()
    if inv.invoice_date and inv.due_date:
        net_days = max(0, (inv.due_date - inv.invoice_date).days)
    else:
        net_days = 15
    due_date_str = overrides.get("due_date") or (today + timedelta(days=net_days)).isoformat()

    # status
    status_val = (overrides.get("status") or "DRAFT").upper()
    if status_val not in ("DRAFT", "INVOICE"):
        raise ValueError("Invalid status override. Use 'DRAFT' or 'INVOICE'.")

    # actor (fallback to original creator)
    created_by_user_id = (actor or {}).get("sub") or inv.created_by_user_id
    created_by_name = (actor or {}).get("name") or inv.created_by_name

    # items (dicts used for totals + ORM rows)
    items_dicts = [
        {
            "sno": (it.sno or idx + 1),
            "description": it.description or "",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
        }
        for idx, it in enumerate(sorted(inv.items or [], key=lambda x: (x.sno or 0, x.id)))
    ]

    # totals (carry over original pricing config)
    totals = compute_totals(
        items=items_dicts,
        discount_enabled=bool(inv.discount_enabled),
        discount_type=inv.discount_type,
        discount_value=str(inv.discount_value or 0),
        tax_rate=str(inv.tax_rate or 0),
    )

    MAX_ATTEMPTS = 6
    for attempt in range(1, MAX_ATTEMPTS + 1):
        inv_no = next_invoice_no(db, inv.company_id)

        # Build an InvoiceCreate-like object to feed frozen payload builder
        create_like = InvoiceCreate.model_validate({
            "client_id": inv.client_id,
            "company_id": inv.company_id,
            "invoice_date": invoice_date_str,
            "due_date": due_date_str,
            "place_of_supply": inv.place_of_supply,
            "invoice_title": inv.invoice_title or None,
            "discount_enabled": bool(inv.discount_enabled),
            "discount_type": inv.discount_type or None,
            "discount_value": str(inv.discount_value or 0),
            "tax_rate": str(inv.tax_rate or 0),
            "footer_message": inv.footer_message or None,
            "additional_information_raw": inv.additional_information_raw or None,
            "items": items_dicts,
            "created_by_user_id": created_by_user_id,
            "created_by_name": created_by_name,
        })

        frozen = build_frozen_payload(
            db=db,
            create=create_like,
            invoice_no=inv_no,
            totals=totals,
            created_by_name=created_by_name,
        )

        new_invoice = Invoice(
            invoice_no=inv_no,
            status=status_val,
            client_id=inv.client_id,
            company_id=inv.company_id,
            created_by_user_id=created_by_user_id,
            created_by_name=created_by_name,

            invoice_date=date.fromisoformat(invoice_date_str),
            due_date=date.fromisoformat(due_date_str),
            place_of_supply=inv.place_of_supply,
            invoice_title=(inv.invoice_title or "").strip() or None,

            discount_enabled=bool(inv.discount_enabled),
            discount_type=(inv.discount_type or None),
            discount_value=inv.discount_value,
            tax_rate=inv.tax_rate,

            subtotal=totals["subtotal"],
            discount_amount=totals["discount_amount"],
            tax_amount=totals["tax_amount"],
            total=totals["total"],

            footer_message=inv.footer_message,
            additional_information_raw=inv.additional_information_raw,

            frozen_payload_json=frozen,
            template_version="v1",
        )

        new_invoice.items = [
            InvoiceItem(
                sno=i["sno"],
                description=i["description"],
                quantity=i["quantity"],
                unit_price=i["unit_price"],
            )
            for i in sorted(items_dicts, key=lambda x: x["sno"])
        ]

        try:
            db.add(new_invoice)
            db.commit()
            db.refresh(new_invoice)
            logger.info(
                "✅ Cloned invoice %s → %s (no=%s, status=%s)",
                str(source_id),
                str(new_invoice.id),
                new_invoice.invoice_no,
                new_invoice.status,
            )
            return new_invoice
        except IntegrityError as e:
            db.rollback()
            if "uq_invoices_company_invoice_no" in str(e.orig):
                logger.warning(
                    "🔁 clone: invoice_no collision on %s (company_id=%s), retrying... attempt=%d/%d",
                    inv_no, inv.company_id, attempt, MAX_ATTEMPTS
                )
                continue
            raise

    raise ValueError("Failed to allocate a unique invoice number for clone after multiple attempts.")


# ---------------------------
# Analytics
# ---------------------------

def record_payment(db: Session, invoice_id: UUID_T, amount: "Decimal") -> Optional[Invoice]:
    from decimal import Decimal
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise ValueError("Invoice not found")
    if (inv.status or "").upper() != "INVOICE":
        raise ValueError("Payments can only be recorded against issued invoices.")
    already_paid = Decimal(str(inv.amount_paid or 0))
    total        = Decimal(str(inv.total or 0))
    remaining    = total - already_paid
    if Decimal(str(amount)) > remaining:
        raise ValueError(
            f"Payment of ${amount} exceeds the remaining balance of ${remaining:.2f}. "
            f"Use 'Correct' to fix a payment mistake."
        )
    inv.amount_paid = already_paid + Decimal(str(amount))
    db.commit()
    db.refresh(inv)
    logger.info(f"💰 Payment recorded id={invoice_id} amount_paid={inv.amount_paid}")
    return inv


def get_invoice_stats(db: Session):
    from datetime import date as _date
    today = _date.today()

    total = db.execute(select(func.count(Invoice.id))).scalar() or 0
    draft = db.execute(select(func.count(Invoice.id)).where(Invoice.status == "DRAFT")).scalar() or 0

    paid = db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.status == "INVOICE",
            Invoice.amount_paid >= Invoice.total,
        )
    ).scalar() or 0

    outstanding = db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.status == "INVOICE",
            Invoice.amount_paid < Invoice.total,
            or_(Invoice.due_date == None, Invoice.due_date >= today),  # noqa: E711
        )
    ).scalar() or 0

    overdue = db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.status == "INVOICE",
            Invoice.amount_paid < Invoice.total,
            Invoice.due_date != None,  # noqa: E711
            Invoice.due_date < today,
        )
    ).scalar() or 0

    # Dollar amounts
    total_invoiced = float(db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(Invoice.status == "INVOICE")
    ).scalar() or 0)

    total_collected = float(db.execute(
        select(func.coalesce(func.sum(Invoice.amount_paid), 0)).where(Invoice.status == "INVOICE")
    ).scalar() or 0)

    outstanding_amount = float(db.execute(
        select(func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0)).where(
            Invoice.status == "INVOICE",
            Invoice.amount_paid < Invoice.total,
            or_(Invoice.due_date == None, Invoice.due_date >= today),  # noqa: E711
        )
    ).scalar() or 0)

    overdue_amount = float(db.execute(
        select(func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0)).where(
            Invoice.status == "INVOICE",
            Invoice.amount_paid < Invoice.total,
            Invoice.due_date != None,  # noqa: E711
            Invoice.due_date < today,
        )
    ).scalar() or 0)

    return {
        "total": int(total),
        "paid": int(paid),
        "outstanding": int(outstanding),
        "overdue": int(overdue),
        "draft": int(draft),
        "total_invoiced": total_invoiced,
        "total_collected": total_collected,
        "outstanding_amount": outstanding_amount,
        "overdue_amount": overdue_amount,
    }


def get_monthly_totals(db: Session, *, year_from: int, year_to: int):
    stmt = (
        select(
            extract("month", Invoice.invoice_date).label("m"),
            func.sum(func.coalesce(Invoice.total, 0.0)).label("invoiced_sum"),
            func.sum(func.coalesce(Invoice.amount_paid, 0.0)).label("collected_sum"),
        )
        .where(
            Invoice.status == "INVOICE",
            extract("year", Invoice.invoice_date) >= year_from,
            extract("year", Invoice.invoice_date) <= year_to,
        )
        .group_by("m")
        .order_by("m")
    )
    rows = db.execute(stmt).all()
    by_month = {int(m): (float(inv or 0), float(col or 0)) for (m, inv, col) in rows}

    out = []
    for m in range(1, 13):
        invoiced, collected = by_month.get(m, (0.0, 0.0))
        out.append({
            "month": month_abbr[m],
            "Paid": collected,
            "Outstanding": max(0.0, invoiced - collected),
            "Overdue": 0.0,
        })
    return out


def get_top_clients(
    db: Session,
    *,
    limit: int = 5,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
):
    stmt = (
        select(
            func.coalesce(ClientModel.name, "Unknown").label("client"),
            func.sum(func.coalesce(Invoice.total, 0.0)).label("paid_sum"),
        )
        .join(ClientModel, ClientModel.id == Invoice.client_id, isouter=True)
        .where(Invoice.status == "INVOICE")
    )
    if year_from is not None:
        stmt = stmt.where(extract("year", Invoice.invoice_date) >= year_from)
    if year_to is not None:
        stmt = stmt.where(extract("year", Invoice.invoice_date) <= year_to)

    stmt = stmt.group_by("client").order_by(desc(func.sum(Invoice.total))).limit(limit)
    rows = db.execute(stmt).all()

    out = []
    for client, paid_sum in rows:
        paid = float(paid_sum or 0.0)
        out.append({
            "client": client or "Unknown",
            "Paid": paid,
            "Outstanding": 0.0,
            "Overdue": 0.0,
            "Total": paid,
        })
    return out
