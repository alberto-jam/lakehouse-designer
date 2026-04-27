interface BotaoDownloadProps {
  templateUrl?: string;
}

export default function BotaoDownload({ templateUrl }: BotaoDownloadProps) {
  const available = !!templateUrl && templateUrl.trim().length > 0;

  const handleClick = () => {
    if (available) {
      window.open(templateUrl, "_blank");
    }
  };

  if (!available) {
    return (
      <button
        disabled
        className="px-4 py-2 text-sm font-medium rounded bg-gray-300 text-gray-500 cursor-not-allowed"
      >
        Template não disponível
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="px-4 py-2 text-sm font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
    >
      Baixar Template CloudFormation
    </button>
  );
}
