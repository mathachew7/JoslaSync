export function Table({ children, className = "" }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead className="border-b border-gray-200">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ children, className = "", align = "left" }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-${align} ${className}`}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function Tr({ children, onClick, className = "" }) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? "cursor-pointer hover:bg-gray-50" : ""} transition-colors ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className = "", align = "left" }) {
  return (
    <td className={`px-4 py-3 text-gray-700 text-${align} ${className}`}>{children}</td>
  );
}
