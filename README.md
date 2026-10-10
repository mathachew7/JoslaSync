# JoslaSync

A multi-tenant invoicing platform for small and medium businesses.
Each company gets its own fully isolated PostgreSQL database — not row-level filtering, a physically separate database per tenant.

Live at [joslazip.com](https://joslazip.com).
Status: [joslazip.com/health](https://joslazip.com/health).

---

## Features

- Client management, with search and per-client history
- Invoice lifecycle: draft → issued → void, with amendments and cloning
- Payment tracking against invoices, including partial payments and corrections
- PDF generation for invoices and client statements
- Dashboard and reports: revenue, outstanding balances, top clients, monthly trends
- Admin console for managing tenants, feature flags, and user accounts
- Role-based access: tenant users, company admins, and a platform-level super admin

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Recharts, jsPDF |
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| Auth | JWT (access + refresh), HttpOnly refresh cookie |
| Deployment | Docker Compose, deployed via Coolify |

---

## Local development

### Prerequisites

- PostgreSQL
- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# copy .env.example to .env and fill in real values
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Full stack via Docker Compose

```bash
cp .env.example .env   # fill in real values
docker compose up --build
```

---

## License

MIT
