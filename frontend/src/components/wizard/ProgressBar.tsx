export interface ProgressBarProps {
  /** Current step index (0-based) */
  current: number;
  /** Total number of steps */
  total: number;
}

/**
 * ProgressBar displays a segmented visual indicator showing the user's
 * position within the 9-step wizard. Completed segments are filled with
 * the primary color and pending segments remain light.
 */
export function ProgressBar({ current, total }: ProgressBarProps) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">
          Passo {current + 1} de {total}
        </span>
        <span className="text-sm text-slate-500">
          {Math.round(((current + 1) / total) * 100)}%
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full transition-colors duration-200 ${
              index <= current ? 'bg-slate-800' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default ProgressBar;
