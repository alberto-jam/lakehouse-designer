interface TabelaCustoProps {
  costBreakdown: Record<string, number>;
  totalCost: number;
}

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function TabelaCusto({ costBreakdown, totalCost }: TabelaCustoProps) {
  const entries = Object.entries(costBreakdown);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-4 py-2 border border-gray-200 font-semibold text-gray-700">
              Serviço
            </th>
            <th className="text-right px-4 py-2 border border-gray-200 font-semibold text-gray-700">
              Custo Mensal (USD)
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([service, cost]) => (
            <tr key={service} className="hover:bg-gray-50">
              <td className="px-4 py-2 border border-gray-200 text-gray-800">
                {service}
              </td>
              <td className="px-4 py-2 border border-gray-200 text-right text-gray-800">
                {fmt.format(cost)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-indigo-50">
            <td className="px-4 py-2 border border-gray-200 font-bold text-gray-900">
              Total
            </td>
            <td className="px-4 py-2 border border-gray-200 text-right font-bold text-gray-900">
              {fmt.format(totalCost)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
