interface HeaderProps {
  onOpenCredentials: () => void;
}

export default function Header({ onOpenCredentials }: HeaderProps) {
  return (
    <header className="bg-indigo-900 text-white px-4 py-3 sm:px-6 flex items-center justify-between">
      <h1 className="text-lg sm:text-xl font-bold tracking-tight">
        Lake House Designer
      </h1>
      <button
        onClick={onOpenCredentials}
        className="bg-indigo-700 hover:bg-indigo-600 text-white text-sm px-3 py-1.5 rounded transition-colors"
      >
        Alterar Credenciais
      </button>
    </header>
  );
}
