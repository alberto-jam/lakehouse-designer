import type { ArchitectureWarning } from '../../services/typesV2';

interface ArchitectureWarningsProps {
  warnings: ArchitectureWarning[];
}

const severityConfig = {
  info: {
    dot: 'bg-blue-500',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    label: 'Info',
    labelColor: 'text-blue-700',
  },
  warning: {
    dot: 'bg-amber-500',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    label: 'Warning',
    labelColor: 'text-amber-700',
  },
  critical: {
    dot: 'bg-red-500',
    border: 'border-red-200',
    bg: 'bg-red-50',
    label: 'Critical',
    labelColor: 'text-red-700',
  },
} as const;

export function ArchitectureWarnings({ warnings }: ArchitectureWarningsProps) {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
        Warnings de Arquitetura
      </h3>

      <ul className="space-y-2" role="list">
        {warnings.map((warning) => {
          const config = severityConfig[warning.severity];

          return (
            <li
              key={warning.code}
              className={`flex items-start gap-3 rounded-md border p-3 ${config.border} ${config.bg}`}
            >
              {/* Severity indicator dot */}
              <span
                className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${config.dot}`}
                aria-hidden="true"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${config.labelColor}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {warning.code}
                  </span>
                </div>

                <p className="mt-0.5 text-sm text-slate-800">
                  {warning.message}
                </p>

                {warning.recommendation && (
                  <p className="mt-1 text-xs text-slate-600">
                    <span className="font-medium">Recomendação:</span>{' '}
                    {warning.recommendation}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
