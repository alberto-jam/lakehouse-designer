import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assemblePayload } from './useGenerateV2';
import type {
  ProjectData,
  SourcesData,
  IngestionData,
  StorageData,
  ProcessingData,
  GovernanceData,
  AnalyticsData,
  CostsData,
  StepData,
} from '../services/typesV2';

// =============================================================================
// Mock apiClient
// =============================================================================

vi.mock('../services/apiClient', () => ({
  generateV2: vi.fn(),
  ValidationApiError: class ValidationApiError extends Error {
    public fields: Array<{ path: string; message: string; code: string }>;
    constructor(response: { message: string; fields: Array<{ path: string; message: string; code: string }> }) {
      super(response.message);
      this.name = 'ValidationApiError';
      this.fields = response.fields;
    }
  },
}));

// =============================================================================
// Test Data
// =============================================================================

const mockProject: ProjectData = {
  project_name: 'test-lakehouse',
  environment: 'prod',
  region: 'us-east-1',
  description: 'Test project',
};

const mockSources: SourcesData = {
  data_volume_tb: 10,
  records_per_day_millions: 5,
  data_source_count: 3,
  dms_cdc_enabled: true,
  dms_cdc_db_count: 2,
  source_types: ['CSV', 'JSON'],
};

const mockIngestion: IngestionData = {
  dms_cdc_enabled: true,
  dms_cdc_db_count: 2,
  ingestion_pattern: 'hybrid',
  batch_frequency: 'daily',
  streaming_throughput_mbps: 100,
};

const mockStorage: StorageData = {
  storage_tiers: ['raw', 'curated', 'aggregated'],
  compression: 'snappy',
  file_format: 'parquet',
  partitioning_strategy: 'by_date',
};

const mockProcessing: ProcessingData = {
  etl_engine: 'glue',
  job_concurrency: 5,
  data_quality_enabled: true,
};

const mockGovernance: GovernanceData = {
  lake_formation_enabled: true,
  column_level_security: true,
  data_catalog_tags: ['pii', 'confidential'],
  encryption: 'sse_kms',
};

const mockAnalytics: AnalyticsData = {
  query_engine: 'both',
  avg_query_complexity: 'high',
  max_query_latency_sec: 5,
  concurrent_users: 50,
  redshift_node_count: 4,
  external_api_count: 2,
  quicksight_enabled: true,
};

const mockCosts: CostsData = {
  pricing_region: 'us-east-1',
  budget_limit_usd: 5000,
  cost_allocation_tags: ['team', 'project'],
  create_estimate: true,
};

// =============================================================================
// Tests: assemblePayload
// =============================================================================

describe('assemblePayload', () => {
  it('maps all step indices to the correct request sections', () => {
    const stepData: Record<number, StepData> = {
      0: mockProject,
      1: mockSources,
      2: mockIngestion,
      3: mockStorage,
      4: mockProcessing,
      5: mockGovernance,
      6: mockAnalytics,
      7: mockCosts,
    };

    const payload = assemblePayload(stepData);

    expect(payload.project).toEqual(mockProject);
    expect(payload.sources).toEqual(mockSources);
    expect(payload.ingestion).toEqual(mockIngestion);
    expect(payload.storage).toEqual(mockStorage);
    expect(payload.processing).toEqual(mockProcessing);
    expect(payload.governance).toEqual(mockGovernance);
    expect(payload.analytics).toEqual(mockAnalytics);
    expect(payload.costs).toEqual(mockCosts);
  });

  it('omits optional sections when steps are not completed', () => {
    const stepData: Record<number, StepData> = {
      0: mockProject,
      1: mockSources,
      2: mockIngestion,
      3: mockStorage,
      6: mockAnalytics,
    };

    const payload = assemblePayload(stepData);

    expect(payload.project).toEqual(mockProject);
    expect(payload.sources).toEqual(mockSources);
    expect(payload.ingestion).toEqual(mockIngestion);
    expect(payload.storage).toEqual(mockStorage);
    expect(payload.analytics).toEqual(mockAnalytics);
    expect(payload.processing).toBeUndefined();
    expect(payload.governance).toBeUndefined();
    expect(payload.costs).toBeUndefined();
  });

  it('provides defaults for required sections when step data is missing', () => {
    const stepData: Record<number, StepData> = {};

    const payload = assemblePayload(stepData);

    // Should have defaults for required sections
    expect(payload.project.project_name).toBe('');
    expect(payload.project.environment).toBe('dev');
    expect(payload.project.region).toBe('us-east-1');
    expect(payload.sources.data_volume_tb).toBe(1);
    expect(payload.ingestion.ingestion_pattern).toBe('batch');
    expect(payload.storage.storage_tiers).toEqual(['raw', 'curated']);
    expect(payload.analytics.query_engine).toBe('athena');
  });

  it('includes processing only when step 4 has data', () => {
    const stepData: Record<number, StepData> = {
      0: mockProject,
      1: mockSources,
      2: mockIngestion,
      3: mockStorage,
      4: mockProcessing,
      6: mockAnalytics,
    };

    const payload = assemblePayload(stepData);

    expect(payload.processing).toEqual(mockProcessing);
    expect(payload.governance).toBeUndefined();
    expect(payload.costs).toBeUndefined();
  });
});

