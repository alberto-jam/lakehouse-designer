import type { ArchitectureOutput } from "../services/types";
import TabelaCusto from "./TabelaCusto";
import DiagramaMermaid from "./DiagramaMermaid";
import BotaoDownload from "./BotaoDownload";

interface ResultadoArquiteturaProps {
  result: ArchitectureOutput;
}

const ARCH_LABELS: Record<string, string> = {
  full_lakehouse_with_redshift: "Full Lakehouse com Redshift",
  light_lakehouse_athena: "Light Lakehouse com Athena",
};

function formatArchType(type: string): string {
  return ARCH_LABELS[type] ?? type;
}

export default function ResultadoArquitetura({ result }: ResultadoArquiteturaProps) {
  return (
    <div className="space-y-6">
      {/* Architecture type */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Tipo de Arquitetura
        </h2>
        <p className="text-indigo-700 font-medium text-base">
          {formatArchType(result.architecture_type)}
        </p>
      </div>

      {/* Recommended services */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Serviços Recomendados
        </h2>
        <div className="flex flex-wrap gap-2">
          {result.services.map((svc) => (
            <span
              key={svc}
              className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-3 py-1 rounded-full"
            >
              {svc}
            </span>
          ))}
        </div>
      </div>

      {/* Message */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Mensagem</h2>
        <p className="text-gray-700 text-sm">{result.message}</p>
      </div>

      {/* Cost table */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Estimativa de Custo Mensal
        </h2>
        <TabelaCusto
          costBreakdown={result.cost_breakdown_per_service}
          totalCost={result.estimated_monthly_cost_usd}
        />
      </div>

      {/* Mermaid diagram */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Diagrama de Arquitetura
        </h2>
        <DiagramaMermaid chart={result.diagram_mermaid} />
      </div>

      {/* Provisioning steps */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Passos de Provisionamento
        </h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          {result.provisioning_steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Download button */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Template CloudFormation
        </h2>
        <BotaoDownload templateUrl={result.cloudformation_template_url} />
      </div>
    </div>
  );
}
