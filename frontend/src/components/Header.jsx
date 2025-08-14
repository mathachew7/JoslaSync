import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="flex justify-between items-center px-6 py-4 bg-gray-800 text-white">
      <h1 className="text-xl font-bold">Joslasync</h1>
      <Link to="/company-profile" className="hover:underline text-sm">
        Profile
      </Link>
    </header>
  );
}
