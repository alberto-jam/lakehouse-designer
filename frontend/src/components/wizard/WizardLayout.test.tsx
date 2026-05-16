import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WizardLayout } from './WizardLayout';

// Mock the useWizardState hook
vi.mock('../../hooks/useWizardState', () => ({
  useWizardState: () => ({
    state: {
      currentStep: 0,
      completedSteps: new Set<number>(),
      stepData: {},
      generationStatus: 'idle' as const,
      generationResult: null,
      generationError: null,
    },
    nextStep: vi.fn(),
    skipStep: vi.fn(),
    prevStep: vi.fn(),
    setGenerationStatus: vi.fn(),
    setGenerationResult: vi.fn(),
    setGenerationError: vi.fn(),
    reset: vi.fn(),
  }),
}));

// Mock the step components to avoid lazy-loading issues in tests
vi.mock('./steps/StepProject', () => ({
  default: ({ onValidSubmit, registerSubmit }: { onValidSubmit: (data: unknown) => void; registerSubmit?: (fn: () => void) => void }) => {
    if (registerSubmit) {
      registerSubmit(() => onValidSubmit({ project_name: 'Test', environment: 'dev', region: 'us-east-1' }));
    }
    return <div data-testid="step-project">StepProject</div>;
  },
}));

vi.mock('./steps/StepSources', () => ({
  default: () => <div data-testid="step-sources">StepSources</div>,
}));

vi.mock('./steps/StepIngestion', () => ({
  default: () => <div data-testid="step-ingestion">StepIngestion</div>,
}));

vi.mock('./steps/StepStorage', () => ({
  default: () => <div data-testid="step-storage">StepStorage</div>,
}));

vi.mock('./steps/StepProcessing', () => ({
  default: () => <div data-testid="step-processing">StepProcessing</div>,
}));

vi.mock('./steps/StepGovernance', () => ({
  default: () => <div data-testid="step-governance">StepGovernance</div>,
}));

vi.mock('./steps/StepAnalytics', () => ({
  default: () => <div data-testid="step-analytics">StepAnalytics</div>,
}));

vi.mock('./steps/StepCosts', () => ({
  default: () => <div data-testid="step-costs">StepCosts</div>,
}));

vi.mock('./steps/StepResult', () => ({
  default: () => <div data-testid="step-result">StepResult</div>,
}));

describe('WizardLayout', () => {
  it('renders the progress bar', () => {
    render(<WizardLayout />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the step text showing first step', () => {
    render(<WizardLayout />);
    expect(screen.getByText('Passo 1 de 9')).toBeInTheDocument();
  });

  it('renders the active step component', async () => {
    render(<WizardLayout />);
    const stepProject = await screen.findByTestId('step-project');
    expect(stepProject).toBeInTheDocument();
  });

  it('renders the "Próximo" navigation button', () => {
    render(<WizardLayout />);
    expect(screen.getByText('Próximo')).toBeInTheDocument();
  });

  it('does not render "Voltar" button on first step', () => {
    render(<WizardLayout />);
    expect(screen.queryByText('Voltar')).not.toBeInTheDocument();
  });

  it('renders the sidebar navigation', () => {
    render(<WizardLayout />);
    expect(screen.getByLabelText('Navegação do wizard')).toBeInTheDocument();
  });

  it('has responsive layout classes', () => {
    const { container } = render(<WizardLayout />);
    const root = container.firstElementChild;
    expect(root).toHaveClass('flex', 'flex-col', 'lg:flex-row', 'max-w-7xl', 'mx-auto');
  });
});
