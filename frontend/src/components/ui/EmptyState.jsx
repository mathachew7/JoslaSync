import Button from "./Button";

export default function EmptyState({ icon: Icon, title, subtitle, action, actionLabel, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-gray-400" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-500 max-w-xs mb-4">{subtitle}</p>}
      {action && actionLabel && (
        <Button size="sm" onClick={action}>{actionLabel}</Button>
      )}
    </div>
  );
}
