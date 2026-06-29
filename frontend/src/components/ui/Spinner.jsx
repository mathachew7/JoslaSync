import { Loader2 } from "lucide-react";

export default function Spinner({ size = "md", className = "" }) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return <Loader2 className={`animate-spin text-blue-600 ${sizes[size]} ${className}`} />;
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <Spinner size="lg" />
    </div>
  );
}
