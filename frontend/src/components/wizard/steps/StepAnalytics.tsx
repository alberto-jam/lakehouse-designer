import { useState, useEffect, useMemo, useCallback } from 'react';
import type { StepProps, AnalyticsData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Input, Select, Checkbox } from '../../ui';

/**
 * Local form state for Step 7 (Analytics/Serving).
 * Collects query engine, Redshift node count, QuickSight, and external API count.
 */
interface AnalyticsFormState {
  query_engine: 'athena' | 'redshift' | 'both' | '';
  redshift_node_count: number | undefined;
  quicksight_enabled: boolean;
  external_api_count: number;
}

const QUERY_ENGINE_OPTIONS = [
  { value: 'athena', label: 'Amazon Athena' },
  { value: 'redshift', label: 'Amazon Redshift' },
  { value: 'both', label: 'Athena + Redshift' },
];

function getInitialState(data: StepProps['data']): AnalyticsFormState {
  if (!data) {
    return {
      query_engine: 'athena',
      redshift_node_count: undefined,
      quicksight_enabled: false,
      external_api_count: 0,
    };
  }

  const d = data as Partial<AnalyticsData>;
  return {
    query_engine: d.query_engine ?? 'athena',
    redshift_node_count: d.redshift_node_count,
    quicksight_enabled: d.quicksight_enabled ?? false,
    external_api_count: d.external_api_count ?? 0,
  };
}

/**
 * Determines if Redshift is enabled based on the query_engine selection.
 */
function isRedshiftEnabled(queryEngine: string): boolean {
  return queryEngine === 'redshift' || queryEngine === 'both';
}

export default function StepAnalytics({ data, onValidSubmit, registerSubmit }: StepProps) {
  const [form, setForm] = useState<AnalyticsFormState>(() => getInitialState(data));

  // Build validation rules dynamically based on current form state
  const validationRules = useMemo(
    () => [
      {
        field: 'query_engine',
        validate: (value: unknown) => {
          if (!value) return 'Motor de consulta é obrigatório';
          return null;
        },
      },
      {
        field: 'redshift_node_count',
        validate: (value: unknown) => {
          if (!isRedshiftEnabled(form.query_engine)) return null;
          const num = Number(value);
          if (!value || isNaN(num) || num < 2) {
            return 'Mínimo de 2 nós Redshift';
          }
          return null;
        },
      },
    ],
    [form.query_engine]
  );

  const { errors, touched, validateAll, touchField } = useStepValidation(validationRules);

  // Clear redshift_node_count when Redshift is disabled
  useEffect(() => {
    if (!isRedshiftEnabled(form.query_engine)) {
      setForm((prev) => ({ ...prev, redshift_node_count: undefined }));
    }
  }, [form.query_engine]);

  const handleSubmit = useCallback(() => {
    const dataToValidate: Record<string, unknown> = {
      query_engine: form.query_engine,
      redshift_node_count: form.redshift_node_count,
    };

    const isValid = validateAll(dataToValidate);
    if (!isValid) return;

    const output: AnalyticsData = {
      query_engine: form.query_engine as AnalyticsData['query_engine'],
      // These fields are part of AnalyticsData but collected in StepProcessing
      // Provide sensible defaults here since this step focuses on query engine config
      avg_query_complexity: 'medium',
      max_query_latency_sec: 30,
      concurrent_users: 10,
      ...(isRedshiftEnabled(form.query_engine) && form.redshift_node_count
        ? { redshift_node_count: form.redshift_node_count }
        : {}),
      quicksight_enabled: form.quicksight_enabled,
      external_api_count: form.external_api_count,
    };

    onValidSubmit(output);
  }, [form, validateAll, onValidSubmit]);

  // Register submit function for external trigger (NavigationButtons)
  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  const showRedshiftNodeCount = isRedshiftEnabled(form.query_engine);

  return (
    <div data-testid="step-analytics" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Analytics / Serving</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure a camada de consulta e visualização de dados do seu data lake.
        </p>
      </div>

      {/* Query Engine Selection */}
      <Select
        label="Motor de consulta"
        required
        placeholder="Selecione o motor de consulta"
        options={QUERY_ENGINE_OPTIONS}
        value={form.query_engine}
        onChange={(e) => {
          setForm((prev) => ({
            ...prev,
            query_engine: e.target.value as AnalyticsFormState['query_engine'],
          }));
        }}
        onBlur={() => touchField('query_engine')}
        error={touched.has('query_engine') ? errors.query_engine : undefined}
      />

      {/* Conditional: Redshift Node Count */}
      {showRedshiftNodeCount && (
        <Input
          label="Quantidade de nós Redshift"
          type="number"
          min={2}
          required
          placeholder="Ex: 3"
          value={form.redshift_node_count ?? ''}
          onChange={(e) => {
            const val = e.target.value === '' ? undefined : Number(e.target.value);
            setForm((prev) => ({ ...prev, redshift_node_count: val }));
          }}
          onBlur={() => touchField('redshift_node_count')}
          error={touched.has('redshift_node_count') ? errors.redshift_node_count : undefined}
          hint="Mínimo de 2 nós para cluster Redshift"
        />
      )}

      {/* QuickSight Toggle */}
      <Checkbox
        label="Habilitar Amazon QuickSight"
        description="Ativa dashboards e visualizações interativas com QuickSight"
        checked={form.quicksight_enabled}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, quicksight_enabled: e.target.checked }))
        }
      />

      {/* External API Count */}
      <Input
        label="APIs externas para exposição de dados"
        type="number"
        min={0}
        placeholder="0"
        value={form.external_api_count}
        onChange={(e) => {
          const val = e.target.value === '' ? 0 : Number(e.target.value);
          setForm((prev) => ({ ...prev, external_api_count: Math.max(0, val) }));
        }}
        hint="Quantidade de APIs externas que consumirão dados do data lake"
      />
    </div>
  );
}
