const variants = {
  green:  "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber:  "bg-amber-50 text-amber-700 ring-amber-600/20",
  red:    "bg-red-50 text-red-700 ring-red-600/20",
  blue:   "bg-blue-50 text-blue-700 ring-blue-600/20",
  gray:   "bg-gray-100 text-gray-600 ring-gray-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

const dotColors = {
  green:  "bg-emerald-500",
  amber:  "bg-amber-500",
  red:    "bg-red-500",
  blue:   "bg-blue-500",
  gray:   "bg-gray-400",
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
};

export default function Badge({ children, variant = "gray", dot = false, className = "" }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset
        ${variants[variant]} ${className}
      `}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
