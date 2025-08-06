import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function AdditionalInfoBox({ additionalInformation, setAdditionalInformation }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-6 border rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200 transition font-medium text-sm text-gray-700"
      >
        <span>Additional Information</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="p-4 bg-white border-t">
          <label className="block text-sm text-gray-600 mb-1">Details (will be shown in PDF table)</label>
          <textarea
            value={additionalInformation}
            onChange={(e) => setAdditionalInformation(e.target.value)}
            rows={4}
            placeholder={`Example:\n1. Installed reinforced door.\n2. Mounted LED screen.`}
            className="w-full border p-2 rounded text-sm"
          ></textarea>
        </div>
      )}
    </div>
  );
}
