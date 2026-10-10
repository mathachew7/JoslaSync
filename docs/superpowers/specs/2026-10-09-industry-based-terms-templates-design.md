# Industry-based Terms & Conditions templates

## Problem

Every tenant's default Terms & Conditions document is hardcoded to describe an IT/software/web-design business (`getDefaultTerms()` in `frontend/src/utils/generateInvoicePdf.ts`), regardless of what the tenant actually does.
A construction company, a consultant, a retailer — all get the same boilerplate talking about "software development, website design, brand development, and IT services."
This text appears on every invoice PDF a tenant sends to their own clients, so it's visibly wrong for most non-IT tenants.

## Where it plugs in

The onboarding flow already exists and doesn't need to be invented:

1. An admin creates a tenant user (with a temp password).
2. That user logs in, is forced through `SetPassword.jsx`.
3. `SetPassword.jsx` redirects to `/setup` → `Setup.jsx`, a one-time "Company Setup" form.
4. `Setup.jsx` saves to the tenant's `company_profile` table via `updateCompanyProfile()`.

`company_profile` already has a `terms_and_conditions` column (added via a prior migration in `backend/app/db/database.py`).
Both the PDF generator (`generateInvoicePdf.ts`) and the later-edit page (`UserProfile.jsx`) already fall back to `getDefaultTerms(companyName, companyEmail)` whenever `terms_and_conditions` is empty.

## Scope

**In scope**: the industry selection only drives the Terms & Conditions template text. Nothing else (line-item wording, footer messages, tax behavior, etc.) is templated by industry in this pass.

**Out of scope** (explicitly, not building now):
- Auto-regenerating T&C text when a tenant changes their business type after initial setup (risk of silently overwriting hand-edited text).
- Templating anything besides T&C by industry.
- Touching the pre-existing `company_profile` vs `company_settings` dual-table inconsistency (a known, separate wart — not part of this change).

## Data model

Add one nullable column to the tenant `company_profile` table:

```
business_type VARCHAR(50) NULL
```

Migration via the existing `_migrate_tenant_columns()` pattern in `backend/app/db/database.py`:

```sql
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS business_type VARCHAR(50)
```

Add `business_type: Optional[str]` to `CompanyProfileOut` and `CompanyProfileUpdate` in `backend/app/schemas/company_profile.py` (company profile uses an upsert pattern — create and update both go through `PUT /api/company-profile`) so it round-trips through the existing endpoints. No new backend endpoints are needed.

## Categories

Six fixed categories, stored as slugs:

| Key | Label |
|---|---|
| `it_software` | IT / Software / Web Services |
| `construction` | Construction & Contracting |
| `consulting` | Consulting / Professional Services |
| `retail` | Retail / E-commerce |
| `directory` | Directory / Listings |
| `general` | General / Other |

`it_software` text is today's existing boilerplate, verbatim — no change for tenants who pick it. `general` is a neutral fallback that doesn't claim any specific service type, for anything that doesn't fit the other five.

## Frontend changes

### New file: `frontend/src/constants/businessTypes.ts`

Exports:
- `BUSINESS_TYPES: { key: string; label: string }[]` — the six categories above, for populating `<select>` options.
- `getTermsTemplate(businessType: string, companyName: string, companyEmail: string): string` — a generalized version of today's `getDefaultTerms`, branching on `businessType` to return one of six full templates (see "Template content" below). Falls back to the `it_software` template for an unrecognized or missing key, matching current behavior for existing tenants with no `business_type` set.

### `frontend/src/utils/generateInvoicePdf.ts`

`getDefaultTerms(companyName, companyEmail)` becomes `getDefaultTerms(companyName, companyEmail, businessType?)`, delegating to `getTermsTemplate` from the new constants file. The third parameter is optional so existing call sites that don't pass it keep returning the `it_software` text unchanged — no breakage for already-provisioned tenants.

### `frontend/src/pages/onboarding/Setup.jsx`

- Add `business_type` to the form state, initialized to `""`.
- Add a required `<select>` field ("Business Type") populated from `BUSINESS_TYPES`, with a blank disabled placeholder option ("Select your industry") so nothing is pre-selected — matches the "required, no default" decision.
- Add `required` validation consistent with the other required fields in this form (`company_name`, `full_name`).
- In `handleSubmit`, before building the FormData: if `form.terms_and_conditions` (there is no such field currently in this form's state — see note below) is empty, compute it via `getTermsTemplate(form.business_type, form.company_name, form.company_email)` and include it in the submitted FormData alongside the other fields.

  *Note*: `Setup.jsx`'s current form state does not include `terms_and_conditions` at all (that field is only in `UserProfile.jsx` today). This change adds it to `Setup.jsx`'s submission payload as a computed, not user-edited, value — the field itself still isn't shown as a text box on this form; the user only picks a business type here. They can review/edit the actual generated text afterward in `UserProfile.jsx`, where the full textarea already exists.

### `frontend/src/pages/companyProfile/UserProfile.jsx`

- Add the same `business_type` `<select>` (same `BUSINESS_TYPES` options) next to the existing `terms_and_conditions` textarea.
- Saving just updates the stored `business_type` value like any other profile field — it does **not** touch `terms_and_conditions`. If a tenant wants fresh template text for a newly-selected category, the existing behavior already covers it: clearing the textarea and saving falls back to `getDefaultTerms`/`getTermsTemplate` output (now using whatever `business_type` is currently selected).

## Template content

Each template mirrors the structure of the existing IT/software text (intro paragraph, Services line, 8 numbered sections), adapted per industry. Section 2 ("Intellectual Property" in the original) is retitled/adapted per category since IP transfer doesn't make sense for construction or retail work.

**`it_software`** — unchanged, current text verbatim.

**`construction`** — Services described as construction, renovation, and contracting work. Section 2 becomes "Change Orders & Project Scope" (any changes to agreed scope require written agreement and may affect price/timeline). Section 4 liability references site conditions and work performed rather than "services."

**`consulting`** — Services described as advisory/consulting engagements. Section 2 becomes "Deliverables & Work Product" (ownership of reports/recommendations transfers on full payment, same spirit as original IP section but generalized).

**`retail`** — Services described as sale of goods/products. Section 2 becomes "Returns & Refunds" (standard reasonable-window return policy placeholder) instead of IP.

**`directory`** — Services described as directory/listing services. Section 2 becomes "Listing Content & Accuracy" (client responsible for accuracy of submitted listing information).

**`general`** — Neutral language throughout ("services" instead of naming a specific service type), Section 2 stays "Deliverables" in generic form. This is the safest fallback for anything uncategorized.

All six keep the same Payment Terms / Confidentiality / Liability / Termination / Governing Law / Contact / Amendments sections from the original, reworded only enough to stay consistent with each template's Section 2 framing.

## Testing

- Register a fresh tenant, walk through `SetPassword` → `Setup.jsx`, pick a non-default category (e.g. Construction), verify the saved `company_profile.terms_and_conditions` contains the construction-specific text, and that a generated invoice PDF's Terms & Conditions page reflects it.
- Verify an existing tenant (created before this change, `business_type` is `NULL`) still renders the original `it_software` text unchanged.
- Verify changing `business_type` in `UserProfile.jsx` alone, without touching the T&C textarea, does not alter already-saved T&C text.
- Verify the `Setup.jsx` form cannot be submitted without selecting a business type.
