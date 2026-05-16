import type { WizardStep } from './types';

interface StepSidebarProps {
  steps: WizardStep[];
  currentStep: number;
  completedSteps: Set<number>;
}

/**
 * StepSidebar renders a vertical lateral navigation showing all 9 wizard steps
 * with distinct visual indicators for completed, current, and pending steps.
 * Hidden on mobile; visible only on lg: breakpoint and above.
 */
export function StepSidebar({ steps, currentStep, completedSteps }: StepSidebarProps) {
  return (
    <nav
      className="hidden lg:flex flex-col w-64 shrink-0"
      aria-label="Navegação do wizard"
    >
      <ul className="flex flex-col gap-1">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isCurrent = index === currentStep;

          return (
            <li key={step.id}>
              <div
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isCurrent ? 'bg-slate-100 border-l-4 border-slate-800' : 'border-l-4 border-transparent'}
                  ${!isCurrent && !isCompleted ? 'opacity-70' : ''}
                `}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Step indicator icon */}
                <StepIndicator
                  index={index}
                  isCompleted={isCompleted}
                  isCurrent={isCurrent}
                />

                {/* Step label */}
                <span
                  className={`
                    text-sm leading-tight
                    ${isCurrent ? 'font-bold text-slate-800' : ''}
                    ${isCompleted ? 'text-slate-700' : ''}
                    ${!isCurrent && !isCompleted ? 'text-slate-400' : ''}
                  `}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface StepIndicatorProps {
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
}

/**
 * Renders the step number circle or checkmark icon depending on state.
 */
function StepIndicator({ index, isCompleted, isCurrent }: StepIndicatorProps) {
  if (isCompleted) {
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </span>
    );
  }

  if (isCurrent) {
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold">
        {index + 1}
      </span>
    );
  }

  // Pending step
  return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-slate-300 text-slate-400 text-xs">
      {index + 1}
    </span>
  );
}

export default StepSidebar;
