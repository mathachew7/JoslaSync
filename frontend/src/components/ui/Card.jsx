export default function Card({ children, className = "", padding = true, ...props }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl shadow-sm ${padding ? "p-5" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }) {
  return (
    <h3 className={`text-sm font-semibold text-gray-900 ${className}`}>{children}</h3>
  );
}
