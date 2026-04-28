export default function Header() {
  return (
    <header className="bg-indigo-900 text-white px-4 py-3 sm:px-6 flex items-center gap-3">
      <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
      <h1 className="text-lg sm:text-xl font-bold tracking-tight">
        Lake House Designer
      </h1>
      <span className="ml-auto text-indigo-300 text-xs sm:text-sm">
        Forceone Access
      </span>
    </header>
  );
}
