# JoslaSync — CLAUDE.md

## What this project is

**JoslaSync** is a multi-tenant SaaS invoicing platform for small/medium businesses. Each company gets its own isolated PostgreSQL database ("tenant DB"). A single "master" DB holds company registry and user accounts; each tenant DB holds clients, invoices, and company settings.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, Tailwind CSS, Recharts, jsPDF, Axios |
| Backend | FastAPI (Python), SQLAlchemy, PostgreSQL, PyJWT |
| Auth | JWT access + refresh (HttpOnly cookie) |
| Multi-tenancy | Per-company PostgreSQL databases; `db_name` embedded in JWT |
| PDF | Client-side PDF generation via jsPDF + jspdf-autotable |

---

## Directory layout

```
joslasync/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory (CORS, middleware, startup)
│   │   ├── core/
│   │   │   ├── config.py            # Settings loaded from .env (Pydantic BaseModel)
│   │   │   └── logger.py
│   │   ├── api/routes/
│   │   │   ├── __init__.py          # Single /api router — mounts all sub-routers
│   │   │   ├── auth.py              # POST /api/auth/register|login|refresh  GET /api/auth/me
│   │   │   ├── clients.py           # CRUD /api/clients
│   │   │   ├── invoice.py           # CRUD + analytics /api/invoices
│   │   │   ├── company_profile.py   # GET/PUT /api/company-profile
│   │   │   └── company_settings.py  # GET/PUT /api/company-settings
│   │   ├── db/
│   │   │   ├── database.py          # Master + tenant engine/session helpers
│   │   │   ├── deps.py              # FastAPI dependencies: get_current_user, get_company_db
│   │   │   └── models/
│   │   │       ├── master/company_profile.py   # Master DB: company registry
│   │   │       ├── user.py                     # Master DB: user accounts
│   │   │       └── tenant/
│   │   │           ├── client.py               # Tenant: clients
│   │   │           ├── company_profile.py      # Tenant: company details + logo
│   │   │           ├── company_settings.py     # Tenant: invoice prefix / settings
│   │   │           └── invoice.py              # Tenant: invoices + invoice_items
│   │   ├── schemas/                 # Pydantic request/response models
│   │   ├── crud/                    # DB query functions (invoice.py is primary)
│   │   ├── services/
│   │   │   ├── auth_service.py      # Register, login, token refresh
│   │   │   └── invoice_service.py   # compute_totals, next_invoice_no, build_frozen_payload
│   │   ├── validators/              # Business-rule validation (invoice, auth, company)
│   │   ├── repositories/            # Data-access objects (auth_repo, company_profile_repo)
│   │   └── utils/                   # security.py (JWT helpers), response_utils.py
│   ├── static/logos/                # Uploaded company logos stored here
│   ├── .env                         # Local secrets (never commit real values)
│   └── requirements.txt             # fastapi, uvicorn, sqlalchemy, psycopg2-binary, etc.
└── frontend/
    ├── src/
    │   ├── main.jsx                 # Entry: AuthProvider + BrowserRouter + App
    │   ├── context/AuthContext.tsx  # Token state + /auth/me bootstrap
    │   ├── lib/
    │   │   ├── axios.ts             # Axios instance with 401→refresh interceptor
    │   │   └── auth.ts              # initAuth(), isAuthenticated() helpers
    │   ├── api/                     # Typed API wrappers (invoices.ts, clients.ts, company.ts, auth.ts)
    │   ├── routes/AppRoutes.jsx     # React Router routes; protected/public split
    │   ├── layouts/DashboardLayout.jsx  # Sidebar + topbar shell
    │   └── pages/
    │       ├── Login.jsx / Register.jsx
    │       ├── Dashboard.jsx        # KPI cards + line chart + pie + recent invoices
    │       ├── clients/             # Clients list, AddClient, EditClient
    │       ├── invoices/            # Invoices list (charts+table), CreateInvoice, InvoiceDetails
    │       ├── companyProfile/      # CompanyProfile (master-only), UserProfile
    │       └── Reports.jsx
    ├── .env                         # VITE_JOSLASYNC_API_URL=http://localhost:8000
    │                                # VITE_MASTER_EMAIL=josla@josla.com
    └── vite.config.js
```

---

## Multi-tenancy model

1. **Register** → creates a user in master DB + a new PostgreSQL database named after the company slug → tables auto-created via `ensure_tenant_tables()`.
2. **Login** → JWT contains `db_name` (tenant DB name).
3. Every authenticated API call passes through `get_company_db` (FastAPI dep) → opens a session to the correct tenant DB.
4. Master login (hardcoded credentials from `.env`) uses `MASTER_DB_NAME` as the `db_name`.

---

## Auth flow

