# app/api/routes/invoice.py
from typing import Optional, List
from uuid import UUID
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.deps import get_company_db, get_current_user
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceRead,
    InvoiceStats,
    MonthlyTotalsRow,
    TopClientRow,
    InvoiceListResponse,
    PaginationMeta,
    PaymentRequest,
    PaymentAdjustRequest,
    PaymentOut,
    SendInvoiceRequest,
)
from app.crud import invoice as invoice_crud
from app.crud import payment as payment_crud
from app.crud.invoice import log_invoice_event

router = APIRouter(prefix="/invoices", tags=["invoices"])

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    client_id: Optional[UUID] = Query(None, description="Filter by client_id"),
    status: Optional[str] = Query(
        None,
        description="INVOICE|VOID|DRAFT|QUOTE",
        pattern="^(INVOICE|VOID|DRAFT|QUOTE)$",
    ),
    q: Optional[str] = Query(None, description="Search invoice_no, client name/email/company"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    due_before: Optional[str] = Query(None, description="YYYY-MM-DD — filter invoices with due_date before this"),
    due_after: Optional[str] = Query(None, description="YYYY-MM-DD — filter invoices with due_date after this"),
    sort: Optional[str] = Query("invoice_date", description="invoice_date|created_at|total|invoice_no|due_date"),
    order: Optional[str] = Query("desc", description="asc|desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    offset = (page - 1) * page_size
    logger.info(
        f"➡️ GET /invoices | user={uname} client_id={client_id} status={status} "
        f"q={q!r} date_from={date_from} date_to={date_to} due_before={due_before} sort={sort} order={order} page={page} size={page_size}"
    )

    total = invoice_crud.count_invoices(
        db,
        client_id=client_id,
        status=status,
        qtext=q,
        date_from=date_from,
        date_to=date_to,
        due_before=due_before,
        due_after=due_after,
    )
    rows = invoice_crud.list_invoices(
        db,
        client_id=client_id,
        status=status,
        qtext=q,
        date_from=date_from,
        date_to=date_to,
        due_before=due_before,
        due_after=due_after,
        sort=sort,
        order=order,
        limit=page_size,
        offset=offset,
    ) or []

    data = [InvoiceRead.model_validate(r) for r in rows]
    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total=total,
        pages=ceil(total / page_size) if page_size else 1,
    )
    logger.info(f"✅ /invoices | returned={len(data)} total={total} page={page}")
    return InvoiceListResponse(data=data, meta=meta)


# -------------------------
# Analytics (keep ABOVE /{invoice_id})
# -------------------------

@router.get("/stats", response_model=InvoiceStats)
def invoice_stats(
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ GET /invoices/stats | user={uname}")
    return invoice_crud.get_invoice_stats(db)


@router.get("/analytics/monthly", response_model=List[MonthlyTotalsRow])
def invoice_monthly_totals(
    year_from: int = Query(..., ge=1970),
    year_to: int = Query(..., ge=1970),
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ GET /invoices/analytics/monthly | user={uname} year_from={year_from} year_to={year_to}")
    return invoice_crud.get_monthly_totals(db, year_from=year_from, year_to=year_to)


@router.get("/analytics/top-clients", response_model=List[TopClientRow])
def invoice_top_clients(
    limit: int = Query(5, ge=1, le=50),
    year_from: Optional[int] = Query(None, ge=1970),
    year_to: Optional[int] = Query(None, ge=1970),
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(
        f"➡️ GET /invoices/analytics/top-clients | user={uname} limit={limit} year_from={year_from} year_to={year_to}"
    )
    return invoice_crud.get_top_clients(db, limit=limit, year_from=year_from, year_to=year_to)


# -------------------------
# Item routes (keep AFTER analytics to avoid 422 on /stats)
# -------------------------

@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ GET /invoices/{invoice_id} | user={uname}")
    obj = invoice_crud.get_invoice(db, invoice_id)
    if not obj:
        logger.info(f"❌ /invoices/{invoice_id} | not found")
        raise HTTPException(status_code=404, detail="Invoice not found")
    logger.info(f"✅ /invoices/{invoice_id} | found")
    return InvoiceRead.model_validate(obj)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=InvoiceRead)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "system"
    items_count = len(payload.items or [])
    logger.info(
        f"➡️ POST /invoices | user={uname} client_id={payload.client_id} items={items_count} "
        f"date={payload.invoice_date} title={payload.invoice_title or ''!r}"
    )
    try:
        obj = invoice_crud.create_invoice(db, payload)
    except HTTPException:
        raise
    except ValueError as e:
        logger.info(f"❌ /invoices create | {e}")
        raise HTTPException(status_code=400, detail=str(e))
    logger.info(f"✅ /invoices created | id={obj.id} no={obj.invoice_no} total={obj.total}")
    actor = user.get("username") or user.get("sub")
    log_invoice_event(db, obj.id, "created", "Invoice created", actor)
    return InvoiceRead.model_validate(obj)


# --- Edits: DRAFT freely; INVOICE requires edit_note (owner override) ---
@router.put("/{invoice_id}", response_model=InvoiceRead)
def update_invoice(
    invoice_id: UUID,
    payload: InvoiceCreate,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "system"
    logger.info(f"➡️ PUT /invoices/{invoice_id} | user={uname}")

    current = invoice_crud.get_invoice(db, invoice_id)
    if not current:
        raise HTTPException(status_code=404, detail="Invoice not found")

    current_status = (current.status or "").upper()
    if current_status == "VOID":
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="VOID invoices cannot be edited. Clone to create a new one.",
        )

    if current_status == "INVOICE" and not (payload.edit_note or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="edit_note is required when amending a finalized invoice.",
        )

    try:
        obj = invoice_crud.update_invoice(db, invoice_id, payload)
    except ValueError as e:
        logger.info(f"❌ /invoices/{invoice_id} update | {e}")
        raise HTTPException(status_code=400, detail=str(e))

    logger.info(f"✅ /invoices/{invoice_id} updated (status={current_status} note={payload.edit_note!r})")
    actor = user.get("username") or user.get("sub")
    log_invoice_event(db, invoice_id, "amended", payload.edit_note if payload.edit_note else None, actor)
    return InvoiceRead.model_validate(obj)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "system"
    logger.info(f"➡️ DELETE /invoices/{invoice_id} | user={uname}")
    ok = invoice_crud.delete_invoice(db, invoice_id)
    if not ok:
        logger.info(f"❌ /invoices/{invoice_id} delete | not found")
        raise HTTPException(status_code=404, detail="Invoice not found")
    logger.info(f"✅ /invoices/{invoice_id} deleted")
    return None


# --- Issue: promote DRAFT → INVOICE ---
@router.post("/{invoice_id}/issue", response_model=InvoiceRead)
def issue_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ POST /invoices/{invoice_id}/issue | user={uname}")
    obj = invoice_crud.get_invoice(db, invoice_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if (obj.status or "").upper() != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT invoices can be issued.")
    obj.status = "INVOICE"
    db.commit()
    db.refresh(obj)
    logger.info(f"✅ /invoices/{invoice_id}/issue | issued")
    actor = user.get("username") or user.get("sub")
    log_invoice_event(db, invoice_id, "issued", None, actor)
    return InvoiceRead.model_validate(obj)


# --- Accept: promote QUOTE → INVOICE ---
@router.post("/{invoice_id}/accept", response_model=InvoiceRead)
def accept_quote(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ POST /invoices/{invoice_id}/accept | user={uname}")
    obj = invoice_crud.get_invoice(db, invoice_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if (obj.status or "").upper() != "QUOTE":
        raise HTTPException(status_code=400, detail="Only QUOTE invoices can be accepted.")
    inv_no = invoice_crud.next_invoice_no(db, obj.company_id)
    obj.invoice_no = inv_no
    obj.status = "INVOICE"
    db.commit()
    db.refresh(obj)
    actor = user.get("username") or user.get("sub")
    log_invoice_event(db, invoice_id, "accepted", None, actor)
    logger.info(f"✅ /invoices/{invoice_id}/accept | accepted, invoice_no={inv_no}")
    return InvoiceRead.model_validate(obj)


# --- Safe VOID (only from INVOICE) ---
@router.post("/{invoice_id}/void", response_model=InvoiceRead)
def void_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ POST /invoices/{invoice_id}/void | user={uname}")

    obj = invoice_crud.void_invoice(db, invoice_id)
    if obj is None:
        logger.info(f"❌ /invoices/{invoice_id}/void | cannot void (not found or wrong status)")
        raise HTTPException(
            status_code=400,
            detail="Invoice cannot be voided (either not found or already not in INVOICE status)."
        )

    logger.info(f"✅ /invoices/{invoice_id}/void | status={obj.status}")
    actor = user.get("username") or user.get("sub")
    log_invoice_event(db, invoice_id, "voided", None, actor)
    return InvoiceRead.model_validate(obj)


# --- Record payment ---
@router.post("/{invoice_id}/pay", response_model=InvoiceRead)
def record_payment(
    invoice_id: UUID,
    payload: PaymentRequest,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ POST /invoices/{invoice_id}/pay | user={uname} amount={payload.amount}")
    actor = user.get("username") or user.get("sub")
    try:
        obj = payment_crud.record_payment(db, invoice_id, payload.amount, payload.note, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    logger.info(f"✅ /invoices/{invoice_id}/pay | amount_paid={obj.amount_paid}")
    log_invoice_event(db, invoice_id, "payment", f"Payment of ${payload.amount} recorded", actor)
    return InvoiceRead.model_validate(obj)


# --- Payment ledger: list + void individual entries ---
@router.get("/{invoice_id}/payments", response_model=List[PaymentOut])
def list_payments(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    rows = payment_crud.list_payments(db, invoice_id)
    return [PaymentOut.model_validate(r) for r in rows]


@router.post("/{invoice_id}/payments/{payment_id}/void", response_model=InvoiceRead)
def void_payment(
    invoice_id: UUID,
    payment_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    actor = user.get("username") or user.get("sub")
    logger.info(f"➡️ POST /invoices/{invoice_id}/payments/{payment_id}/void | user={uname}")
    try:
        obj = payment_crud.void_payment(db, invoice_id, payment_id, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    logger.info(f"✅ /invoices/{invoice_id}/payments/{payment_id}/void | amount_paid={obj.amount_paid}")
    log_invoice_event(db, invoice_id, "payment_voided", f"Payment {payment_id} voided", actor)
    return InvoiceRead.model_validate(obj)


# --- Correct / adjust payment (owner override) ---
@router.put("/{invoice_id}/payment", response_model=InvoiceRead)
def adjust_payment(
    invoice_id: UUID,
    payload: PaymentAdjustRequest,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    actor = user.get("username") or user.get("sub")
    logger.info(f"➡️ PUT /invoices/{invoice_id}/payment | user={uname} set_amount={payload.amount_paid}")
    try:
        inv = payment_crud.correct_payment(db, invoice_id, payload.amount_paid, payload.note, actor)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    from datetime import datetime
    inv.last_edited_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(inv)
    logger.info(f"✅ /invoices/{invoice_id}/payment adjusted | amount_paid={inv.amount_paid}")
    log_invoice_event(db, invoice_id, "payment_corrected", payload.note or "Payment corrected", actor)
    return InvoiceRead.model_validate(inv)


# --- Send invoice by email ---
@router.post("/{invoice_id}/send")
def send_invoice(
    invoice_id: UUID,
    payload: SendInvoiceRequest,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    from app.utils.email import send_invoice_email
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ POST /invoices/{invoice_id}/send | user={uname} to={payload.to_email}")

    inv = invoice_crud.get_invoice(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if (inv.status or "").upper() != "INVOICE":
        raise HTTPException(status_code=400, detail="Only issued invoices can be sent.")

    try:
        from app.db.models.tenant.company_profile import CompanyProfile
        cp = db.query(CompanyProfile).filter(CompanyProfile.id == inv.company_id).first() if inv.company_id else None
        company_name = getattr(cp, "company_name", None) or "Company"
        total_str = f"${float(inv.total or 0):,.2f}"
        due_str = str(inv.due_date) if inv.due_date else ""

        send_invoice_email(
            to_email=payload.to_email,
            to_name=payload.to_name,
            invoice_no=inv.invoice_no,
            company_name=company_name,
            total=total_str,
            due_date=due_str,
            pdf_base64=payload.pdf_base64,
            pdf_filename=payload.pdf_filename,
            reply_to=getattr(cp, "company_email", None),
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception(f"💥 /invoices/{invoice_id}/send | {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    logger.info(f"✅ /invoices/{invoice_id}/send | sent to {payload.to_email}")
    return {"message": f"Invoice {inv.invoice_no} sent to {payload.to_email}"}


# --- Send overdue reminder ---
@router.post("/{invoice_id}/remind")
def remind_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    from datetime import date, datetime
    from app.utils.email import send_reminder_email
    from app.db.models.tenant.company_settings import CompanySettings
    from app.db.models.tenant.client import Client as ClientModel
    from app.db.models.tenant.company_profile import CompanyProfile

    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ POST /invoices/{invoice_id}/remind | user={uname}")

    inv = invoice_crud.get_invoice(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if (inv.status or "").upper() != "INVOICE":
        raise HTTPException(status_code=400, detail="Reminders can only be sent for issued invoices.")
    if float(inv.amount_paid or 0) >= float(inv.total or 0):
        raise HTTPException(status_code=400, detail="Invoice is already fully paid.")

    client = db.get(ClientModel, inv.client_id)
    if not client or not client.email:
        raise HTTPException(status_code=400, detail="Client has no email address.")

    cp = db.query(CompanyProfile).filter(CompanyProfile.id == inv.company_id).first() if inv.company_id else None
    company_name = getattr(cp, "company_name", None) or "Company"

    today = date.today()
    days_overdue = (today - inv.due_date).days if inv.due_date else 0
    new_count = (inv.reminder_count or 0) + 1

    try:
        send_reminder_email(
            to_email=client.email,
            to_name=client.name or client.email,
            invoice_no=inv.invoice_no,
            company_name=company_name,
            total=f"${float(inv.total or 0):,.2f}",
            amount_paid=f"${float(inv.amount_paid or 0):,.2f}",
            due_date=str(inv.due_date) if inv.due_date else "—",
            days_overdue=max(0, days_overdue),
            reminder_count=new_count,
            reply_to=getattr(cp, "company_email", None),
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception(f"💥 remind failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send reminder: {str(e)}")

    inv.last_reminder_sent_at = today.isoformat()
    inv.reminder_count = new_count
    db.commit()
    db.refresh(inv)

    logger.info(f"✅ Reminder #{new_count} sent for invoice {inv.invoice_no} to {client.email}")
    return InvoiceRead.model_validate(inv)


# --- Clone for replacement (persisted) ---
@router.post("/{invoice_id}/clone", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def clone_invoice(
    invoice_id: UUID,
    overrides: dict = Body(default_factory=dict),  # optional: {"invoice_date": "YYYY-MM-DD", "due_date": "YYYY-MM-DD", "status": "DRAFT"}
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    """
    Clone an existing invoice into a NEW invoice (defaults to DRAFT) and return the created record.
    The original invoice remains unchanged (VOID or otherwise).
    Optional overrides: invoice_date, due_date, status ("DRAFT"|"INVOICE")
    """
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ POST /invoices/{invoice_id}/clone | user={uname} overrides={overrides!r}")

    try:
        new_obj = invoice_crud.clone_invoice(db=db, source_id=invoice_id, overrides=overrides, actor=user)
    except invoice_crud.InvoiceNotFound:
        logger.info(f"❌ /invoices/{invoice_id}/clone | not found")
        raise HTTPException(status_code=404, detail="Invoice not found")
    except ValueError as e:
        logger.info(f"❌ /invoices/{invoice_id}/clone | {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception(f"💥 /invoices/{invoice_id}/clone | unexpected error")
        raise HTTPException(status_code=500, detail="Failed to clone invoice")

    logger.info(f"✅ /invoices/{invoice_id}/clone | new_id={new_obj.id} new_no={new_obj.invoice_no}")
    actor = user.get("username") or user.get("sub")
    # Log on the source invoice
    try:
        log_invoice_event(db, invoice_id, "cloned", f"Cloned to #{new_obj.invoice_no}", actor)
    except Exception:
        pass  # source may be deleted; don't block the response
    # Log on the new invoice
    log_invoice_event(db, new_obj.id, "cloned", f"Cloned from #{invoice_id}", actor)
    return InvoiceRead.model_validate(new_obj)


# --- Activity log ---
@router.get("/{invoice_id}/events")
def get_invoice_events(
    invoice_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    from app.db.models.tenant.invoice_event import InvoiceEvent
    from sqlalchemy import select, desc as sa_desc

    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ GET /invoices/{invoice_id}/events | user={uname}")

    inv = invoice_crud.get_invoice(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    stmt = (
        select(InvoiceEvent)
        .where(InvoiceEvent.invoice_id == invoice_id)
        .order_by(sa_desc(InvoiceEvent.created_at))
    )
    events = db.execute(stmt).scalars().all()
    logger.info(f"✅ /invoices/{invoice_id}/events | returned={len(events)}")
    return [
        {
            "id": e.id,
            "invoice_id": str(e.invoice_id),
            "event_type": e.event_type,
            "description": e.description,
            "created_by": e.created_by,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
