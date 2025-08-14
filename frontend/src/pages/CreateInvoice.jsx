// src/pages/CreateInvoice.jsx
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { generateInvoicePdf } from "../utils/generateInvoicePdf";
import AdditionalInfoBox from "./AdditionalInfoBox";
import { listClients } from "../api/clients";

export default function CreateInvoice() {
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState("");

  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [lineItems, setLineItems] = useState([{ description: "", quantity: 1, price: 0 }]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(7);
  const [footerMessage, setFooterMessage] = useState("Thank you for your business!");
  const [additionalInformation, setAdditionalInformation] = useState("");
  const [status, setStatus] = useState("Draft");

  const [showPreview, setShowPreview] = useState(false);

  // Fetch ALL clients (handles pagination)
  useEffect(() => {
    let ignore = false;
    async function fetchAllClients() {
      setClientsLoading(true);
      setClientsError("");
      try {
        const pageSize = 100;
        let page = 1;
        let all = [];
        while (true) {
          const res = await listClients({ page, page_size: pageSize });
          all = all.concat(res.data || []);
          const total = res?.meta?.total ?? all.length;
          if (all.length >= total) break;
          page += 1;
        }
        if (!ignore) setClients(all);
      } catch (e) {
        if (!ignore) setClientsError("Failed to load clients.");
      } finally {
        if (!ignore) setClientsLoading(false);
      }
    }
    fetchAllClients();
    return () => { ignore = true; };
  }, []);

  const currentClient = useMemo(
    () => clients.find((c) => String(c.id) === String(selectedClientId)),
    [clients, selectedClientId]
  );

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const discountAmount =
    discountEnabled && discountValue > 0
      ? discountType === "percent"
        ? (subtotal * discountValue) / 100
        : discountValue
      : 0;

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxEnabled ? (discountedSubtotal * taxRate) / 100 : 0;
  const total = discountedSubtotal + taxAmount;

  const handleGeneratePdf = () => {
    const invoiceData = {
      client: currentClient || null,
      selectedClientId,
      invoiceDate,
      invoiceTitle,
      lineItems,
      discountEnabled,
      discountType,
      discountValue,
      taxEnabled,
      taxRate,
      footerMessage,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      additionalInformation,
      status,
    };
    generateInvoicePdf(invoiceData);
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] =
      field === "quantity" || field === "price"
        ? Math.max(0, parseFloat(value) || 0)
        : value;
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, price: 0 }]);
  };

  const removeLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Create New Invoice</h2>

      <div className="space-y-6 p-5 bg-white shadow rounded-lg">
        <div className="space-y-6">
          <div className="w-full flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Select Client / Company</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full border p-2 rounded"
                disabled={clientsLoading}
              >
                <option value="">
                  {clientsLoading ? "Loading clients..." : "Select..."}
                </option>
                {clientsError && <option value="" disabled>{clientsError}</option>}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "Unnamed"}{c.company ? ` (${c.company})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Invoice Type</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border p-2 rounded"
              >
                <option value="Draft">Draft</option>
                <option value="Invoice">Invoice</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Invoice Title</label>
            <input
              type="text"
              value={invoiceTitle}
              onChange={(e) => setInvoiceTitle(e.target.value)}
              placeholder="e.g., Web Design Project - July 2025"
              className="w-full border p-2 rounded"
            />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Line Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Quantity</th>
                  <th className="p-2 border">Price per Quantity ($)</th>
                  <th className="p-2 border">Total ($)</th>
                  <th className="p-2 border">Remove</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => {
                  const rowTotal = item.quantity * item.price;
                  return (
                    <tr key={index} className="text-center">
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleLineItemChange(index, "description", e.target.value)
                          }
                          className="w-full border p-1 rounded"
                          placeholder="Item description"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(index, "quantity", e.target.value)
                          }
                          className="w-20 border p-1 rounded text-center"
                          min="0"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleLineItemChange(index, "price", e.target.value)
                          }
                          className="w-28 border p-1 rounded text-center"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="p-2 border font-semibold">
                        ${rowTotal.toFixed(2)}
                      </td>
                      <td className="p-2 border">
                        <button
                          onClick={() => removeLineItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={addLineItem}
            className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow"
          >
            <Plus size={18} /> Add Item
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={discountEnabled}
                onChange={(e) => setDiscountEnabled(e.target.checked)}
              />
              Apply Discount
            </label>
            {discountEnabled && (
              <>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="border p-2 rounded"
                >
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat ($)</option>
                </select>
                <input
                  type="number"
                  value={discountValue.toString().replace(/^0+/, "") || "0"}
                  onChange={(e) =>
                    setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="border p-2 rounded w-24"
                  min="0"
                  step={discountType === "percent" ? "1" : "0.01"}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
              />
              Apply Tax
            </label>
            {taxEnabled && (
              <input
                type="number"
                value={taxRate}
                onChange={(e) =>
                  setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="border p-2 rounded w-24"
                step="0.01"
              />
            )}
          </div>

          <div className="space-y-1 text-gray-700">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discountEnabled && discountAmount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>
                  Discount (
                  {discountType === "percent"
                    ? `${discountValue}%`
                    : `Flat $${discountValue}`}
                  ):
                </span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            {taxEnabled && taxAmount > 0 && (
              <div className="flex justify-between">
                <span>Tax ({taxRate}%):</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-lg">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <AdditionalInfoBox
          additionalInformation={additionalInformation}
          setAdditionalInformation={setAdditionalInformation}
        />

        <div className="mt-6">
          <label className="block text-sm text-gray-600 mb-1">Footer Message</label>
          <textarea
            value={footerMessage}
            onChange={(e) => setFooterMessage(e.target.value)}
            rows={3}
            className="w-full border p-2 rounded"
          ></textarea>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setShowPreview(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Show HTML Preview
        </button>
        <button
          onClick={handleGeneratePdf}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
        >
          Generate PDF
        </button>
      </div>

      {showPreview && (
        <div className="p-6 mt-6 bg-white shadow rounded-lg border">
          <h2 className="text-xl font-bold text-center mb-4">
            {invoiceTitle || "Invoice Preview"}
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            {(currentClient?.name || "Client Name") +
              (currentClient?.company ? ` (${currentClient.company})` : "")}{" "}
            — {invoiceDate}
          </p>

          <table className="w-full text-sm border mb-6">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Description</th>
                <th className="p-2 border">Quantity</th>
                <th className="p-2 border">Price ($)</th>
                <th className="p-2 border">Total ($)</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index} className="text-center">
                  <td className="p-2 border">{item.description || "-"}</td>
                  <td className="p-2 border">{item.quantity}</td>
                  <td className="p-2 border">{item.price.toFixed(2)}</td>
                  <td className="p-2 border">
                    {(item.quantity * item.price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-gray-700 text-right">
            <div>Subtotal: ${subtotal.toFixed(2)}</div>
            {discountEnabled && discountAmount > 0 && (
              <div className="text-red-500">
                Discount (
                {discountType === "percent"
                  ? `${discountValue}%`
                  : `Flat $${discountValue}`}
                ): -${discountAmount.toFixed(2)}
              </div>
            )}
            {taxEnabled && taxAmount > 0 && (
              <div>Tax ({taxRate}%): ${taxAmount.toFixed(2)}</div>
            )}
            <div className="font-bold text-lg">Total: ${total.toFixed(2)}</div>
          </div>

          <p className="text-center mt-6 text-gray-600 italic">{footerMessage}</p>
        </div>
      )}
    </div>
  );
}
