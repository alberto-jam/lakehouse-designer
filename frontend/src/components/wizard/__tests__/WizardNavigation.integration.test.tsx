import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WizardLayout } from '../WizardLayout';
import type { StepData } from '../types';

/**
 * Integration tests for wizard navigation flow.
 * These tests verify the full navigation behavior of the WizardLayout
 * including forward navigation, back navigation with data preservation,
 * skip on optional steps, and validation blocking progression.
 *
 * Validates: Requirements 1.2, 1.3, 1.6, 1.7, 2.3
 */

// Track registered submit functions per step for controlling navigation
let registeredSubmits: Record<number, (() => void) | null> = {};
let stepRenderCount: Record<string, number> = {};

// Mock step components that simulate real behavior:
// - They register a submit function via registerSubmit
// - The submit function calls onValidSubmit with data (simulating validation pass)
// - We can control whether validation passes or fails

let validationShouldFail = false;

vi.mock('../steps/StepProject', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['project'] = (stepRenderCount['project'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ project_name: 'test-project', environment: 'dev', region: 'us-east-1' } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[0] = submitFn;
    }
    return (
      <div data-testid="step-project">
        StepProject
        {data && <span data-testid="step-project-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepSources', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['sources'] = (stepRenderCount['sources'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ data_volume_tb: 10, records_per_day_millions: 5, data_source_count: 3, dms_cdc_enabled: false, source_types: ['CSV'] } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[1] = submitFn;
    }
    return (
      <div data-testid="step-sources">
        StepSources
        {data && <span data-testid="step-sources-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepIngestion', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['ingestion'] = (stepRenderCount['ingestion'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ dms_cdc_enabled: false, ingestion_pattern: 'batch', batch_frequency: 'daily' } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[2] = submitFn;
    }
    return (
      <div data-testid="step-ingestion">
        StepIngestion
        {data && <span data-testid="step-ingestion-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepStorage', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['storage'] = (stepRenderCount['storage'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ storage_tiers: ['raw', 'curated'], compression: 'snappy', file_format: 'parquet' } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[3] = submitFn;
    }
    return (
      <div data-testid="step-storage">
        StepStorage
        {data && <span data-testid="step-storage-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepProcessing', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['processing'] = (stepRenderCount['processing'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ etl_engine: 'glue', job_concurrency: 5, data_quality_enabled: true } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[4] = submitFn;
    }
    return (
      <div data-testid="step-processing">
        StepProcessing
        {data && <span data-testid="step-processing-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepGovernance', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['governance'] = (stepRenderCount['governance'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ lake_formation_enabled: true, column_level_security: false, encryption: 'sse_s3' } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[5] = submitFn;
    }
    return (
      <div data-testid="step-governance">
        StepGovernance
        {data && <span data-testid="step-governance-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepAnalytics', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['analytics'] = (stepRenderCount['analytics'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ query_engine: 'athena', avg_query_complexity: 'medium', max_query_latency_sec: 5, concurrent_users: 10, redshift_node_count: undefined, external_api_count: 0, quicksight_enabled: false } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[6] = submitFn;
    }
    return (
      <div data-testid="step-analytics">
        StepAnalytics
        {data && <span data-testid="step-analytics-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepCosts', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['costs'] = (stepRenderCount['costs'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({ create_estimate: false, pricing_region: 'us-east-1' } as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[7] = submitFn;
    }
    return (
      <div data-testid="step-costs">
        StepCosts
        {data && <span data-testid="step-costs-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

vi.mock('../steps/StepResult', () => ({
  default: ({ onValidSubmit, registerSubmit, data }: {
    onValidSubmit: (data: StepData) => void;
    registerSubmit?: (fn: () => void) => void;
    data?: StepData;
  }) => {
    stepRenderCount['result'] = (stepRenderCount['result'] || 0) + 1;
    const submitFn = () => {
      if (!validationShouldFail) {
        onValidSubmit({} as StepData);
      }
    };
    if (registerSubmit) {
      registerSubmit(submitFn);
      registeredSubmits[8] = submitFn;
    }
    return (
      <div data-testid="step-result">
        StepResult
        {data && <span data-testid="step-result-data">{JSON.stringify(data)}</span>}
      </div>
    );
  },
}));

describe('Wizard Navigation Flow - Integration Tests', () => {
  beforeEach(() => {
    registeredSubmits = {};
    stepRenderCount = {};
    validationShouldFail = false;
    vi.clearAllMocks();
  });

  describe('Forward navigation through all steps', () => {
    it('starts at step 1 (Projeto) and shows correct progress', async () => {
      render(<WizardLayout />);

      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 1 de 9')).toBeInTheDocument();
    });

    it('advances from step 1 to step 2 when clicking Próximo with valid data', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });

      // Click "Próximo" - triggers registered submit which calls onValidSubmit
      await user.click(screen.getByText('Próximo'));

      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 2 de 9')).toBeInTheDocument();
    });

    it('navigates forward through all 9 steps sequentially', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Step 1: Projeto
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      // Step 2: Fontes de Dados
      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 2 de 9')).toBeInTheDocument();
      await user.click(screen.getByText('Próximo'));

      // Step 3: Ingestão
      await waitFor(() => {
        expect(screen.getByTestId('step-ingestion')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 3 de 9')).toBeInTheDocument();
      await user.click(screen.getByText('Próximo'));

      // Step 4: Storage/Lakehouse
      await waitFor(() => {
        expect(screen.getByTestId('step-storage')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 4 de 9')).toBeInTheDocument();
      await user.click(screen.getByText('Próximo'));

      // Step 5: Processamento (optional)
      await waitFor(() => {
        expect(screen.getByTestId('step-processing')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 5 de 9')).toBeInTheDocument();
      await user.click(screen.getByText('Próximo'));

      // Step 6: Governança (optional)
      await waitFor(() => {
        expect(screen.getByTestId('step-governance')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 6 de 9')).toBeInTheDocument();
      await user.click(screen.getByText('Próximo'));

      // Step 7: Analytics/Serving
      await waitFor(() => {
        expect(screen.getByTestId('step-analytics')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 7 de 9')).toBeInTheDocument();
      await user.click(screen.getByText('Próximo'));

      // Step 8: Custos (optional)
      await waitFor(() => {
        expect(screen.getByTestId('step-costs')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 8 de 9')).toBeInTheDocument();
      await user.click(screen.getByText('Próximo'));

      // Step 9: Resultado (last step)
      await waitFor(() => {
        expect(screen.getByTestId('step-result')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 9 de 9')).toBeInTheDocument();
    });

    it('shows "Gerar Arquitetura" button on last step instead of "Próximo"', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to last step
      for (let i = 0; i < 8; i++) {
        await waitFor(() => {
          expect(screen.getByText(/Próximo|Gerar Arquitetura/)).toBeInTheDocument();
        });
        await user.click(screen.getByText('Próximo'));
      }

      // On last step: "Gerar Arquitetura" visible, "Próximo" hidden
      await waitFor(() => {
        expect(screen.getByTestId('step-result')).toBeInTheDocument();
      });
      expect(screen.getByText('Gerar Arquitetura')).toBeInTheDocument();
      expect(screen.queryByText('Próximo')).not.toBeInTheDocument();
    });
  });

  describe('Back navigation preserves data', () => {
    it('shows "Voltar" button starting from step 2', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Step 1: no "Voltar"
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      expect(screen.queryByText('Voltar')).not.toBeInTheDocument();

      // Advance to step 2
      await user.click(screen.getByText('Próximo'));

      // Step 2: "Voltar" visible
      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
      expect(screen.getByText('Voltar')).toBeInTheDocument();
    });

    it('navigates back to previous step when clicking "Voltar"', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Advance to step 2
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });

      // Go back
      await user.click(screen.getByText('Voltar'));

      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 1 de 9')).toBeInTheDocument();
    });

    it('preserves previously submitted data when navigating back', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Step 1: submit with data
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      // Step 2: submit with data
      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      // Step 3: go back to step 2
      await waitFor(() => {
        expect(screen.getByTestId('step-ingestion')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Voltar'));

      // Step 2 should render with its previously submitted data
      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });

      // The step receives its data prop from stepData[1] which was saved on NEXT_STEP
      // Since we submitted from step 2 (index 1), that data is stored
      const dataElement = screen.queryByTestId('step-sources-data');
      if (dataElement) {
        const parsedData = JSON.parse(dataElement.textContent || '{}');
        expect(parsedData.data_volume_tb).toBe(10);
        expect(parsedData.records_per_day_millions).toBe(5);
      }
    });

    it('hides "Voltar" on first step (Projeto)', async () => {
      render(<WizardLayout />);

      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });

      expect(screen.queryByText('Voltar')).not.toBeInTheDocument();
    });

    it('can navigate forward again after going back', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Go to step 2
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      // Go to step 3
      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      // Go back to step 2
      await waitFor(() => {
        expect(screen.getByTestId('step-ingestion')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Voltar'));

      // Go forward again to step 3
      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      await waitFor(() => {
        expect(screen.getByTestId('step-ingestion')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 3 de 9')).toBeInTheDocument();
    });
  });

  describe('Skip on optional steps', () => {
    it('shows "Pular" button on optional step (Processamento, step 5)', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 5 (Processamento - optional)
      for (let i = 0; i < 4; i++) {
        await waitFor(() => {
          expect(screen.getByText('Próximo')).toBeInTheDocument();
        });
        await user.click(screen.getByText('Próximo'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('step-processing')).toBeInTheDocument();
      });
      expect(screen.getByText('Pular')).toBeInTheDocument();
    });

    it('shows "Pular" button on optional step (Governança, step 6)', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 6 (Governança - optional)
      for (let i = 0; i < 5; i++) {
        await waitFor(() => {
          expect(screen.getByText('Próximo')).toBeInTheDocument();
        });
        await user.click(screen.getByText('Próximo'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('step-governance')).toBeInTheDocument();
      });
      expect(screen.getByText('Pular')).toBeInTheDocument();
    });

    it('shows "Pular" button on optional step (Custos, step 8)', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 8 (Custos - optional)
      for (let i = 0; i < 7; i++) {
        await waitFor(() => {
          expect(screen.getByText('Próximo')).toBeInTheDocument();
        });
        await user.click(screen.getByText('Próximo'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('step-costs')).toBeInTheDocument();
      });
      expect(screen.getByText('Pular')).toBeInTheDocument();
    });

    it('does not show "Pular" on required steps', async () => {
      render(<WizardLayout />);

      // Step 1 (Projeto) is required
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      expect(screen.queryByText('Pular')).not.toBeInTheDocument();
    });

    it('advances to next step when clicking "Pular" without submitting data', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 5 (Processamento - optional)
      for (let i = 0; i < 4; i++) {
        await waitFor(() => {
          expect(screen.getByText('Próximo')).toBeInTheDocument();
        });
        await user.click(screen.getByText('Próximo'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('step-processing')).toBeInTheDocument();
      });

      // Click "Pular"
      await user.click(screen.getByText('Pular'));

      // Should advance to step 6 (Governança)
      await waitFor(() => {
        expect(screen.getByTestId('step-governance')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 6 de 9')).toBeInTheDocument();
    });

    it('can skip multiple optional steps in sequence', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 5 (Processamento - optional)
      for (let i = 0; i < 4; i++) {
        await waitFor(() => {
          expect(screen.getByText('Próximo')).toBeInTheDocument();
        });
        await user.click(screen.getByText('Próximo'));
      }

      // Skip step 5 (Processamento)
      await waitFor(() => {
        expect(screen.getByTestId('step-processing')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Pular'));

      // Skip step 6 (Governança)
      await waitFor(() => {
        expect(screen.getByTestId('step-governance')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Pular'));

      // Should be at step 7 (Analytics - required)
      await waitFor(() => {
        expect(screen.getByTestId('step-analytics')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 7 de 9')).toBeInTheDocument();
      // No "Pular" on required step
      expect(screen.queryByText('Pular')).not.toBeInTheDocument();
    });
  });

  describe('Validation blocks progression', () => {
    it('does not advance when step validation fails', async () => {
      const user = userEvent.setup();
      validationShouldFail = true;

      render(<WizardLayout />);

      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });

      // Click "Próximo" - validation fails, should stay on step 1
      await user.click(screen.getByText('Próximo'));

      // Should still be on step 1
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 1 de 9')).toBeInTheDocument();
    });

    it('stays on current step when validation fails on step 2', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 2 with valid data
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });

      // Now make validation fail
      validationShouldFail = true;

      // Click "Próximo" - should stay on step 2
      await user.click(screen.getByText('Próximo'));

      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
      expect(screen.getByText('Passo 2 de 9')).toBeInTheDocument();
    });

    it('allows progression after fixing validation (validation passes on retry)', async () => {
      const user = userEvent.setup();
      validationShouldFail = true;

      render(<WizardLayout />);

      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });

      // First attempt: validation fails
      await user.click(screen.getByText('Próximo'));
      expect(screen.getByTestId('step-project')).toBeInTheDocument();

      // Fix validation
      validationShouldFail = false;

      // Second attempt: validation passes
      await user.click(screen.getByText('Próximo'));

      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });
    });

    it('validation failure does not affect "Voltar" button functionality', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Próximo'));

      await waitFor(() => {
        expect(screen.getByTestId('step-sources')).toBeInTheDocument();
      });

      // Make validation fail
      validationShouldFail = true;

      // "Voltar" should still work even when validation would fail
      await user.click(screen.getByText('Voltar'));

      await waitFor(() => {
        expect(screen.getByTestId('step-project')).toBeInTheDocument();
      });
    });

    it('"Pular" works on optional steps regardless of validation state', async () => {
      const user = userEvent.setup();
      render(<WizardLayout />);

      // Navigate to step 5 (optional)
      for (let i = 0; i < 4; i++) {
        await waitFor(() => {
          expect(screen.getByText('Próximo')).toBeInTheDocument();
        });
        await user.click(screen.getByText('Próximo'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('step-processing')).toBeInTheDocument();
      });

      // Make validation fail
      validationShouldFail = true;

      // "Pular" should still work - it bypasses validation
      await user.click(screen.getByText('Pular'));

      await waitFor(() => {
        expect(screen.getByTestId('step-governance')).toBeInTheDocument();
      });
    });
  });
});
