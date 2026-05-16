// Re-export wizard-related types from the central types file
// This module provides the StepProps interface and StepData union type
// used by all step components in the wizard.

export type {
  StepProps,
  StepData,
  WizardStep,
  ProjectData,
  SourcesData,
  IngestionData,
  StorageData,
  ProcessingData,
  GovernanceData,
  AnalyticsData,
  CostsData,
} from '../../services/typesV2';
