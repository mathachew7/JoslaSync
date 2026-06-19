import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientDetail from '../../pages/clients/ClientDetail';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../api/clients', () => ({
  getClient:    vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));
vi.mock('../../api/invoices', () => ({
  listInvoices: vi.fn(),
}));

import { getClient, updateClient } from '../../api/clients';
import { listInvoices }            from '../../api/invoices';

const CLIENT_ID = 'abc-123';

const mockClient = {
  id:               CLIENT_ID,
  name:             'Jane Doe',
  company:          'Acme Inc',
  email:            'jane@acme.com',
  phone:            '5551234567',
  status:           'Active',
  address_line1:    '123 Main St',
  address_line2:    '',
  city:             'St. Louis',
  state:            'MO',
  postal_code:      '63119',
  country:          null,
  default_currency: null,
  default_tax_rate: null,
  payment_terms:    null,
  discount_rate:    null,
  notes:            'VIP',
  joined_date:      '2024-01-15',
  created_at:       '2024-01-15T10:00:00Z',
  updated_at:       '2024-01-15T10:00:00Z',
};

const emptyInvoices = { data: [], meta: { total: 0, page: 1, page_size: 5 } };

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/clients/${CLIENT_ID}`]}>
      <Routes>
        <Route path="/clients/:clientId" element={<ClientDetail />} />
        <Route path="/clients" element={<div>Clients list</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Pre-population ────────────────────────────────────────────────────────────

describe('ClientDetail — pre-population', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockResolvedValue(mockClient);
    listInvoices.mockResolvedValue(emptyInvoices);
    updateClient.mockResolvedValue(mockClient);
  });

  it('displays the client name and company in the header', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
  });

  it('shows the Active status badge', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });

  it('populates all editable fields with existing values when Edit is clicked', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@acme.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5551234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
    expect(screen.getByDisplayValue('St. Louis')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MO')).toBeInTheDocument();
    expect(screen.getByDisplayValue('63119')).toBeInTheDocument();
    expect(screen.getByDisplayValue('VIP')).toBeInTheDocument();
  });

  it('restores original values when Cancel is clicked', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    const nameInput = screen.getByDisplayValue('Jane Doe');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Changed Name');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Changed Name')).not.toBeInTheDocument();
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('ClientDetail — required field validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockResolvedValue(mockClient);
    listInvoices.mockResolvedValue(emptyInvoices);
    updateClient.mockResolvedValue(mockClient);
  });

  it('blocks save and shows error when name is cleared', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    const nameInput = screen.getByDisplayValue('Jane Doe');
    await userEvent.clear(nameInput);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(updateClient).not.toHaveBeenCalled();
  });

  it('blocks save and shows error when phone is cleared', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.clear(screen.getByDisplayValue('5551234567'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Phone is required.')).toBeInTheDocument();
    expect(updateClient).not.toHaveBeenCalled();
  });

  it('blocks save and shows error when email format is invalid', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    const emailInput = screen.getByDisplayValue('jane@acme.com');
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(updateClient).not.toHaveBeenCalled();
  });

  it('clears errors when the field is corrected', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    const phoneInput = screen.getByDisplayValue('5551234567');
    await userEvent.clear(phoneInput);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText('Phone is required.')).toBeInTheDocument();

    // Fix the field — re-query by placeholder since it's now empty
    await userEvent.type(screen.getByPlaceholderText('+1 555-000-0000'), '9876543210');
    expect(screen.queryByText('Phone is required.')).not.toBeInTheDocument();
  });
});

// ── Save payload ──────────────────────────────────────────────────────────────

describe('ClientDetail — save payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClient.mockResolvedValue(mockClient);
    listInvoices.mockResolvedValue(emptyInvoices);
    updateClient.mockResolvedValue(mockClient);
  });

  it('sends null (not empty string) for unfilled optional constrained fields', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(updateClient).toHaveBeenCalled());

    const payload = updateClient.mock.calls[0][1];
    expect(payload.default_currency).toBeNull();
    expect(payload.country).toBeNull();
    expect(payload.default_tax_rate).toBeNull();
    expect(payload.discount_rate).toBeNull();
  });

  it('converts numeric string fields to numbers before saving', async () => {
    const clientWithTax = { ...mockClient, default_tax_rate: 8.5 };
    getClient.mockResolvedValue(clientWithTax);
    updateClient.mockResolvedValue(clientWithTax);

    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(updateClient).toHaveBeenCalled());
    const payload = updateClient.mock.calls[0][1];
    expect(typeof payload.default_tax_rate).toBe('number');
    expect(payload.default_tax_rate).toBe(8.5);
  });

  it('calls updateClient with the correct client ID', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(updateClient).toHaveBeenCalled());
    expect(updateClient.mock.calls[0][0]).toBe(CLIENT_ID);
  });

  it('exits edit mode and shows success toast after a successful save', async () => {
    renderDetail();
    await waitFor(() => screen.getByText('Jane Doe'));

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});

// ── Invoice section ───────────────────────────────────────────────────────────

describe('ClientDetail — invoice history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows empty state when client has no invoices', async () => {
    getClient.mockResolvedValue(mockClient);
    listInvoices.mockResolvedValue(emptyInvoices);

    renderDetail();
    await waitFor(() =>
      expect(screen.getByText('No invoices yet for this client.')).toBeInTheDocument()
    );
  });

  it('renders invoice rows when invoices are present', async () => {
    getClient.mockResolvedValue(mockClient);
    listInvoices.mockResolvedValue({
      data: [{
        id: 'inv-1', invoice_no: 'INV-202501-00001',
        invoice_date: '2025-01-10', due_date: '2025-01-25',
        status: 'INVOICE', total: '1500.00',
      }],
      meta: { total: 1, page: 1, page_size: 5 },
    });

    renderDetail();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('INV-202501-00001')).toBeInTheDocument();
    expect(within(table).getByText('$1,500.00')).toBeInTheDocument();
  });
});
