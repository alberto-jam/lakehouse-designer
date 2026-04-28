interface BotaoPricingCalculatorProps {
  pricingCalculatorUrl?: string | null;
}

export default function BotaoPricingCalculator({
  pricingCalculatorUrl,
}: BotaoPricingCalculatorProps) {
  const available =
    !!pricingCalculatorUrl && pricingCalculatorUrl.trim().length > 0;

  const handleClick = () => {
    if (available) {
      window.open(pricingCalculatorUrl, "_blank");
    }
  };

  if (!available) {
    return (
      <button
        disabled
        className="px-4 py-2 text-sm font-medium rounded bg-gray-300 text-gray-500 cursor-not-allowed"
      >
        Estimativa não disponível
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="px-4 py-2 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
    >
      Ver no AWS Pricing Calculator
    </button>
  );
}
