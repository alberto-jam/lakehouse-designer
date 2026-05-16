import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StepProps, GovernanceData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Select, Checkbox, Input } from '../../ui';

const ENCRYPTION_OPTIONS = [
  { value: 'sse_s3', label: 'SSE-S3 (Server-Side Encryption com chaves gerenciadas pelo S3)' },
  { value: 'sse_kms', label: 'SSE-KMS (Server-Side Encryption com AWS KMS)' },
  { value: 'cse', label: 'CSE (Client-Side Encryption)' },
];

export default function StepGovernance({ data, onValidSubmit, registerSubmit }: StepProps) {
  const existingData = data as GovernanceData | undefined;

  const [lakeFormationEnabled, setLakeFormationEnabled] = useState<boolean>(
    existingData?.lake_formation_enabled ?? true
  );
  const [columnLevelSecurity, setColumnLevelSecurity] = useState<boolean>(
    existingData?.column_level_security ?? false
  );
  const [dataCatalogTags, setDataCatalogTags] = useState<string[]>(
    existingData?.data_catalog_tags ?? []
  );
  const [encryption, setEncryption] = useState<GovernanceData['encryption']>(
    existingData?.encryption ?? 'sse_s3'
  );
  const [tagInput, setTagInput] = useState('');

  // No required fields — all have defaults, so no validation rules needed
  const validationRules = useMemo(() => [], []);

  const { validateAll } = useStepValidation(validationRules);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !dataCatalogTags.includes(trimmed)) {
      setDataCatalogTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }, [tagInput, dataCatalogTags]);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleRemoveTag = useCallback((tag: string) => {
    setDataCatalogTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleSubmit = useCallback(() => {
    const formData: Record<string, unknown> = {
      lake_formation_enabled: lakeFormationEnabled,
      column_level_security: columnLevelSecurity,
      data_catalog_tags: dataCatalogTags,
      encryption,
    };

    const isValid = validateAll(formData);
    if (isValid) {
      const governanceData: GovernanceData = {
        lake_formation_enabled: lakeFormationEnabled,
        column_level_security: columnLevelSecurity,
        encryption,
        ...(dataCatalogTags.length > 0 ? { data_catalog_tags: dataCatalogTags } : {}),
      };
      onValidSubmit(governanceData);
    }
  }, [lakeFormationEnabled, columnLevelSecurity, dataCatalogTags, encryption, validateAll, onValidSubmit]);

  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  return (
    <div data-testid="step-governance" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Governança</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure controles de governança, segurança e catalogação de dados.
        </p>
      </div>

      {/* Lake Formation Toggle */}
      <Checkbox
        label="AWS Lake Formation"
        description="Habilita governança centralizada com controle de acesso fino sobre o data lake."
        checked={lakeFormationEnabled}
        onChange={(e) => setLakeFormationEnabled(e.target.checked)}
      />

      {/* Column-Level Security Toggle */}
      <Checkbox
        label="Segurança em nível de coluna"
        description="Restringe acesso a colunas específicas de tabelas no catálogo de dados."
        checked={columnLevelSecurity}
        onChange={(e) => setColumnLevelSecurity(e.target.checked)}
      />

      {/* Encryption Select */}
      <Select
        label="Criptografia"
        options={ENCRYPTION_OPTIONS}
        value={encryption}
        onChange={(e) => setEncryption(e.target.value as GovernanceData['encryption'])}
        hint="Define o método de criptografia para dados em repouso no S3."
      />

      {/* Data Catalog Tags - Tag Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Tags de Classificação de Dados
        </label>
        <p className="text-xs text-slate-500">
          Opcional. Adicione tags para classificar e organizar os dados no catálogo.
        </p>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Digite uma tag e pressione Enter"
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!tagInput.trim()}
            className="px-3 py-2 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar
          </button>
        </div>

        {/* Tag List */}
        {dataCatalogTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {dataCatalogTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-slate-300 transition-colors"
                  aria-label={`Remover tag ${tag}`}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
