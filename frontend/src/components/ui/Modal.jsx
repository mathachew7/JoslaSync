import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, size = "md", className = "" }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-white rounded-xl shadow-xl border border-gray-200 ${className}`}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ModalFooter({ children, className = "" }) {
  return (
    <div className={`flex items-center justify-end gap-2 pt-4 border-t border-gray-100 mt-4 ${className}`}>
      {children}
    </div>
  );
}
