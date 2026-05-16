import { Button } from '../ui';

export interface NavigationButtonsProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  isOptional: boolean;
  isLoading: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onGenerate: () => void;
}

export function NavigationButtons({
  isFirstStep,
  isLastStep,
  isOptional,
  isLoading,
  onBack,
  onNext,
  onSkip,
  onGenerate,
}: NavigationButtonsProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        {!isFirstStep && (
          <Button
            variant="secondary"
            onClick={onBack}
            disabled={isLoading}
          >
            Voltar
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isOptional && !isLastStep && (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading}
          >
            Pular
          </Button>
        )}

        {!isLastStep && (
          <Button
            variant="primary"
            onClick={onNext}
            disabled={isLoading}
          >
            Próximo
          </Button>
        )}

        {isLastStep && (
          <Button
            variant="primary"
            onClick={onGenerate}
            disabled={isLoading}
            isLoading={isLoading}
          >
            Gerar Arquitetura
          </Button>
        )}
      </div>
    </div>
  );
}
