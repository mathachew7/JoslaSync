import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AddClient() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    joined: new Date().toISOString().split("T")[0],
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("New Client:", formData); // Placeholder (will connect to Firebase later)
    navigate("/clients");
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Add New Client</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {["name", "email", "phone", "company"].map((field) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              type="text"
              name={field}
              value={formData[field]}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded text-sm"
              required={field === "name" || field === "email"}
            />
          </div>
        ))}

        {/* Notes Field */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded text-sm"
          ></textarea>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => navigate("/clients")}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 shadow"
          >
            Save Client
          </button>
        </div>
      </form>
    </div>
  );
}
