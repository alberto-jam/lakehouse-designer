import { useCallback, useRef } from 'react';
import { generateV2, ValidationApiError } from '../services/apiClient';
import type {
  StepData,
  GenerateV2Request,
  GenerateV2Response,
  ProjectData,
  SourcesData,
  IngestionData,
  StorageData,
  ProcessingData,
  GovernanceData,
  AnalyticsData,
  CostsData,
  WizardAction,
} from '../services/typesV2';

// =============================================================================
// Types
// =============================================================================

export interface UseGenerateV2Options {
  stepData: Record<number, StepData>;
  dispatch: React.Dispatch<WizardAction>;
}

export interface UseGenerateV2Return {
  generate: () => Promise<GenerateV2Response | null>;
  /** Field-level validation errors from a 422 response */
  fieldErrors: Array<{ path: string; message: string; code: string }>;
}

// =============================================================================
// Step Index Mapping
// =============================================================================

/**
 * Maps wizard step indices to their corresponding request sections:
 * - Step 0: project (ProjectData)
 * - Step 1: sources (SourcesData)
 * - Step 2: ingestion (IngestionData)
 * - Step 3: storage (StorageData)
 * - Step 4: processing (ProcessingData) — optional
 * - Step 5: governance (GovernanceData) — optional
 * - Step 6: analytics (AnalyticsData)
 * - Step 7: costs (CostsData) — optional
 */
function assemblePayload(stepData: Record<number, StepData>): GenerateV2Request {
  const project = stepData[0] as ProjectData | undefined;
  const sources = stepData[1] as SourcesData | undefined;
  const ingestion = stepData[2] as IngestionData | undefined;
  const storage = stepData[3] as StorageData | undefined;
  const processing = stepData[4] as ProcessingData | undefined;
  const governance = stepData[5] as GovernanceData | undefined;
  const analytics = stepData[6] as AnalyticsData | undefined;
  const costs = stepData[7] as CostsData | undefined;

  // Required sections — use defaults if somehow missing
  const payload: GenerateV2Request = {
    project: project ?? {
      project_name: '',
      environment: 'dev',
      region: 'us-east-1',
    },
    sources: sources ?? {
      data_volume_tb: 1,
      records_per_day_millions: 1,
      data_source_count: 1,
      dms_cdc_enabled: false,
      source_types: [],
    },
    ingestion: ingestion ?? {
      dms_cdc_enabled: false,
      ingestion_pattern: 'batch',
    },
    storage: storage ?? {
      storage_tiers: ['raw', 'curated'],
      compression: 'snappy',
      file_format: 'parquet',
    },
    analytics: analytics ?? {
      query_engine: 'athena',
      avg_query_complexity: 'medium',
      max_query_latency_sec: 30,
      concurrent_users: 5,
      external_api_count: 0,
      quicksight_enabled: false,
    },
  };

  // Optional sections — only include if step was completed
  if (processing) {
    // StepProcessing collects some fields that belong to the analytics section
    // (avg_query_complexity, max_query_latency_sec, concurrent_users, external_api_count).
    // Merge them into analytics and send only processing-specific fields to the backend.
    const processingRaw = processing as unknown as Record<string, unknown>;
    const {
      avg_query_complexity,
      max_query_latency_sec,
      concurrent_users,
      external_api_count,
      ...processingOnly
    } = processingRaw;

    // Override analytics fields with values from StepProcessing if they exist
    if (avg_query_complexity !== undefined) {
      (payload.analytics as unknown as Record<string, unknown>).avg_query_complexity = avg_query_complexity;
    }
    if (max_query_latency_sec !== undefined) {
      (payload.analytics as unknown as Record<string, unknown>).max_query_latency_sec = max_query_latency_sec;
    }
    if (concurrent_users !== undefined) {
      (payload.analytics as unknown as Record<string, unknown>).concurrent_users = concurrent_users;
    }
    if (external_api_count !== undefined) {
      (payload.analytics as unknown as Record<string, unknown>).external_api_count = external_api_count;
    }

    // Only include processing section if it has processing-specific fields
    if (Object.keys(processingOnly).length > 0) {
      payload.processing = processingOnly as unknown as ProcessingData;
    }
  }
  if (governance) {
    payload.governance = governance;
  }
  if (costs) {
    payload.costs = costs;
  }

  return payload;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook that orchestrates calling the /generate-v2 endpoint.
 *
 * Responsibilities:
 * - Assembles the GenerateV2Request payload from stepData
 * - Calls generateV2 from apiClient
 * - Dispatches generation status/result/error actions to wizard state
 * - Surfaces field-level validation errors from 422 responses
 *
 * @see Requirements 20.1, 20.4
 */
export function useGenerateV2({ stepData, dispatch }: UseGenerateV2Options): UseGenerateV2Return {
  const fieldErrorsRef = useRef<Array<{ path: string; message: string; code: string }>>([]);

  const generate = useCallback(async (): Promise<GenerateV2Response | null> => {
    // Clear previous field errors
    fieldErrorsRef.current = [];

    // Signal loading state
    dispatch({ type: 'SET_GENERATION_STATUS', status: 'loading' });

    try {
      // Assemble the payload from step data
      const payload = assemblePayload(stepData);

      // Call the API
      const result = await generateV2(payload);

      // Dispatch success
      dispatch({ type: 'SET_GENERATION_RESULT', result });

      return result;
    } catch (error: unknown) {
      if (error instanceof ValidationApiError) {
        // Surface field-level validation errors from 422 responses
        fieldErrorsRef.current = error.fields;

        // Build a user-friendly error message including field details
        const fieldMessages = error.fields
          .map((f) => `${f.path}: ${f.message}`)
          .join('; ');
        const errorMessage = fieldMessages
          ? `Erro de validação: ${fieldMessages}`
          : error.message;

        dispatch({ type: 'SET_GENERATION_ERROR', error: errorMessage });
      } else if (error instanceof Error) {
        dispatch({ type: 'SET_GENERATION_ERROR', error: error.message });
      } else {
        dispatch({
          type: 'SET_GENERATION_ERROR',
          error: 'Ocorreu um erro inesperado. Tente novamente.',
        });
      }

      return null;
    }
  }, [stepData, dispatch]);

  return {
    generate,
    fieldErrors: fieldErrorsRef.current,
  };
}

// Export assemblePayload for testing
export { assemblePayload };
