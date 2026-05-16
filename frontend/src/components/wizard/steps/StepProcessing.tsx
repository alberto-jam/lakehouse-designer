import { useState, useEffect, useMemo, useCallback } from 'react';
import type { StepProps, ProcessingData, AnalyticsData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Input, Select, Checkbox } from '../../ui';

/**
 * Combined local state for Step 5 (Processamento).
 * This step collects ETL/processing fields from ProcessingData
 * and query/serving fields that feed into AnalyticsData.
 */
interface ProcessingFormState {
  etl_engine: 'glue' | 'emr' | 'emr_serverless';
  job_concurrency: number | undefined;
  data_quality_enabled: boolean;
  avg_query_complexity: 'low' | 'medium' | 'high' | '';
  max_query_latency_sec: number | undefined;
  concurrent_users: number | undefined;
  external_api_count: number;
}

const ETL_ENGINE_OPTIONS = [
  { value: 'glue', label: 'AWS Glue' },
  { value: 'emr', label: 'Amazon EMR' },
  { value: 'emr_serverless', label: 'EMR Serverless' },
];

const QUERY_COMPLEXITY_OPTIONS = [
  { value: 'low', label: 'Baixa (Low)' },
  { value: 'medium', label: 'Média (Medium)' },
  { value: 'high', label: 'Alta (High)' },
];

type ProcessingStepOutput = ProcessingData & Pick<AnalyticsData, 'avg_query_complexity' | 'max_query_latency_sec' | 'concurrent_users' | 'external_api_count'>;

function getInitialState(data: StepProps['data']): ProcessingFormState {
  if (!data) {
    return {
      etl_engine: 'glue',
      job_concurrency: undefined,
      data_quality_enabled: false,
      avg_query_complexity: '',
      max_query_latency_sec: undefined,
      concurrent_users: undefined,
      external_api_count: 0,
    };
  }

  const d = data as Partial<ProcessingStepOutput>;
  return {
    etl_engine: d.etl_engine ?? 'glue',
    job_concurrency: d.job_concurrency,
    data_quality_enabled: d.data_quality_enabled ?? false,
    avg_query_complexity: d.avg_query_complexity ?? '',
    max_query_latency_sec: d.max_query_latency_sec,
    concurrent_users: d.concurrent_users,
    external_api_count: d.external_api_count ?? 0,
  };
}

export default function StepProcessing({ data, onValidSubmit, registerSubmit }: StepProps) {
  const [form, setForm] = useState<ProcessingFormState>(() => getInitialState(data));

  const validationRules = useMemo(
    () => [
      {
        field: 'max_query_latency_sec',
        validate: (value: unknown) => {
          if (value === undefined || value === null || value === '') {
            return 'Latência máxima de query é obrigatória';
          }
          const num = Number(value);
          if (isNaN(num) || num <= 0) {
            return 'Latência deve ser um número positivo';
          }
          return null;
        },
      },
      {
        field: 'concurrent_users',
        validate: (value: unknown) => {
          if (value === undefined || value === null || value === '') {
            return 'Usuários concorrentes é obrigatório';
          }
          const num = Number(value);
          if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
            return 'Deve ser um número inteiro positivo';
          }
          return null;
        },
      },
    ],
    []
  );

  const { errors, touched, validateAll, touchField } = useStepValidation(validationRules);

  const handleSubmit = useCallback(() => {
    const dataToValidate: Record<string, unknown> = {
      max_query_latency_sec: form.max_query_latency_sec,
      concurrent_users: form.concurrent_users,
    };

    const isValid = validateAll(dataToValidate);
    if (!isValid) return;

    const output: ProcessingStepOutput = {
      etl_engine: form.etl_engine,
      job_concurrency: form.job_concurrency ?? 5,
      data_quality_enabled: form.data_quality_enabled,
      avg_query_complexity: (form.avg_query_complexity || 'medium') as AnalyticsData['avg_query_complexity'],
      max_query_latency_sec: form.max_query_latency_sec!,
      concurrent_users: form.concurrent_users!,
      external_api_count: form.external_api_count,
    };

    onValidSubmit(output as unknown as ProcessingData);
  }, [form, validateAll, onValidSubmit]);

  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  // Show warning when latency < 1s with complexity high
  const showLatencyWarning =
    form.max_query_latency_sec !== undefined &&
    form.max_query_latency_sec > 0 &&
    form.max_query_latency_sec < 1 &&
    form.avg_query_complexity === 'high';

  return (
    <div data-testid="step-processing" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Processamento</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure os parâmetros de processamento ETL e requisitos de query.
        </p>
      </div>

      {/* ETL Engine */}
      <Select
        label="Motor ETL"
        options={ETL_ENGINE_OPTIONS}
        value={form.etl_engine}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            etl_engine: e.target.value as ProcessingFormState['etl_engine'],
          }))
        }
      />

      {/* Job Concurrency */}
      <Input
        label="Concorrência de Jobs"
        type="number"
        min={1}
        placeholder="Ex: 5"
        value={form.job_concurrency ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? undefined : Number(e.target.value);
          setForm((prev) => ({ ...prev, job_concurrency: val }));
        }}
        hint="Número máximo de jobs ETL executando simultaneamente"
      />

      {/* Data Quality Enabled */}
      <Checkbox
        label="Habilitar Data Quality"
        description="Ativa verificações de qualidade de dados nos pipelines ETL"
        checked={form.data_quality_enabled}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, data_quality_enabled: e.target.checked }))
        }
      />

      {/* Query Complexity */}
      <Select
        label="Complexidade Média de Queries"
        options={QUERY_COMPLEXITY_OPTIONS}
        value={form.avg_query_complexity}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            avg_query_complexity: e.target.value as ProcessingFormState['avg_query_complexity'],
          }))
        }
        placeholder="Selecione a complexidade"
        hint="Impacta a recomendação de motor de query"
      />

      {/* Max Query Latency */}
      <Input
        label="Latência Máxima de Query (segundos)"
        type="number"
        min={0.1}
        step={0.1}
        required
        placeholder="Ex: 5"
        value={form.max_query_latency_sec ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? undefined : Number(e.target.value);
          setForm((prev) => ({ ...prev, max_query_latency_sec: val }));
        }}
        onBlur={() => touchField('max_query_latency_sec')}
        error={touched.has('max_query_latency_sec') ? errors.max_query_latency_sec : undefined}
      />

      {/* Warning: latency < 1s with high complexity */}
      {showLatencyWarning && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3"
          role="alert"
        >
          <svg
            className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-amber-700">
            Latência abaixo de 1s com complexidade alta pode exigir Redshift ou Redshift Serverless
            para atender os requisitos de performance.
          </p>
        </div>
      )}

      {/* Concurrent Users */}
      <Input
        label="Usuários Concorrentes"
        type="number"
        min={1}
        step={1}
        required
        placeholder="Ex: 10"
        value={form.concurrent_users ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? undefined : Number(e.target.value);
          setForm((prev) => ({ ...prev, concurrent_users: val }));
        }}
        onBlur={() => touchField('concurrent_users')}
        error={touched.has('concurrent_users') ? errors.concurrent_users : undefined}
      />

      {/* External API Count */}
      <Input
        label="Quantidade de APIs Externas"
        type="number"
        min={0}
        step={1}
        placeholder="0"
        value={form.external_api_count}
        onChange={(e) => {
          const val = e.target.value === '' ? 0 : Number(e.target.value);
          setForm((prev) => ({ ...prev, external_api_count: val }));
        }}
        hint="Número de APIs externas para exposição de dados (padrão: 0)"
      />
    </div>
  );
}
