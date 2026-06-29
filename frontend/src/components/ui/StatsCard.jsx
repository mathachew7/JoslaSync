import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function StatsCard({ label, value, subtext, icon: Icon, iconColor = "blue", trend, trendLabel, className = "" }) {
  const iconColors = {
    blue:   "bg-blue-50 text-blue-600",
    green:  "bg-emerald-50 text-emerald-600",
    amber:  "bg-amber-50 text-amber-600",
    red:    "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
    gray:   "bg-gray-100 text-gray-500",
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-400";

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
          {trend && trendLabel && (
            <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              <span className="text-xs font-medium">{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColors[iconColor]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