- **Access token**: short-lived JWT (default 30 min) sent as `Authorization: Bearer <token>`.
- **Refresh token**: longer-lived (7 days) stored in `HttpOnly` cookie (`refresh_token`).
- **Frontend**: `axios.ts` auto-retries 401s with a single-flight refresh; on failure it hard-logs out.
- **`/api/auth/me`**: bootstraps the React AuthContext on page load — returns user + company.

---

## Invoice lifecycle

Statuses: `DRAFT` → `INVOICE` → `VOID`

- **Create** (`POST /api/invoices`): creates immediately with `status=INVOICE`; computes totals server-side; generates `invoice_no` like `INV-YYYYMM-00001`; stores a **frozen JSON payload** snapshot for immutable PDF rendering.
- **Edit** (`PUT /api/invoices/:id`): only allowed on `DRAFT` or `VOID` invoices.
- **Void** (`POST /api/invoices/:id/void`): only from `INVOICE` status; does not delete.
- **Clone** (`POST /api/invoices/:id/clone`): creates a new `DRAFT` invoice copying all fields; new invoice number; optional overrides for dates/status.
- **Delete** (`DELETE /api/invoices/:id`): hard delete (no status guard currently).

**Invoice numbering**: `INV-YYYYMM-{5-digit-seq}`, per-company per-month; uses PostgreSQL advisory locks to avoid collisions under concurrency.

**Totals computation** (`invoice_service.compute_totals`): `subtotal → discount → taxable → tax → total`, all in Python `Decimal` with `ROUND_HALF_UP`.

---

## Running locally

### Prerequisites
- PostgreSQL running locally (user `admin`, password `secret`, DB `invoicedb`)
- Python 3.11+ virtualenv
- Node.js 20+

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Set real secrets in .env (JWT_SECRET, REFRESH_SECRET)
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
# .env already has VITE_JOSLASYNC_API_URL=http://localhost:8000
npm run dev
# App: http://localhost:5173
```

---

## Key environment variables (backend `.env`)

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Access token signing key |
| `REFRESH_SECRET` | Refresh token signing key |
| `DATABASE_URL` | Master DB connection string |
| `MASTER_USERNAME` / `MASTER_PASSWORD` | Hardcoded master login credentials |
| `MASTER_DB_NAME` | DB name for master JWT claims |

Frontend env (`frontend/.env`):
- `VITE_JOSLASYNC_API_URL` — backend base URL
- `VITE_MASTER_EMAIL` — used for master-only route gating

---

## API surface summary

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me

GET/POST         /api/clients
GET/PUT/DELETE   /api/clients/:id

GET/POST              /api/invoices              (paginated list + create)
GET/PUT/DELETE        /api/invoices/:id
POST                  /api/invoices/:id/void
POST                  /api/invoices/:id/clone
GET                   /api/invoices/stats
GET                   /api/invoices/analytics/monthly
GET                   /api/invoices/analytics/top-clients

GET/PUT   /api/company-profile
GET/PUT   /api/company-settings
```

---

## Known issues / areas needing work

1. **Outstanding / Overdue logic not implemented**: `get_invoice_stats` always returns `outstanding=0` and `overdue=0`. The Invoice model has no `amount_paid` field — payment tracking from the README is not yet built.
2. **`ensure_tenant_tables` does NOT import invoice models**: `database.py` has a comment `⛔️ Do NOT import invoice here unless you actually have it` — but `invoice.py` **does** now exist in `app/db/models/tenant/`. This import needs to be added so invoice tables are auto-created on first request.
3. **Company profile: master vs tenant inconsistency**: `master/company_profile.py` has only `company_name + db_name`; `tenant/company_profile.py` has full address/logo fields. They share the same `__tablename__ = "company_profile"` which can cause confusion.
4. **PDF generation is client-side only** (`frontend/src/utils/generateInvoicePdf.ts`) using jsPDF. The frozen_payload_json stored in the DB is the canonical snapshot for PDF data, but server-side PDF rendering is not yet implemented.
5. **No payment tracking**: No `payments` table exists yet despite being in the README plan.
6. **Static logo path**: Logo files saved under `backend/static/logos/` with UUIDs as filenames. No cleanup logic for old logos.
7. **DRAFT invoices**: The status enum includes DRAFT, but the create endpoint hardcodes `status="INVOICE"`. There is no UI flow for saving as draft.

---

## Code conventions

- **Backend**: Services hold business logic; CRUD holds raw DB queries; validators throw `ValueError`/`HTTPException`. All routes log with emojis for quick grepping.
- **Frontend**: API modules in `src/api/` return typed promises. `AuthContext` is the single source of truth for token/user/company. All protected routes require `isLoggedIn` (from localStorage).
- **Tenant isolation**: Never pass raw SQL; always use SQLAlchemy. Never reference master models from tenant sessions.
- **Decimal arithmetic**: Always use Python `Decimal` for monetary values; never `float`.
