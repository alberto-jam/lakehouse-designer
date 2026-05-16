import { Suspense, useCallback, useRef } from 'react';
import { useWizardState } from '../../hooks/useWizardState';
import { WIZARD_STEPS } from './stepConfig';
import { StepSidebar } from './StepSidebar';
import { ProgressBar } from './ProgressBar';
import { NavigationButtons } from './NavigationButtons';
import { SummaryPanel } from './SummaryPanel';
import { Card } from '../ui';
import type { StepData } from './types';

export interface WizardLayoutProps {
  onComplete?: () => void;
}

/**
 * WizardLayout is the main orchestrator component for the Lakehouse Designer V2 wizard.
 * It manages step navigation, renders the active step component, and coordinates
 * validation before allowing forward navigation.
 *
 * Layout:
 * - Desktop (lg:): sidebar | main content | summary panel (3-column)
 * - Mobile: stacked vertically
 */
export function WizardLayout({ onComplete }: WizardLayoutProps) {
  const {
    state,
    nextStep,
    skipStep,
    prevStep,
  } = useWizardState();

  const { currentStep, completedSteps, stepData, generationStatus } = state;
  const stepConfig = WIZARD_STEPS[currentStep];
  const StepComponent = stepConfig.component;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  // Ref to trigger form submission from NavigationButtons
  const submitRef = useRef<(() => void) | null>(null);

  /**
   * Called by the step component to register its submit/validate function.
   * This allows NavigationButtons "Next" to trigger validation externally.
   */
  const registerSubmit = useCallback((fn: () => void) => {
    submitRef.current = fn;
  }, []);

  /**
   * Handles valid form submission from a step component.
   * Advances to the next step with the validated data.
   */
  const handleValidSubmit = useCallback(
    (data: StepData) => {
      if (isLastStep && onComplete) {
        onComplete();
      } else {
        nextStep(data);
      }
    },
    [isLastStep, nextStep, onComplete]
  );

  /**
   * Triggered by the "Next" button. Calls the step's registered submit function
   * which will validate and call onValidSubmit if valid.
   * This blocks navigation on validation failure.
   */
  const handleNext = useCallback(() => {
    if (submitRef.current) {
      submitRef.current();
    }
  }, []);

  /**
   * Triggered by the "Generate" button on the last step.
   */
  const handleGenerate = useCallback(() => {
    if (submitRef.current) {
      submitRef.current();
    }
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:gap-6 max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 lg:px-6">
      {/* Lateral sidebar navigation - hidden on mobile/tablet, shown on desktop */}
      <StepSidebar
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      {/* Mobile/Tablet step indicator - shown only below lg breakpoint */}
      <div className="flex lg:hidden items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isCurrent = index === currentStep;
          return (
            <div
              key={step.id}
              className={`
                flex items-center justify-center shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs font-medium transition-colors
                ${isCurrent ? 'bg-slate-800 text-white ring-2 ring-slate-800 ring-offset-2' : ''}
                ${isCompleted && !isCurrent ? 'bg-green-100 text-green-700' : ''}
                ${!isCompleted && !isCurrent ? 'bg-slate-100 text-slate-400' : ''}
              `}
              aria-label={`${step.label}${isCurrent ? ' (atual)' : ''}${isCompleted ? ' (concluído)' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted && !isCurrent ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
          );
        })}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col gap-3 sm:gap-4 min-w-0">
        <ProgressBar current={currentStep} total={WIZARD_STEPS.length} />

        <Card className="flex-1">
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[150px] sm:min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
              </div>
            }
          >
            <StepComponent
              data={stepData[currentStep]}
              onValidSubmit={handleValidSubmit}
              registerSubmit={registerSubmit}
            />
          </Suspense>
        </Card>

        <NavigationButtons
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          isOptional={!stepConfig.required}
          isLoading={generationStatus === 'loading'}
          onBack={prevStep}
          onNext={handleNext}
          onSkip={skipStep}
          onGenerate={handleGenerate}
        />
      </div>

      {/* Lateral summary panel - hidden on mobile/tablet, shown on desktop */}
      <SummaryPanel
        steps={WIZARD_STEPS}
        completedSteps={completedSteps}
        stepData={stepData}
      />
    </div>
  );
}

export default WizardLayout;
