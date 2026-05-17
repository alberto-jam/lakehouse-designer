import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StepProps, StorageData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Select, Checkbox } from '../../ui';

const STORAGE_TIERS = [
  { value: 'raw', label: 'Raw' },
  { value: 'curated', label: 'Curated' },
  { value: 'aggregated', label: 'Refined (Aggregated)' },
] as const;

const FILE_FORMAT_OPTIONS = [
  { value: 'parquet', label: 'Parquet' },
  { value: 'orc', label: 'ORC' },
  { value: 'delta', label: 'Delta Lake' },
  { value: 'iceberg', label: 'Iceberg' },
];

const COMPRESSION_OPTIONS = [
  { value: 'snappy', label: 'Snappy' },
  { value: 'gzip', label: 'Gzip' },
  { value: 'zstd', label: 'Zstd' },
  { value: 'none', label: 'Nenhuma' },
];

const PARTITIONING_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'date', label: 'Por Data' },
  { value: 'region', label: 'Por Região' },
  { value: 'customer', label: 'Por Cliente' },
  { value: 'custom', label: 'Customizado' },
];

export default function StepStorage({ data, onValidSubmit, registerSubmit }: StepProps) {
  const existingData = data as StorageData | undefined;

  const [storageTiers, setStorageTiers] = useState<string[]>(
    existingData?.storage_tiers ?? ['raw', 'curated']
  );
  const [fileFormat, setFileFormat] = useState<StorageData['file_format']>(
    existingData?.file_format ?? 'parquet'
  );
  const [compression, setCompression] = useState<StorageData['compression']>(
    existingData?.compression ?? 'snappy'
  );
  const [partitioningStrategy, setPartitioningStrategy] = useState<string>(
    existingData?.partitioning_strategy ?? ''
  );

  const validationRules = useMemo(
    () => [
      {
        field: 'storage_tiers',
        validate: (value: unknown) => {
          const tiers = value as string[];
          if (!tiers || tiers.length === 0) {
            return 'Selecione pelo menos uma camada de armazenamento';
          }
          return null;
        },
      },
    ],
    []
  );

  const { errors, touched, validateField, validateAll, touchField } = useStepValidation(validationRules);

  const handleTierChange = useCallback(
    (tier: string, checked: boolean) => {
      const newTiers = checked
        ? [...storageTiers, tier]
        : storageTiers.filter((t) => t !== tier);
      setStorageTiers(newTiers);
      touchField('storage_tiers');
      validateField('storage_tiers', newTiers);
    },
    [storageTiers, touchField, validateField]
  );

  const handleSubmit = useCallback(() => {
    const formData: Record<string, unknown> = {
      storage_tiers: storageTiers,
      file_format: fileFormat,
      compression,
      partitioning_strategy: partitioningStrategy,
    };

    const isValid = validateAll(formData);
    if (isValid) {
      const storageData: StorageData = {
        storage_tiers: storageTiers as StorageData['storage_tiers'],
        file_format: fileFormat,
        compression,
        ...(partitioningStrategy ? { partitioning_strategy: partitioningStrategy } : {}),
      };
      onValidSubmit(storageData);
    }
  }, [storageTiers, fileFormat, compression, partitioningStrategy, validateAll, onValidSubmit]);

  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  const showFormatNote = fileFormat === 'delta' || fileFormat === 'iceberg';

  return (
    <div data-testid="step-storage" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Storage / Lakehouse</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure as camadas de armazenamento e formato dos dados.
        </p>
      </div>

      {/* Storage Tiers - Multi-select */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">
          Camadas de Armazenamento <span className="text-red-500">*</span>
        </legend>
        <div className="space-y-2">
          {STORAGE_TIERS.map((tier) => (
            <Checkbox
              key={tier.value}
              label={tier.label}
              checked={storageTiers.includes(tier.value)}
              onChange={(e) => handleTierChange(tier.value, e.target.checked)}
            />
          ))}
        </div>
        {touched.has('storage_tiers') && errors.storage_tiers && (
          <p className="text-xs text-red-600" role="alert">
            {errors.storage_tiers}
          </p>
        )}
      </fieldset>

      {/* File Format */}
      <Select
        label="Formato de Arquivo"
        options={FILE_FORMAT_OPTIONS}
        value={fileFormat}
        onChange={(e) => setFileFormat(e.target.value as StorageData['file_format'])}
        required
      />

      {/* Info note for Delta Lake / Iceberg */}
      {showFormatNote && (
        <div
          className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3"
          role="note"
        >
          <svg
            className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-blue-700">
            Delta Lake/Iceberg requer compatibilidade com Athena 3.x e Glue 4.0+
          </p>
        </div>
      )}

      {/* Compression */}
      <Select
        label="Compressão"
        options={COMPRESSION_OPTIONS}
        value={compression}
        onChange={(e) => setCompression(e.target.value as StorageData['compression'])}
        required
      />

      {/* Partitioning Strategy */}
      <Select
        label="Estratégia de Particionamento"
        options={PARTITIONING_OPTIONS}
        value={partitioningStrategy}
        onChange={(e) => setPartitioningStrategy(e.target.value)}
        hint="Opcional. Define como os dados serão particionados no S3."
      />
    </div>
  );
}
