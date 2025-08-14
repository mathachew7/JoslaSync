import { CheckCircle, XCircle } from "lucide-react";
import { useEffect } from "react";

export default function DialogBox({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border min-w-[320px] max-w-md text-base font-semibold pointer-events-auto backdrop-blur-sm bg-opacity-90
        ${
          isSuccess
            ? "bg-green-50 border-green-400 text-green-700"
            : "bg-red-50 border-red-400 text-red-700"
        }`}
        style={{ backgroundColor: isSuccess ? "rgba(240, 253, 244, 0.9)" : "rgba(254, 242, 242, 0.9)" }}
      >
        {isSuccess ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600" />
        )}
        <p>{message}</p>
      </div>
    </div>
  );
}
