export default function PageHeader({ title, subtitle, children, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 ${className}`}>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  );
}
