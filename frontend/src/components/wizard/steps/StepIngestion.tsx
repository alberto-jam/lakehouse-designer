import { useState, useEffect, useMemo, useCallback } from 'react';
import type { StepProps, IngestionData, SourcesData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Input, Select, Checkbox } from '../../ui';

/**
 * Combined local state for Step 3 (Ingestão).
 * This step collects CDC fields from SourcesData and ingestion fields from IngestionData.
 */
interface IngestionFormState {
  dms_cdc_enabled: boolean;
  dms_cdc_db_count: number | undefined;
  ingestion_pattern: 'batch' | 'streaming' | 'hybrid' | '';
  batch_frequency: 'hourly' | 'daily' | 'weekly' | '';
  streaming_throughput_mbps: number | undefined;
}

const INGESTION_PATTERN_OPTIONS = [
  { value: 'batch', label: 'Batch' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'hybrid', label: 'Híbrido (Batch + Streaming)' },
];

const BATCH_FREQUENCY_OPTIONS = [
  { value: 'hourly', label: 'Horária' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
];

function getInitialState(data: StepProps['data']): IngestionFormState {
  if (!data) {
    return {
      dms_cdc_enabled: false,
      dms_cdc_db_count: undefined,
      ingestion_pattern: '',
      batch_frequency: '',
      streaming_throughput_mbps: undefined,
    };
  }

  // data may come as a combined object from previous submission
  const d = data as Partial<IngestionData & Pick<SourcesData, 'dms_cdc_enabled' | 'dms_cdc_db_count'>>;
  return {
    dms_cdc_enabled: d.dms_cdc_enabled ?? false,
    dms_cdc_db_count: d.dms_cdc_db_count,
    ingestion_pattern: d.ingestion_pattern ?? '',
    batch_frequency: d.batch_frequency ?? '',
    streaming_throughput_mbps: d.streaming_throughput_mbps,
  };
}

export default function StepIngestion({ data, onValidSubmit, registerSubmit }: StepProps) {
  const [form, setForm] = useState<IngestionFormState>(() => getInitialState(data));

  // Build validation rules dynamically based on current form state
  const validationRules = useMemo(
    () => [
      {
        field: 'ingestion_pattern',
        validate: (value: unknown) => {
          if (!value) return 'Padrão de ingestão é obrigatório';
          return null;
        },
      },
      {
        field: 'dms_cdc_db_count',
        validate: (value: unknown) => {
          if (!form.dms_cdc_enabled) return null;
          const num = Number(value);
          if (!value || isNaN(num) || num <= 0) {
            return 'Informe a quantidade de bancos para CDC (maior que 0)';
          }
          return null;
        },
      },
    ],
    [form.dms_cdc_enabled]
  );

  const { errors, touched, validateAll, touchField } = useStepValidation(validationRules);

  // Clear dms_cdc_db_count when CDC is disabled
  useEffect(() => {
    if (!form.dms_cdc_enabled) {
      setForm((prev) => ({ ...prev, dms_cdc_db_count: undefined }));
    }
  }, [form.dms_cdc_enabled]);

  // Clear batch_frequency when pattern is not batch/hybrid
  useEffect(() => {
    if (form.ingestion_pattern !== 'batch' && form.ingestion_pattern !== 'hybrid') {
      setForm((prev) => ({ ...prev, batch_frequency: '' }));
    }
  }, [form.ingestion_pattern]);

  // Clear streaming_throughput_mbps when pattern is not streaming/hybrid
  useEffect(() => {
    if (form.ingestion_pattern !== 'streaming' && form.ingestion_pattern !== 'hybrid') {
      setForm((prev) => ({ ...prev, streaming_throughput_mbps: undefined }));
    }
  }, [form.ingestion_pattern]);

  const handleSubmit = useCallback(() => {
    const dataToValidate: Record<string, unknown> = {
      ingestion_pattern: form.ingestion_pattern,
      dms_cdc_db_count: form.dms_cdc_db_count,
    };

    const isValid = validateAll(dataToValidate);
    if (!isValid) return;

    // Build the output combining CDC fields and ingestion fields
    const output: IngestionData & Pick<SourcesData, 'dms_cdc_enabled' | 'dms_cdc_db_count'> = {
      dms_cdc_enabled: form.dms_cdc_enabled,
      ...(form.dms_cdc_enabled && form.dms_cdc_db_count
        ? { dms_cdc_db_count: form.dms_cdc_db_count }
        : {}),
      ingestion_pattern: form.ingestion_pattern as IngestionData['ingestion_pattern'],
      ...(form.batch_frequency ? { batch_frequency: form.batch_frequency as IngestionData['batch_frequency'] } : {}),
      ...(form.streaming_throughput_mbps !== undefined
        ? { streaming_throughput_mbps: form.streaming_throughput_mbps }
        : {}),
    };

    onValidSubmit(output as unknown as IngestionData);
  }, [form, validateAll, onValidSubmit]);

  // Register submit function for external trigger (NavigationButtons)
  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  const showBatchFrequency = form.ingestion_pattern === 'batch' || form.ingestion_pattern === 'hybrid';
  const showStreamingThroughput = form.ingestion_pattern === 'streaming' || form.ingestion_pattern === 'hybrid';

  return (
    <div data-testid="step-ingestion" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Ingestão</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure os mecanismos de ingestão de dados para o seu data lake.
        </p>
      </div>

      {/* DMS CDC Toggle */}
      <div className="space-y-4">
        <Checkbox
          label="Habilitar DMS CDC"
          description="Ativa replicação Change Data Capture via AWS DMS"
          checked={form.dms_cdc_enabled}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, dms_cdc_enabled: e.target.checked }))
          }
        />

        {/* Conditional: CDC DB Count */}
        {form.dms_cdc_enabled && (
          <Input
            label="Quantidade de bancos para CDC"
            type="number"
            min={1}
            required
            placeholder="Ex: 3"
            value={form.dms_cdc_db_count ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? undefined : Number(e.target.value);
              setForm((prev) => ({ ...prev, dms_cdc_db_count: val }));
            }}
            onBlur={() => touchField('dms_cdc_db_count')}
            error={touched.has('dms_cdc_db_count') ? errors.dms_cdc_db_count : undefined}
          />
        )}
      </div>

      {/* Ingestion Pattern */}
      <Select
        label="Padrão de ingestão"
        required
        placeholder="Selecione o padrão de ingestão"
        options={INGESTION_PATTERN_OPTIONS}
        value={form.ingestion_pattern}
        onChange={(e) => {
          setForm((prev) => ({
            ...prev,
            ingestion_pattern: e.target.value as IngestionFormState['ingestion_pattern'],
          }));
        }}
        onBlur={() => touchField('ingestion_pattern')}
        error={touched.has('ingestion_pattern') ? errors.ingestion_pattern : undefined}
      />

      {/* Conditional: Batch Frequency */}
      {showBatchFrequency && (
        <Select
          label="Frequência de ingestão batch"
          placeholder="Selecione a frequência"
          options={BATCH_FREQUENCY_OPTIONS}
          value={form.batch_frequency}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              batch_frequency: e.target.value as IngestionFormState['batch_frequency'],
            }))
          }
        />
      )}

      {/* Conditional: Streaming Throughput */}
      {showStreamingThroughput && (
        <Input
          label="Throughput de streaming (MB/s)"
          type="number"
          min={1}
          placeholder="Ex: 100"
          value={form.streaming_throughput_mbps ?? ''}
          onChange={(e) => {
            const val = e.target.value === '' ? undefined : Number(e.target.value);
            setForm((prev) => ({ ...prev, streaming_throughput_mbps: val }));
          }}
        />
      )}
    </div>
  );
}
