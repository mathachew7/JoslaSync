import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const DURATION = 3000;

export default function WelcomeModal() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const timerRef  = useRef(null);
  const shownRef  = useRef(false);   // guard so the timer is only ever set once

  useEffect(() => {
    if (!user?.id || shownRef.current) return;

    const key = `josla_welcomed_${user.id}`;
    if (localStorage.getItem(key)) return;

    shownRef.current = true;
    localStorage.setItem(key, "1");
    setVisible(true);

    // Store the timer in a ref — NOT in the effect's cleanup,
    // so a re-run (if user?.id value changes type e.g. number→string) can't cancel it.
    timerRef.current = setTimeout(() => setVisible(false), DURATION);
  }, [user?.id]);

  // Only clear on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20">
      <div className="relative bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3 animate-fade-in-up">

        {/* Close button */}
        <button
          onClick={() => { clearTimeout(timerRef.current); setVisible(false); }}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <span className="text-4xl">👋</span>
        <h2 className="text-2xl font-bold text-gray-800">
          Hello, welcome to JoslaSync!
        </h2>
        <p className="text-sm text-gray-500">
          Hi <span className="font-semibold text-blue-600">{user?.username}</span>, glad to have you here.
        </p>

        {/* Shrinking progress bar */}
        <div className="w-full h-1 rounded-full bg-gray-100 overflow-hidden mt-2">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ animation: `shrink ${DURATION}ms linear forwards` }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
