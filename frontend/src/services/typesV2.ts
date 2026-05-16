// =============================================================================
// Lakehouse Designer V2 - TypeScript Types and Interfaces
// =============================================================================

// -----------------------------------------------------------------------------
// Step Data Interfaces (Wizard Steps 1-8)
// -----------------------------------------------------------------------------

/** Step 1: Projeto */
export interface ProjectData {
  project_name: string;
  environment: 'dev' | 'staging' | 'prod';
  region: string;
  description?: string;
}

/** Step 2: Fontes de Dados */
export interface SourcesData {
  data_volume_tb: number;
  records_per_day_millions: number;
  data_source_count: number;
  dms_cdc_enabled: boolean;
  dms_cdc_db_count?: number;
  source_types: string[];
}

/** Step 3: Ingestão */
export interface IngestionData {
  dms_cdc_enabled: boolean;
  dms_cdc_db_count?: number;
  ingestion_pattern: 'batch' | 'streaming' | 'hybrid';
  batch_frequency?: 'hourly' | 'daily' | 'weekly';
  streaming_throughput_mbps?: number;
}

/** Step 4: Storage/Lakehouse */
export interface StorageData {
  storage_tiers: ('raw' | 'curated' | 'aggregated')[];
  compression: 'snappy' | 'gzip' | 'zstd' | 'none';
  file_format: 'parquet' | 'orc' | 'iceberg' | 'delta';
  partitioning_strategy?: string;
}

/** Step 5: Processamento (optional) */
export interface ProcessingData {
  etl_engine: 'glue' | 'emr' | 'emr_serverless';
  job_concurrency: number;
  data_quality_enabled: boolean;
}

/** Step 6: Governança (optional) */
export interface GovernanceData {
  lake_formation_enabled: boolean;
  column_level_security: boolean;
  data_catalog_tags?: string[];
  encryption: 'sse_s3' | 'sse_kms' | 'cse';
}

/** Step 7: Analytics/Serving */
export interface AnalyticsData {
  query_engine: 'athena' | 'redshift' | 'both';
  avg_query_complexity: 'low' | 'medium' | 'high';
  max_query_latency_sec: number;
  concurrent_users: number;
  redshift_node_count?: number;
  external_api_count: number;
  quicksight_enabled: boolean;
}

/** Step 8: Custos (optional) */
export interface CostsData {
  pricing_region?: string;
  budget_limit_usd?: number;
  cost_allocation_tags?: string[];
  create_estimate: boolean;
}

// -----------------------------------------------------------------------------
// Step Data Union Type
// -----------------------------------------------------------------------------

export type StepData =
  | ProjectData
  | SourcesData
  | IngestionData
  | StorageData
  | ProcessingData
  | GovernanceData
  | AnalyticsData
  | CostsData;

// -----------------------------------------------------------------------------
// Wizard Step Component Interface
// -----------------------------------------------------------------------------

export interface StepProps {
  data: StepData | undefined;
  onValidSubmit: (data: StepData) => void;
  /** Register a submit/validate function that WizardLayout can call externally */
  registerSubmit?: (fn: () => void) => void;
}

export interface WizardStep {
  id: string;
  label: string;
  required: boolean;
  component: React.ComponentType<StepProps>;
}

// -----------------------------------------------------------------------------
// Wizard State Management
// -----------------------------------------------------------------------------

export interface WizardState {
  currentStep: number;
  completedSteps: Set<number>;
  stepData: Record<number, StepData>;
  generationStatus: 'idle' | 'loading' | 'success' | 'error';
  generationResult: GenerateV2Response | null;
  generationError: string | null;
}

export type WizardAction =
  | { type: 'NEXT_STEP'; data: StepData }
  | { type: 'SKIP_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_GENERATION_STATUS'; status: WizardState['generationStatus'] }
  | { type: 'SET_GENERATION_RESULT'; result: GenerateV2Response }
  | { type: 'SET_GENERATION_ERROR'; error: string }
  | { type: 'RESET' };

// -----------------------------------------------------------------------------
// API Request (POST /generate-v2)
// -----------------------------------------------------------------------------

export interface GenerateV2Request {
  project: ProjectData;
  sources: SourcesData;
  ingestion: IngestionData;
  storage: StorageData;
  processing?: ProcessingData;
  governance?: GovernanceData;
  analytics: AnalyticsData;
  costs?: CostsData;
}

// -----------------------------------------------------------------------------
// API Response (POST /generate-v2)
// -----------------------------------------------------------------------------

export interface GenerateV2Response {
  diagram: {
    content_base64: string;
    filename: string;
  };
  spec_source: 'deterministic' | 'sagemaker';
  spec: DiagramSpec;
  cost_estimate: CostEstimate;
  warnings: ArchitectureWarning[];
  mermaid_diagram: string;
  provisioning_steps: string[];
  cloudformation_template_url?: string;
  pricing_calculator_url?: string;
}

// -----------------------------------------------------------------------------
// Diagram Spec
// -----------------------------------------------------------------------------

export interface DiagramSpec {
  architecture_type: string;
  services: ServiceNode[];
  connections: Connection[];
  layers: Layer[];
}

export interface ServiceNode {
  id: string;
  service: string;
  label: string;
  layer: string;
  config?: Record<string, unknown>;
}

export interface Connection {
  from: string;
  to: string;
  label?: string;
  type: 'data_flow' | 'control' | 'monitoring';
}

export interface Layer {
  id: string;
  label: string;
  order: number;
}

// -----------------------------------------------------------------------------
// Cost Estimate
// -----------------------------------------------------------------------------

export interface CostEstimate {
  monthly_total_usd: number;
  breakdown: CostBreakdownItem[];
  assumptions: string[];
  notes: string[];
  unit_prices: Record<string, number>;
  pricing_location: string;
  pricing_api_region: string;
}

export interface CostBreakdownItem {
  service: string;
  monthly_cost_usd: number;
  unit_price: number;
  unit: string;
  quantity: number;
}

// -----------------------------------------------------------------------------
// Architecture Warnings
// -----------------------------------------------------------------------------

export interface ArchitectureWarning {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
  recommendation?: string;
}

// -----------------------------------------------------------------------------
// Error Response (HTTP 422)
// -----------------------------------------------------------------------------

export interface ValidationErrorResponse {
  error: 'validation_error';
  message: string;
  fields: FieldError[];
}

export interface FieldError {
  path: string;
  message: string;
  code: string;
}
