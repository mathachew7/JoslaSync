import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white border border-blue-600",
  secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300",
  danger: "bg-red-600 hover:bg-red-700 text-white border border-red-600",
  ghost: "bg-transparent hover:bg-gray-100 text-gray-600 border border-transparent",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  icon: Icon,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 font-medium rounded-lg transition-colors
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5" />
      ) : null}
      {children}
    </button>
  );
}