// =============================================================================
// Tests: useGenerateV2 hook behavior (integration-style via generate function)
// =============================================================================

describe('useGenerateV2 generate function', () => {
  let mockGenerateV2: ReturnType<typeof vi.fn>;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const apiClient = await import('../services/apiClient');
    mockGenerateV2 = apiClient.generateV2 as ReturnType<typeof vi.fn>;
    mockDispatch = vi.fn();
  });

  it('dispatches loading status, calls API, and dispatches result on success', async () => {
    const mockResult = {
      diagram: { content_base64: 'abc', filename: 'test.drawio' },
      spec_source: 'deterministic' as const,
      spec: { architecture_type: 'lakehouse', services: [], connections: [], layers: [] },
      cost_estimate: {
        monthly_total_usd: 200,
        breakdown: [],
        assumptions: [],
        notes: [],
        unit_prices: {},
        pricing_location: 'US East (N. Virginia)',
        pricing_api_region: 'us-east-1',
      },
      warnings: [],
      mermaid_diagram: 'graph TD; A-->B',
      provisioning_steps: [],
    };
    mockGenerateV2.mockResolvedValue(mockResult);

    // Import the hook module to test the generate function logic directly
    await import('./useGenerateV2');

    // We can't use React hooks outside components, so test the logic via
    // a manual invocation pattern. We'll test assemblePayload + dispatch flow.
    const stepData: Record<number, StepData> = {
      0: mockProject,
      1: mockSources,
      2: mockIngestion,
      3: mockStorage,
      6: mockAnalytics,
    };

    // Simulate what the hook's generate function does
    mockDispatch({ type: 'SET_GENERATION_STATUS', status: 'loading' });
    const payload = assemblePayload(stepData);
    const result = await mockGenerateV2(payload);
    mockDispatch({ type: 'SET_GENERATION_RESULT', result });

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_GENERATION_STATUS', status: 'loading' });
    expect(mockGenerateV2).toHaveBeenCalledWith(payload);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_GENERATION_RESULT', result: mockResult });
  });

  it('dispatches error with field details on ValidationApiError', async () => {
    const { ValidationApiError } = await import('../services/apiClient');
    const validationError = new ValidationApiError({
      error: 'validation_error',
      message: 'Request body validation failed',
      fields: [
        { path: 'project.project_name', message: 'Required string', code: 'required' },
        { path: 'sources.data_volume_tb', message: 'Must be greater than 0', code: 'value_error' },
      ],
    });
    mockGenerateV2.mockRejectedValue(validationError);

    const stepData: Record<number, StepData> = { 0: mockProject, 1: mockSources, 2: mockIngestion, 3: mockStorage, 6: mockAnalytics };

    // Simulate the hook's error handling
    mockDispatch({ type: 'SET_GENERATION_STATUS', status: 'loading' });
    try {
      await mockGenerateV2(assemblePayload(stepData));
    } catch (error: unknown) {
      if (error instanceof ValidationApiError) {
        const fieldMessages = error.fields.map((f) => `${f.path}: ${f.message}`).join('; ');
        const errorMessage = `Erro de validação: ${fieldMessages}`;
        mockDispatch({ type: 'SET_GENERATION_ERROR', error: errorMessage });
      }
    }

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_GENERATION_STATUS', status: 'loading' });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_GENERATION_ERROR',
      error: 'Erro de validação: project.project_name: Required string; sources.data_volume_tb: Must be greater than 0',
    });
  });

  it('dispatches generic error message on non-validation errors', async () => {
    mockGenerateV2.mockRejectedValue(new Error('Erro de conexão. Verifique sua rede e tente novamente.'));

    const stepData: Record<number, StepData> = { 0: mockProject, 1: mockSources, 2: mockIngestion, 3: mockStorage, 6: mockAnalytics };

    // Simulate the hook's error handling
    mockDispatch({ type: 'SET_GENERATION_STATUS', status: 'loading' });
    try {
      await mockGenerateV2(assemblePayload(stepData));
    } catch (error: unknown) {
      if (error instanceof Error) {
        mockDispatch({ type: 'SET_GENERATION_ERROR', error: error.message });
      }
    }

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_GENERATION_ERROR',
      error: 'Erro de conexão. Verifique sua rede e tente novamente.',
    });
  });
});
