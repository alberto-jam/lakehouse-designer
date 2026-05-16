import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StepProps, SourcesData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Input, Checkbox } from '../../ui';

const SOURCE_TYPE_OPTIONS = [
  { value: 'CSV', label: 'CSV' },
  { value: 'JSON', label: 'JSON' },
  { value: 'Parquet', label: 'Parquet' },
  { value: 'Avro', label: 'Avro' },
  { value: 'ORC', label: 'ORC' },
] as const;

export default function StepSources({ data, onValidSubmit, registerSubmit }: StepProps) {
  const initialData = data as SourcesData | undefined;

  const [dataVolumeTb, setDataVolumeTb] = useState<string>(
    initialData?.data_volume_tb != null ? String(initialData.data_volume_tb) : ''
  );
  const [recordsPerDayMillions, setRecordsPerDayMillions] = useState<string>(
    initialData?.records_per_day_millions != null ? String(initialData.records_per_day_millions) : ''
  );
  const [dataSourceCount, setDataSourceCount] = useState<string>(
    initialData?.data_source_count != null ? String(initialData.data_source_count) : ''
  );
  const [sourceTypes, setSourceTypes] = useState<string[]>(initialData?.source_types ?? []);

  const validationRules = useMemo(
    () => [
      {
        field: 'data_volume_tb',
        validate: (value: unknown) => {
          const v = value as string;
          if (!v || v.trim() === '') return 'Volume de dados é obrigatório';
          const num = Number(v);
          if (isNaN(num) || num <= 0) return 'Volume de dados deve ser um número positivo maior que zero';
          return null;
        },
      },
      {
        field: 'records_per_day_millions',
        validate: (value: unknown) => {
          const v = value as string;
          if (!v || v.trim() === '') return 'Registros por dia é obrigatório';
          const num = Number(v);
          if (isNaN(num) || num <= 0) return 'Registros por dia deve ser um número positivo maior que zero';
          return null;
        },
      },
      {
        field: 'data_source_count',
        validate: (value: unknown) => {
          const v = value as string;
          if (!v || v.trim() === '') return 'Quantidade de fontes é obrigatória';
          const num = Number(v);
          if (isNaN(num) || num < 0 || !Number.isInteger(num))
            return 'Quantidade de fontes deve ser um número inteiro não-negativo';
          return null;
        },
      },
    ],
    []
  );

  const { errors, touched, validateField, validateAll, touchField } = useStepValidation(validationRules);

  const handleSubmit = useCallback(() => {
    const formData: Record<string, unknown> = {
      data_volume_tb: dataVolumeTb,
      records_per_day_millions: recordsPerDayMillions,
      data_source_count: dataSourceCount,
    };

    const isValid = validateAll(formData);
    if (isValid) {
      const submitData: SourcesData = {
        data_volume_tb: Number(dataVolumeTb),
        records_per_day_millions: Number(recordsPerDayMillions),
        data_source_count: Number(dataSourceCount),
        dms_cdc_enabled: false,
        source_types: sourceTypes,
      };
      onValidSubmit(submitData);
    }
  }, [dataVolumeTb, recordsPerDayMillions, dataSourceCount, sourceTypes, validateAll, onValidSubmit]);

  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDataVolumeTb(value);
    if (touched.has('data_volume_tb')) {
      validateField('data_volume_tb', value);
    }
  };

  const handleVolumeBlur = () => {
    touchField('data_volume_tb');
    validateField('data_volume_tb', dataVolumeTb);
  };

  const handleRecordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRecordsPerDayMillions(value);
    if (touched.has('records_per_day_millions')) {
      validateField('records_per_day_millions', value);
    }
  };

  const handleRecordsBlur = () => {
    touchField('records_per_day_millions');
    validateField('records_per_day_millions', recordsPerDayMillions);
  };

  const handleSourceCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDataSourceCount(value);
    if (touched.has('data_source_count')) {
      validateField('data_source_count', value);
    }
  };

  const handleSourceCountBlur = () => {
    touchField('data_source_count');
    validateField('data_source_count', dataSourceCount);
  };

  const handleSourceTypeToggle = (type: string) => {
    setSourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div data-testid="step-sources" className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Fontes de Dados</h2>
        <p className="text-sm text-slate-500 mt-1">
          Especifique as características das fontes de dados do seu data lakehouse.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Input
          label="Volume Total de Dados (TB)"
          placeholder="Ex: 10"
          type="number"
          min="0"
          step="any"
          value={dataVolumeTb}
          onChange={handleVolumeChange}
          onBlur={handleVolumeBlur}
          error={touched.has('data_volume_tb') ? errors.data_volume_tb : undefined}
          required
          hint="Volume total estimado em terabytes"
        />

        <Input
          label="Registros por Dia (milhões)"
          placeholder="Ex: 5"
          type="number"
          min="0"
          step="any"
          value={recordsPerDayMillions}
          onChange={handleRecordsChange}
          onBlur={handleRecordsBlur}
          error={touched.has('records_per_day_millions') ? errors.records_per_day_millions : undefined}
          required
          hint="Quantidade de registros ingeridos por dia em milhões"
        />

        <Input
          label="Quantidade de Fontes de Dados"
          placeholder="Ex: 3"
          type="number"
          min="0"
          step="1"
          value={dataSourceCount}
          onChange={handleSourceCountChange}
          onBlur={handleSourceCountBlur}
          error={touched.has('data_source_count') ? errors.data_source_count : undefined}
          required
          hint="Número total de fontes de dados distintas"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">
          Formatos de Dados Predominantes
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SOURCE_TYPE_OPTIONS.map((option) => (
            <Checkbox
              key={option.value}
              label={option.label}
              checked={sourceTypes.includes(option.value)}
              onChange={() => handleSourceTypeToggle(option.value)}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Selecione os formatos de dados utilizados nas suas fontes
        </p>
      </div>
    </div>
  );
}
