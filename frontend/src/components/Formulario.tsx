import { useState } from "react";
import type { ArchitectureInput } from "../services/types";

interface FormularioProps {
  onSubmit: (data: ArchitectureInput) => void;
  loading: boolean;
}

interface FormState {
  data_volume_tb: string;
  records_per_day_millions: string;
  avg_query_complexity: "low" | "medium" | "high";
  max_query_latency_sec: string;
  concurrent_users: string;
}

const INITIAL: FormState = {
  data_volume_tb: "",
  records_per_day_millions: "",
  avg_query_complexity: "medium",
  max_query_latency_sec: "",
  concurrent_users: "",
};

export default function Formulario({ onSubmit, loading }: FormularioProps) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const numericFields: (keyof FormState)[] = [
      "data_volume_tb",
      "records_per_day_millions",
      "max_query_latency_sec",
      "concurrent_users",
    ];

    for (const f of numericFields) {
      const raw = form[f] as string;
      if (!raw.trim()) {
        e[f] = "Campo obrigatório";
      } else if (Number(raw) <= 0 || isNaN(Number(raw))) {
        e[f] = "O valor deve ser positivo";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      data_volume_tb: Number(form.data_volume_tb),
      records_per_day_millions: Number(form.records_per_day_millions),
      avg_query_complexity: form.avg_query_complexity,
      max_query_latency_sec: Number(form.max_query_latency_sec),
      concurrent_users: Number(form.concurrent_users),
    });
  };

  const inputClass =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Volume de Dados (TB)
          </label>
          <input
            type="number"
            step="any"
            value={form.data_volume_tb}
            onChange={(e) => set("data_volume_tb", e.target.value)}
            className={inputClass}
          />
          {errors.data_volume_tb && (
            <p className="text-red-600 text-xs mt-1">{errors.data_volume_tb}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Registros por Dia (milhões)
          </label>
          <input
            type="number"
            step="any"
            value={form.records_per_day_millions}
            onChange={(e) => set("records_per_day_millions", e.target.value)}
            className={inputClass}
          />
          {errors.records_per_day_millions && (
            <p className="text-red-600 text-xs mt-1">
              {errors.records_per_day_millions}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Complexidade de Consulta
          </label>
          <select
            value={form.avg_query_complexity}
            onChange={(e) =>
              set("avg_query_complexity", e.target.value)
            }
            className={inputClass}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Latência Máxima (segundos)
          </label>
          <input
            type="number"
            step="any"
            value={form.max_query_latency_sec}
            onChange={(e) => set("max_query_latency_sec", e.target.value)}
            className={inputClass}
          />
          {errors.max_query_latency_sec && (
            <p className="text-red-600 text-xs mt-1">
              {errors.max_query_latency_sec}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Usuários Simultâneos
          </label>
          <input
            type="number"
            step="any"
            value={form.concurrent_users}
            onChange={(e) => set("concurrent_users", e.target.value)}
            className={inputClass}
          />
          {errors.concurrent_users && (
            <p className="text-red-600 text-xs mt-1">{errors.concurrent_users}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto bg-indigo-700 hover:bg-indigo-600 disabled:bg-indigo-400 text-white font-medium text-sm px-6 py-2 rounded transition-colors flex items-center justify-center gap-2"
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        )}
        Gerar Arquitetura
      </button>
    </form>
  );
}
