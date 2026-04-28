import { useState } from "react";
import type { ArchitectureInput } from "../services/types";

const API_URL = import.meta.env.VITE_API_URL;

interface BotaoPricingCalculatorProps {
  lastInput?: ArchitectureInput | null;
  pricingCalculatorUrl?: string | null;
}

export default function BotaoPricingCalculator({
  lastInput,
  pricingCalculatorUrl: initialUrl,
}: BotaoPricingCalculatorProps) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    // Se já tem URL, abrir direto
    if (url) {
      window.open(url, "_blank");
      return;
    }

    // Senão, chamar API com create_estimate=true
    if (!lastInput) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lastInput, create_estimate: true }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.pricing_calculator_url) {
        setUrl(data.pricing_calculator_url);
        window.open(data.pricing_calculator_url, "_blank");
      } else {
        setError("Não foi possível criar a estimativa. Tente novamente.");
      }
    } catch (e) {
      setError("Erro ao criar estimativa. Tente novamente.");
      console.error("Erro ao criar estimate:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || !lastInput}
        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
          loading
            ? "bg-blue-400 text-white cursor-wait"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {loading ? "Criando estimativa..." : "Gerar Estimativa no AWS Pricing Calculator"}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
