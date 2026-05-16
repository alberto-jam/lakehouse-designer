import type {
  WizardStep,
  StepData,
  ProjectData,
  SourcesData,
  IngestionData,
  StorageData,
  ProcessingData,
  GovernanceData,
  AnalyticsData,
  CostsData,
} from './types';
import { Card } from '../ui';

export interface SummaryPanelProps {
  steps: WizardStep[];
  completedSteps: Set<number>;
  stepData: Record<number, StepData>;
}

/**
 * SummaryPanel displays a read-only summary of selections from completed wizard steps.
 * Hidden on mobile, shown on lg: breakpoint as a right sidebar.
 */
export function SummaryPanel({ steps, completedSteps, stepData }: SummaryPanelProps) {
  const hasCompletedSteps = completedSteps.size > 0;

  if (!hasCompletedSteps) {
    return null;
  }

  return (
    <aside className="hidden lg:block w-72 shrink-0">
      <Card padding="sm" className="sticky top-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Resumo</h3>
        <div className="space-y-3">
          {steps.map((step, index) => {
            if (!completedSteps.has(index)) return null;
            const data = stepData[index];
            if (!data) return null;

            const items = getSummaryItems(step.id, data);
            if (items.length === 0) return null;

            return (
              <div key={step.id}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  {step.label}
                </p>
                <dl className="space-y-0.5">
                  {items.map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-slate-800 font-medium text-right max-w-[140px] truncate">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </Card>
    </aside>
  );
}

interface SummaryItem {
  label: string;
  value: string;
}

function getSummaryItems(stepId: string, data: StepData): SummaryItem[] {
  switch (stepId) {
    case 'project':
      return getProjectSummary(data as ProjectData);
    case 'sources':
      return getSourcesSummary(data as SourcesData);
    case 'ingestion':
      return getIngestionSummary(data as IngestionData);
    case 'storage':
      return getStorageSummary(data as StorageData);
    case 'processing':
      return getProcessingSummary(data as ProcessingData);
    case 'governance':
      return getGovernanceSummary(data as GovernanceData);
    case 'analytics':
      return getAnalyticsSummary(data as AnalyticsData);
    case 'costs':
      return getCostsSummary(data as CostsData);
    default:
      return [];
  }
}

function getProjectSummary(data: ProjectData): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (data.project_name) items.push({ label: 'Nome', value: data.project_name });
  if (data.region) items.push({ label: 'Região', value: data.region });
  if (data.environment) items.push({ label: 'Ambiente', value: data.environment });
  return items;
}

function getSourcesSummary(data: SourcesData): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (data.data_volume_tb != null) items.push({ label: 'Volume', value: `${data.data_volume_tb} TB` });
  if (data.data_source_count != null) items.push({ label: 'Fontes', value: String(data.data_source_count) });
  return items;
}

function getIngestionSummary(data: IngestionData): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (data.ingestion_pattern) items.push({ label: 'Padrão', value: data.ingestion_pattern });
  if (data.batch_frequency) items.push({ label: 'Frequência', value: data.batch_frequency });
  return items;
}

function getStorageSummary(data: StorageData): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (data.storage_tiers?.length) items.push({ label: 'Camadas', value: data.storage_tiers.join(', ') });
  if (data.file_format) items.push({ label: 'Formato', value: data.file_format });
  return items;
}

function getProcessingSummary(data: ProcessingData): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (data.etl_engine) items.push({ label: 'Engine', value: data.etl_engine });
  return items;
}

function getGovernanceSummary(data: GovernanceData): SummaryItem[] {
  const items: SummaryItem[] = [];
  items.push({ label: 'Lake Formation', value: data.lake_formation_enabled ? 'Sim' : 'Não' });
  return items;
}

function getAnalyticsSummary(data: AnalyticsData): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (data.query_engine) items.push({ label: 'Query Engine', value: data.query_engine });
  if (data.concurrent_users != null) items.push({ label: 'Usuários', value: String(data.concurrent_users) });
  return items;
}

function getCostsSummary(data: CostsData): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (data.pricing_region) items.push({ label: 'Região Pricing', value: data.pricing_region });
  if (data.budget_limit_usd != null) items.push({ label: 'Budget', value: `$${data.budget_limit_usd}` });
  if (data.create_estimate) items.push({ label: 'Estimativa', value: 'Sim' });
  return items;
}

export default SummaryPanel;
