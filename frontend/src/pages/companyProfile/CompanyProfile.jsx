// src/pages/companyProfile/CompanyProfile.jsx
import { useState } from "react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { registerCompanyProfile } from "../../api/company";
import { useNavigate } from "react-router-dom";
import DialogBox from "../../components/DialogBox";

const STATE_TAX_RATES = {
  NY: 8.875, CA: 7.25, TX: 6.25, FL: 6.0, IL: 6.25,
  MO: 4.225, NJ: 6.625, GA: 4.0, OH: 5.75, WA: 6.5,
};

export default function CompanyProfile() {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("success");
  const [dialogMessage, setDialogMessage] = useState("");
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    // company
    companyName: "",
    companyEmail: "",
    companyMobile: "",
    logoFile: null,
    address1: "",
    address2: "",
    city: "",
    state: "",
    zipCode: "",
    taxRate: "",
    status: "active",
    // admin
    adminUsername: "",
    adminEmail: "",
    adminPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [logoPreview, setLogoPreview] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "state") {
      setProfile((p) => ({ ...p, state: value, taxRate: String(STATE_TAX_RATES[value] ?? "") }));
    } else {
      setProfile((p) => ({ ...p, [name]: value }));
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0] ?? null;
    setProfile((p) => ({ ...p, logoFile: file }));
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(String(reader.result));
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  };

  const validate = () => {
    const v = {};
    const {
      companyName, companyEmail, companyMobile, logoFile,
      address1, address2, city, state, zipCode, taxRate,
      adminUsername, adminEmail, adminPassword,
    } = profile;

    if (!companyName) v.companyName = "Company Name is required";
    if (!companyEmail) v.companyEmail = "Email is required";
    else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(companyEmail)) v.companyEmail = "Invalid email format";

    if (!companyMobile) v.companyMobile = "Mobile number is required";
    else if (!/^\d{10}$/.test(companyMobile)) v.companyMobile = "Must be exactly 10 digits";

    if (!logoFile) v.logoFile = "Logo file is required";
    if (!address1) v.address1 = "Address Line 1 is required";
    if (!address2) v.address2 = "Address Line 2 is required";

    if (!city) v.city = "City is required";
    else if (!/^[a-zA-Z\s]+$/.test(city)) v.city = "Only letters allowed";

    if (!state) v.state = "State is required";
    if (!zipCode) v.zipCode = "Zip code is required";
    else if (!/^\d{5}$/.test(zipCode)) v.zipCode = "Must be 5 digits";

    if (!taxRate) v.taxRate = "Tax rate required";

    // Admin fields (required by backend)
    if (!adminUsername) v.adminUsername = "Admin username is required";
    if (!adminEmail) v.adminEmail = "Admin email is required";
    else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(adminEmail)) v.adminEmail = "Invalid email";
    if (!adminPassword) v.adminPassword = "Admin password is required";
    else if (adminPassword.length < 8) v.adminPassword = "Min 8 characters";

    setErrors(v);
    return Object.keys(v).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const formData = new FormData();
    // MUST match backend register(...) names
    formData.append("company_name", profile.companyName);
    formData.append("company_email", profile.companyEmail);
    formData.append("company_mobile", profile.companyMobile);
    if (profile.logoFile) formData.append("logoFile", profile.logoFile); // exact key
    formData.append("address1", profile.address1);
    formData.append("address2", profile.address2);
    formData.append("city", profile.city);
    formData.append("state", profile.state);
    formData.append("zip_code", profile.zipCode);
    formData.append("tax_rate", String(profile.taxRate));
    formData.append("status", profile.status);

    // admin
    formData.append("admin_username", profile.adminUsername);
    formData.append("admin_email", profile.adminEmail);
    formData.append("admin_password", profile.adminPassword);
    console.log("Submitting form data:", Object.fromEntries(formData.entries()));
    try {
      await registerCompanyProfile(formData);
      setDialogType("success");
      setDialogMessage("✅ Company registered successfully!");
      setShowDialog(true);
      setTimeout(() => navigate("/dashboard"), 1800);
    } catch (err) {
      const data = err?.response?.data;
      let msg = "❌ Something went wrong";

      // Map FastAPI/Pydantic errors to string
      if (Array.isArray(data)) {
        msg = data.map(e => {
          const path = Array.isArray(e.loc) ? e.loc.join(".") : e.loc;
          return `${path}: ${e.msg}`;
        }).join(" • ");
      } else if (Array.isArray(data?.detail)) {
        msg = data.detail.map(e => {
          const path = Array.isArray(e.loc) ? e.loc.join(".") : e.loc;
          return `${path}: ${e.msg}`;
        }).join(" • ");
      } else if (typeof data?.detail === "string") {
        msg = data.detail;
      }

      setDialogType("error");
      setDialogMessage(String(msg));
      setShowDialog(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Header />
      <main className="flex-grow flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Company Profile</h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company */}
            <Input label="Company Name" name="companyName" value={profile.companyName} onChange={handleChange} error={errors.companyName} autoComplete="organization" />
            <FileInput label="Company Logo" name="logoFile" onChange={handleFile} error={errors.logoFile} preview={logoPreview} />

            <Input label="Company Email" name="companyEmail" value={profile.companyEmail} onChange={handleChange} error={errors.companyEmail} autoComplete="email" />
            <Input label="Company Mobile" name="companyMobile" value={profile.companyMobile} onChange={handleChange} error={errors.companyMobile} autoComplete="tel" />

            <Input label="Address Line 1" name="address1" value={profile.address1} onChange={handleChange} error={errors.address1} autoComplete="address-line1" />
            <Input label="Address Line 2" name="address2" value={profile.address2} onChange={handleChange} error={errors.address2} autoComplete="address-line2" />

            <Input label="City" name="city" value={profile.city} onChange={handleChange} error={errors.city} autoComplete="address-level2" />
            <Input label="Zip Code" name="zipCode" value={profile.zipCode} onChange={handleChange} error={errors.zipCode} autoComplete="postal-code" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                name="state"
                value={profile.state}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                autoComplete="address-level1"
              >
                <option value="">Select State</option>
                {Object.keys(STATE_TAX_RATES).map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
            </div>

            <Input
              label="Tax Rate (%)"
              name="taxRate"
              value={profile.taxRate}
              onChange={handleChange}
              disabled
              error={errors.taxRate}
              autoComplete="off"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={profile.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Admin */}
            <h3 className="md:col-span-2 text-xl font-semibold text-gray-800 mt-4">Admin Account</h3>

            <Input label="Admin Username" name="adminUsername" value={profile.adminUsername} onChange={handleChange} error={errors.adminUsername} autoComplete="username" />
            <Input label="Admin Email" name="adminEmail" value={profile.adminEmail} onChange={handleChange} error={errors.adminEmail} autoComplete="email" />
            <Input type="password" label="Admin Password" name="adminPassword" value={profile.adminPassword} onChange={handleChange} error={errors.adminPassword} autoComplete="new-password" />

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-lg transition"
              >
                Save & Register
              </button>
            </div>
          </form>
        </div>
      </main>

      {showDialog && (
        <DialogBox
          message={dialogMessage}
          type={dialogType}
          onClose={() => setShowDialog(false)}
        />
      )}
      <Footer />
    </div>
  );
}

function Input({ label, name, value, onChange, error, type = "text", disabled = false, autoComplete }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`w-full px-4 py-2 border rounded-lg ${disabled ? "bg-gray-100 text-gray-500" : "border-gray-300"}`}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

function FileInput({ label, name, onChange, preview, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <label className="cursor-pointer w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-200">
        Choose File
        <input type="file" name={name} onChange={onChange} accept="image/*" className="hidden" />
      </label>
      {preview && (
        <img src={preview} alt="Logo Preview" className="mt-2 h-16 object-contain border rounded shadow" />
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
