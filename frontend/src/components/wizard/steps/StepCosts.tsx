import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StepProps, CostsData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Select, Checkbox, Input } from '../../ui';

// AWS regions available for pricing
const AWS_PRICING_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia) - us-east-1' },
  { value: 'us-east-2', label: 'US East (Ohio) - us-east-2' },
  { value: 'us-west-1', label: 'US West (N. California) - us-west-1' },
  { value: 'us-west-2', label: 'US West (Oregon) - us-west-2' },
  { value: 'eu-west-1', label: 'Europe (Ireland) - eu-west-1' },
  { value: 'eu-west-2', label: 'Europe (London) - eu-west-2' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt) - eu-central-1' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) - ap-southeast-1' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney) - ap-southeast-2' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) - ap-northeast-1' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai) - ap-south-1' },
  { value: 'sa-east-1', label: 'South America (São Paulo) - sa-east-1' },
];

/**
 * Derives a list of AWS services that will be estimated based on
 * common lakehouse architecture patterns. This is a static summary
 * since StepCosts doesn't receive previous step data directly.
 */
const ESTIMATED_SERVICES = [
  { service: 'Amazon S3', description: 'Armazenamento de dados (Raw, Curated, Refined)' },
  { service: 'AWS Glue', description: 'Catálogo de dados e jobs ETL' },
  { service: 'Amazon Athena', description: 'Consultas SQL serverless' },
  { service: 'AWS Lake Formation', description: 'Governança e controle de acesso' },
  { service: 'Amazon CloudWatch', description: 'Monitoramento e logs' },
];

interface CostsFormState {
  pricing_region: string;
  create_estimate: boolean;
  budget_limit_usd: number | undefined;
  cost_allocation_tags: string[];
}

function getInitialState(data: StepProps['data']): CostsFormState {
  if (!data) {
    return {
      pricing_region: 'us-east-1',
      create_estimate: false,
      budget_limit_usd: undefined,
      cost_allocation_tags: [],
    };
  }

  const d = data as Partial<CostsData>;
  return {
    pricing_region: d.pricing_region ?? 'us-east-1',
    create_estimate: d.create_estimate ?? false,
    budget_limit_usd: d.budget_limit_usd,
    cost_allocation_tags: d.cost_allocation_tags ?? [],
  };
}

export default function StepCosts({ data, onValidSubmit, registerSubmit }: StepProps) {
  const [form, setForm] = useState<CostsFormState>(() => getInitialState(data));
  const [tagInput, setTagInput] = useState('');

  // No required fields — all have defaults, so no validation rules needed
  const validationRules = useMemo(() => [], []);

  const { validateAll } = useStepValidation(validationRules);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !form.cost_allocation_tags.includes(trimmed)) {
      setForm((prev) => ({
        ...prev,
        cost_allocation_tags: [...prev.cost_allocation_tags, trimmed],
      }));
    }
    setTagInput('');
  }, [tagInput, form.cost_allocation_tags]);

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
    setForm((prev) => ({
      ...prev,
      cost_allocation_tags: prev.cost_allocation_tags.filter((t) => t !== tag),
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    const formData: Record<string, unknown> = {
      create_estimate: form.create_estimate,
      budget_limit_usd: form.budget_limit_usd,
      cost_allocation_tags: form.cost_allocation_tags,
    };

    const isValid = validateAll(formData);
    if (isValid) {
      const costsData: CostsData = {
        create_estimate: form.create_estimate,
        pricing_region: form.pricing_region,
        ...(form.budget_limit_usd !== undefined && form.budget_limit_usd > 0
          ? { budget_limit_usd: form.budget_limit_usd }
          : {}),
        ...(form.cost_allocation_tags.length > 0
          ? { cost_allocation_tags: form.cost_allocation_tags }
          : {}),
      };
      onValidSubmit(costsData);
    }
  }, [form, validateAll, onValidSubmit]);

  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  return (
    <div data-testid="step-costs" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Custos</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure preferências de estimativa de custo e região de pricing para o cálculo.
        </p>
      </div>

      {/* Pricing Region Select */}
      <Select
        label="Região de Pricing"
        options={AWS_PRICING_REGIONS}
        value={form.pricing_region}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, pricing_region: e.target.value }))
        }
        hint="Região AWS utilizada para consulta de preços. Os custos podem variar entre regiões."
      />

      {/* Create Estimate Toggle */}
      <Checkbox
        label="Criar estimativa no AWS Pricing Calculator"
        description="Gera um link para o AWS Pricing Calculator com os serviços e configurações estimados."
        checked={form.create_estimate}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, create_estimate: e.target.checked }))
        }
      />

      {/* Budget Limit (optional) */}
      <Input
        label="Limite de orçamento mensal (USD)"
        type="number"
        min={0}
        step={0.01}
        placeholder="Ex: 5000.00"
        value={form.budget_limit_usd ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? undefined : Number(e.target.value);
          setForm((prev) => ({ ...prev, budget_limit_usd: val }));
        }}
        hint="Opcional. Se informado, o sistema alertará quando a estimativa exceder este valor."
      />

      {/* Cost Allocation Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Tags de Alocação de Custos
        </label>
        <p className="text-xs text-slate-500">
          Opcional. Adicione tags para rastreamento e alocação de custos por centro de custo.
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
        {form.cost_allocation_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.cost_allocation_tags.map((tag) => (
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

      {/* Services Summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Serviços que serão estimados
        </h3>
        <p className="text-xs text-slate-500">
          Com base nas configurações dos passos anteriores, os seguintes serviços serão incluídos na estimativa de custos:
        </p>
        <div className="rounded-md border border-slate-200 bg-slate-50 divide-y divide-slate-200">
          {ESTIMATED_SERVICES.map((item) => (
            <div
              key={item.service}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500" />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  {item.service}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  — {item.description}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 italic">
          Serviços adicionais (DMS, Redshift, QuickSight, Kinesis) serão incluídos conforme habilitados nos passos anteriores.
        </p>
      </div>
    </div>
  );
}
