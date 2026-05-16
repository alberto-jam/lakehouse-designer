import type { CostEstimate } from '../../services/typesV2';

export interface CostBreakdownProps {
  costEstimate: CostEstimate;
}

const formatUSD = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/**
 * Attempts to parse a timestamp prefix from a note string.
 * Supports formats like:
 *   "[2024-01-15T10:30:00Z] message"
 *   "[2024-01-15 10:30:00] message"
 *   "2024-01-15T10:30:00Z - message"
 * Returns { timestamp, message } if found, otherwise { timestamp: null, message: original }
 */
function parseNoteTimestamp(note: string): { timestamp: string | null; message: string } {
  // Pattern: [ISO timestamp] rest of message
  const bracketMatch = note.match(/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[Z]?)\]\s*(.*)$/);
  if (bracketMatch) {
    const date = new Date(bracketMatch[1]);
    if (!isNaN(date.getTime())) {
      return {
        timestamp: date.toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
        message: bracketMatch[2],
      };
    }
  }

  // Pattern: ISO timestamp - rest of message
  const dashMatch = note.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[Z]?)\s*[-–]\s*(.*)$/);
  if (dashMatch) {
    const date = new Date(dashMatch[1]);
    if (!isNaN(date.getTime())) {
      return {
        timestamp: date.toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
        message: dashMatch[2],
      };
    }
  }

  return { timestamp: null, message: note };
}

export function CostBreakdown({ costEstimate }: CostBreakdownProps) {
  const {
    monthly_total_usd,
    breakdown,
    assumptions,
    notes,
    pricing_location,
    pricing_api_region,
  } = costEstimate;

  return (
    <div className="space-y-6">
      {/* Monthly Total - Prominent Display */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
          Custo Mensal Estimado
        </p>
        <p
          className="text-3xl font-bold text-slate-900 mt-1"
          data-testid="monthly-total"
        >
          {formatUSD(monthly_total_usd)}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          por mês (USD)
        </p>
      </div>

      {/* Breakdown Table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Breakdown por Serviço
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" data-testid="cost-table">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-4 py-2 border border-slate-200 font-semibold text-slate-700">
                  Serviço
                </th>
                <th className="text-right px-4 py-2 border border-slate-200 font-semibold text-slate-700">
                  Custo Mensal (USD)
                </th>
                <th className="text-right px-4 py-2 border border-slate-200 font-semibold text-slate-700">
                  Preço Unitário
                </th>
                <th className="text-right px-4 py-2 border border-slate-200 font-semibold text-slate-700">
                  Quantidade
                </th>
                <th className="text-left px-4 py-2 border border-slate-200 font-semibold text-slate-700">
                  Unidade
                </th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((item) => (
                <tr key={item.service} className="hover:bg-slate-50">
                  <td className="px-4 py-2 border border-slate-200 text-slate-800">
                    {item.service}
                  </td>
                  <td className="px-4 py-2 border border-slate-200 text-right text-slate-800">
                    {formatUSD(item.monthly_cost_usd)}
                  </td>
                  <td className="px-4 py-2 border border-slate-200 text-right text-slate-800">
                    {formatUSD(item.unit_price)}
                  </td>
                  <td className="px-4 py-2 border border-slate-200 text-right text-slate-800">
                    {item.quantity.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-2 border border-slate-200 text-slate-600">
                    {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100">
                <td className="px-4 py-2 border border-slate-200 font-bold text-slate-900">
                  Total
                </td>
                <td className="px-4 py-2 border border-slate-200 text-right font-bold text-slate-900">
                  {formatUSD(monthly_total_usd)}
                </td>
                <td colSpan={3} className="px-4 py-2 border border-slate-200" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Assumptions */}
      {assumptions.length > 0 && (
        <div data-testid="assumptions-section">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Premissas
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
            {assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes / Audit Trail with Timestamps */}
      {notes.length > 0 && (
        <div data-testid="notes-section">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Notas e Audit Trail
          </h3>
          <ul className="space-y-2 text-sm">
            {notes.map((note, index) => {
              const { timestamp, message } = parseNoteTimestamp(note);
              return (
                <li
                  key={index}
                  className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-b-0"
                >
                  <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                  <div className="flex-1">
                    {timestamp && (
                      <span className="inline-block text-xs font-mono text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 mr-2">
                        {timestamp}
                      </span>
                    )}
                    <span className="text-slate-600">{message}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pricing Metadata */}
      <div
        className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200"
        data-testid="pricing-metadata"
      >
        <span>
          <span className="font-medium text-slate-600">Pricing Location:</span>{' '}
          {pricing_location}
        </span>
        <span>
          <span className="font-medium text-slate-600">Pricing API Region:</span>{' '}
          {pricing_api_region}
        </span>
      </div>
    </div>
  );
}
