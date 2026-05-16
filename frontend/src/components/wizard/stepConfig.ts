import { lazy, type ComponentType } from 'react';
import type { StepProps, WizardStep } from './types';

// Lazy-loaded step components (will be implemented in subsequent tasks)
const StepProject = lazy(() => import('./steps/StepProject'));
const StepSources = lazy(() => import('./steps/StepSources'));
const StepIngestion = lazy(() => import('./steps/StepIngestion'));
const StepStorage = lazy(() => import('./steps/StepStorage'));
const StepProcessing = lazy(() => import('./steps/StepProcessing'));
const StepGovernance = lazy(() => import('./steps/StepGovernance'));
const StepAnalytics = lazy(() => import('./steps/StepAnalytics'));
const StepCosts = lazy(() => import('./steps/StepCosts'));
const StepResult = lazy(() => import('./steps/StepResult'));

/**
 * WIZARD_STEPS defines the 9 sequential steps of the Lakehouse Designer V2 wizard.
 * Each step has an id, display label, required flag, and lazy-loaded component reference.
 */
export const WIZARD_STEPS: WizardStep[] = [
  { id: 'project',    label: 'Projeto',           required: true,  component: StepProject as unknown as ComponentType<StepProps> },
  { id: 'sources',    label: 'Fontes de Dados',   required: true,  component: StepSources as unknown as ComponentType<StepProps> },
  { id: 'ingestion',  label: 'Ingestão',          required: true,  component: StepIngestion as unknown as ComponentType<StepProps> },
  { id: 'storage',    label: 'Storage/Lakehouse', required: true,  component: StepStorage as unknown as ComponentType<StepProps> },
  { id: 'processing', label: 'Processamento',     required: false, component: StepProcessing as unknown as ComponentType<StepProps> },
  { id: 'governance', label: 'Governança',        required: false, component: StepGovernance as unknown as ComponentType<StepProps> },
  { id: 'analytics',  label: 'Analytics/Serving', required: true,  component: StepAnalytics as unknown as ComponentType<StepProps> },
  { id: 'costs',      label: 'Custos',            required: false, component: StepCosts as unknown as ComponentType<StepProps> },
  { id: 'result',     label: 'Resultado',         required: true,  component: StepResult as unknown as ComponentType<StepProps> },
];
