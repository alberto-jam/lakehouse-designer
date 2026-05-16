# Implementation Plan: Lakehouse Designer V2

## Overview

Transform the existing single-form Data Lake Architect into a multi-step wizard experience with nine sequential steps. The frontend introduces a `WizardLayout` component orchestrating step navigation, validation, and state management using React + TypeScript + Tailwind CSS. The backend gains a new `/generate-v2` Lambda handler (Python) that accepts the expanded payload and returns enriched output including .drawio diagrams, detailed cost breakdowns with unit prices/assumptions/notes, and architecture warnings. The existing `/generate-architecture` endpoint remains untouched for backward compatibility.

## Tasks

- [x] 1. Set up project structure, types, and shared UI primitives
  - [x] 1.1 Create V2 TypeScript types and interfaces
    - Create `frontend/src/services/typesV2.ts` with all V2 interfaces: `GenerateV2Request`, `GenerateV2Response`, `ProjectData`, `SourcesData`, `IngestionData`, `StorageData`, `ProcessingData`, `GovernanceData`, `AnalyticsData`, `CostsData`, `StepData`, `StepProps`, `WizardStep`, `WizardState`, `WizardAction`, `CostEstimate`, `CostBreakdownItem`, `ArchitectureWarning`, `DiagramSpec`, `ServiceNode`, `Connection`, `Layer`, `ValidationErrorResponse`, `FieldError`
    - _Requirements: 15.1, 15.2, 20.1_

  - [x] 1.2 Create shared UI primitives
    - Create `frontend/src/components/ui/Button.tsx` with primary/secondary/ghost variants using Tailwind
    - Create `frontend/src/components/ui/Card.tsx` as a container with subtle borders and shadows
    - Create `frontend/src/components/ui/Input.tsx` with label, error message, and validation state
    - Create `frontend/src/components/ui/Select.tsx` as dropdown with label and error state
    - Create `frontend/src/components/ui/Checkbox.tsx` as toggle/checkbox primitive
    - Create `frontend/src/components/ui/Tooltip.tsx` for info tooltips
    - Create `frontend/src/components/ui/index.ts` barrel export
    - _Requirements: 17.1, 17.4_

  - [x] 1.3 Create wizard directory structure and step configuration
    - Create `frontend/src/components/wizard/` directory
    - Create `frontend/src/components/wizard/stepConfig.ts` with `WIZARD_STEPS` array defining all 9 steps (id, label, required, component reference)
    - Create `frontend/src/components/wizard/index.ts` barrel export
    - _Requirements: 1.1, 2.1_

- [x] 2. Implement state management and validation hooks
  - [x] 2.1 Implement `useWizardState` hook
    - Create `frontend/src/hooks/useWizardState.ts`
    - Implement `wizardReducer` with actions: `NEXT_STEP`, `SKIP_STEP`, `PREV_STEP`, `SET_GENERATION_STATUS`, `SET_GENERATION_RESULT`, `SET_GENERATION_ERROR`, `RESET`
    - `NEXT_STEP` saves step data, marks step complete, increments currentStep
    - `SKIP_STEP` increments currentStep without saving data
    - `PREV_STEP` discards current step data, decrements currentStep
    - Export `useWizardState` hook returning state and action dispatchers
    - _Requirements: 1.2, 1.3, 2.1_

  - [x] 2.2 Implement `useStepValidation` hook
    - Create `frontend/src/hooks/useStepValidation.ts`
    - Accept array of `ValidationRule` objects (field name + validate function)
    - Track `errors` (Record<string, string>) and `touched` (Set<string>)
    - Implement `validateField`, `validateAll`, `touchField` methods
    - `validateAll` returns boolean indicating if all fields pass
    - _Requirements: 2.2, 2.3, 2.4_

  - [x]* 2.3 Write unit tests for useWizardState hook
    - Test NEXT_STEP saves data and advances
    - Test SKIP_STEP advances without saving
    - Test PREV_STEP discards and goes back
    - Test RESET returns to initial state
    - _Requirements: 1.2, 1.3_

- [x] 3. Implement WizardLayout and navigation components
  - [x] 3.1 Implement ProgressBar component
    - Create `frontend/src/components/wizard/ProgressBar.tsx`
    - Accept `current` and `total` props
    - Render visual progress indicator showing position within 9 steps
    - Use Tailwind for styling with filled/unfilled segments
    - _Requirements: 1.4_

  - [x] 3.2 Implement StepSidebar component
    - Create `frontend/src/components/wizard/StepSidebar.tsx`
    - Accept `steps`, `currentStep`, `completedSteps` props
    - Render lateral navigation with distinct visual indicators for completed (checkmark), current (highlighted), and pending (dimmed) steps
    - _Requirements: 1.8_

  - [x] 3.3 Implement SummaryPanel component
    - Create `frontend/src/components/wizard/SummaryPanel.tsx`
    - Accept `steps`, `completedSteps`, `stepData` props
    - Render read-only summary of selections from completed steps
    - Display key values: project name, region, volume, ingestion pattern, etc.
    - _Requirements: 1.5, 4.4, 10.3_

  - [x] 3.4 Implement NavigationButtons component
    - Create `frontend/src/components/wizard/NavigationButtons.tsx`
    - Accept `isFirstStep`, `isLastStep`, `isOptional`, `isLoading`, `onBack`, `onNext`, `onSkip`, `onGenerate` props
    - Hide "Voltar" on first step
    - Hide "Próximo" and show "Gerar Arquitetura" on last step (Resultado)
    - Show "Pular" button for optional steps
    - Disable buttons during loading state
    - _Requirements: 1.6, 1.7, 2.5_

  - [x] 3.5 Implement WizardLayout orchestrator component
    - Create `frontend/src/components/wizard/WizardLayout.tsx`
    - Use `useWizardState` hook for state management
    - Render `StepSidebar`, `ProgressBar`, active step component, `SummaryPanel`, and `NavigationButtons`
    - Responsive layout: sidebar + content on desktop (lg:), stacked on mobile
    - Pass step data and `onValidSubmit` to active step component
    - Block navigation on validation failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 17.2, 17.5_

- [x] 4. Checkpoint - Ensure wizard shell renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Step components (Steps 1-4: required steps)
  - [x] 5.1 Implement StepProject (Step 1)
    - Create `frontend/src/components/wizard/steps/StepProject.tsx`
    - Fields: project_name (text, required), description (text, optional), region (select with AWS regions, required), environment (select: dev/staging/prod, required)
    - Validate project_name is non-empty and contains only alphanumeric, hyphens, underscores
    - Show inline error "Nome do projeto é obrigatório" if empty
    - Use `useStepValidation` for field-level validation with real-time feedback
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 Implement StepSources (Step 2)
    - Create `frontend/src/components/wizard/steps/StepSources.tsx`
    - Fields: data_volume_tb (numeric, required, >0), records_per_day_millions (numeric, required, >0), data_source_count (numeric, required), source_types (multi-select: CSV, JSON, Parquet, Avro, ORC)
    - Validate volume > 0 with error message for invalid values
    - Update SummaryPanel with volume and source count
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.3 Implement StepIngestion (Step 3)
    - Create `frontend/src/components/wizard/steps/StepIngestion.tsx`
    - Fields: dms_cdc_enabled (toggle, default off), dms_cdc_db_count (numeric, conditional), ingestion_pattern (select: batch/streaming/hybrid), batch_frequency (select: hourly/daily/weekly, conditional), streaming_throughput_mbps (numeric, conditional)
    - Show/hide dms_cdc_db_count based on toggle state
    - Validate dms_cdc_db_count > 0 when CDC enabled
    - Clear dms_cdc_db_count when CDC disabled
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.4 Implement StepStorage (Step 4)
    - Create `frontend/src/components/wizard/steps/StepStorage.tsx`
    - Fields: storage_tiers (multi-select: Raw/Curated/Refined, default Raw+Curated), file_format (select: Parquet/ORC/Delta Lake/Iceberg), compression (select: snappy/gzip/zstd/none), partitioning_strategy (select: por data/região/cliente/customizado)
    - Validate at least one tier selected
    - Show info note when Delta Lake or Iceberg selected about Athena/Glue compatibility
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 6. Implement Step components (Steps 5-8: optional/analytics steps)
  - [x] 6.1 Implement StepProcessing (Step 5)
    - Create `frontend/src/components/wizard/steps/StepProcessing.tsx`
    - Fields: etl_engine (select: glue/emr/emr_serverless), job_concurrency (numeric), data_quality_enabled (toggle), avg_query_complexity (select: low/medium/high), max_query_latency_sec (numeric, required), concurrent_users (numeric, required, integer >0), external_api_count (numeric, default 0)
    - Show warning when latency < 1s with complexity high about probable need for Redshift
    - Validate required fields with inline messages
    - Validate concurrent_users is positive integer
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 6.2 Implement StepGovernance (Step 6)
    - Create `frontend/src/components/wizard/steps/StepGovernance.tsx`
    - Fields: lake_formation_enabled (toggle, default on), column_level_security (toggle, default off), data_catalog_tags (tag input, optional), encryption (select: sse_s3/sse_kms/cse)
    - All fields have defaults, allow progression without changes
    - Include Lake Formation in architecture services list when enabled
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.3 Implement StepAnalytics (Step 7)
    - Create `frontend/src/components/wizard/steps/StepAnalytics.tsx`
    - Fields: query_engine (select: athena/redshift/both, default athena), redshift_node_count (numeric, conditional, min 2), quicksight_enabled (toggle, default off), external_api_count (numeric, default 0)
    - Show/hide redshift_node_count when Redshift enabled
    - Validate node count >= 2 when Redshift enabled
    - Clear node count when Redshift disabled
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 6.4 Implement StepCosts (Step 8)
    - Create `frontend/src/components/wizard/steps/StepCosts.tsx`
    - Fields: pricing region (select, default us-east-1), create_estimate (toggle, default off), budget_limit_usd (numeric, optional), cost_allocation_tags (tag input, optional)
    - Show summary of services to be estimated based on previous steps
    - Update SummaryPanel with selected pricing region
    - Allow progression without changes (all defaults)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 7. Checkpoint - Ensure all step components render and validate correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Result step and output components
  - [x] 8.1 Implement CostBreakdown component
    - Create `frontend/src/components/result/CostBreakdown.tsx`
    - Display monthly_total_usd prominently
    - Render table with columns: service name, monthly cost USD, unit price
    - Display assumptions as bullet points
    - Display notes/audit trail with timestamps
    - Show pricing_location and pricing_api_region
    - Format all monetary values as USD with 2 decimal places
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 8.2 Implement ArchitectureWarnings component
    - Create `frontend/src/components/result/ArchitectureWarnings.tsx`
    - Render each warning as list item with colored severity indicator (info=blue, warning=yellow, critical=red)
    - Include warning message and recommendation
    - Hide section completely when zero warnings
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 8.3 Implement JsonViewer component
    - Create `frontend/src/components/result/JsonViewer.tsx`
    - Render JSON with 2-space indentation and syntax highlighting
    - Support collapse/expand of JSON sections
    - Container with horizontal scroll for long lines
    - "Copiar JSON" button that copies to clipboard
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 8.4 Implement DiagramDownload component
    - Create `frontend/src/components/result/DiagramDownload.tsx`
    - Implement `downloadDrawio(contentBase64, filename)` function
    - Decode base64 content, create Blob, trigger browser download
    - Handle empty/malformed content with error message
    - _Requirements: 11.3, 11.4_

  - [x] 8.5 Implement StepResult (Step 9)
    - Create `frontend/src/components/wizard/steps/StepResult.tsx`
    - Show loading indicator with progress bar during generation
    - Disable repeated submissions while loading
    - On success: render status, Mermaid diagram preview (reuse existing DiagramaMermaid), download button, CostBreakdown, ArchitectureWarnings, JsonViewer, notes/audit trail
    - Organize sections in clear hierarchy: status → preview → downloads → costs → warnings → spec JSON → notes
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 8.6 Create result components barrel export
    - Create `frontend/src/components/result/index.ts`
    - Export CostBreakdown, ArchitectureWarnings, JsonViewer, DiagramDownload
    - _Requirements: 22.3_

- [x] 9. Implement API client and generation hook
  - [x] 9.1 Extend API client with generateV2 function
    - Add `generateV2` function to `frontend/src/services/apiClient.ts`
    - Use `VITE_API_BASE_URL` environment variable for endpoint URL
    - Implement AbortController with 60s timeout
    - Handle HTTP 422: parse ValidationErrorResponse, throw ValidationApiError
    - Handle HTTP 403: throw auth error, clear credentials
    - Handle network errors: throw user-friendly connectivity message
    - Handle timeout: throw user-friendly timeout message
    - Throw ApiConfigError when VITE_API_BASE_URL is undefined
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [x] 9.2 Implement useGenerateV2 hook
    - Create `frontend/src/hooks/useGenerateV2.ts`
    - Assemble payload from stepData (map step indices to request sections)
    - Call `generateV2` from apiClient
    - Dispatch generation status/result/error actions to wizard state
    - Surface field-level validation errors from 422 responses
    - _Requirements: 20.1, 20.4_

  - [x]* 9.3 Write unit tests for API client generateV2
    - Test successful response parsing
    - Test timeout handling
    - Test 422 error parsing
    - Test network error handling
    - Test missing VITE_API_BASE_URL
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [x] 10. Integrate wizard into App and update environment config
  - [x] 10.1 Integrate WizardLayout into App.tsx
    - Import WizardLayout into `frontend/src/App.tsx`
    - Add V2 wizard as the main content (replace or coexist with existing Formulario based on route/toggle)
    - Maintain Header and Footer components
    - Ensure existing V1 form remains accessible
    - _Requirements: 1.1, 17.5, 19.1_

  - [x] 10.2 Update environment configuration
    - Update `frontend/.env.example` to document `VITE_API_BASE_URL` variable
    - Ensure `.env` uses `VITE_API_BASE_URL` (rename from `VITE_API_URL` if needed for V2)
    - _Requirements: 21.1, 21.2_

- [x] 11. Checkpoint - Ensure frontend wizard end-to-end flow works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement backend /generate-v2 endpoint
  - [x] 12.1 Create schema validation module
    - Create `backend/src/schema_v2.py`
    - Define `ValidationError` exception class with `errors` list
    - Implement `validate_request(body)` function
    - Validate required sections: project, sources, ingestion, storage, analytics
    - Validate each section's fields (types, ranges, enums)
    - Return structured field errors with path, message, code
    - _Requirements: 15.5_

  - [x] 12.2 Create warning engine module
    - Create `backend/src/warning_engine.py`
    - Implement `analyze_architecture(request, architecture, cost_estimate)` function
    - Warning rules: OVER_BUDGET (cost > budget_limit), LARGE_VOLUME_ATHENA_ONLY (>50TB + athena only), HIGH_CONCURRENCY_ATHENA (>50 users + athena), CDC_NO_GOVERNANCE (CDC without Lake Formation)
    - Return list of warnings with severity, code, message, recommendation
    - _Requirements: 13.1, 13.2, 15.2_

  - [x] 12.3 Create diagram generator module
    - Create `backend/src/diagram_generator.py`
    - Implement `generate_mermaid_v2(architecture)` function returning Mermaid source string
    - Implement `generate_drawio(architecture, project)` function returning .drawio XML string
    - Generate layered architecture diagram based on selected services
    - _Requirements: 15.2, 11.3_

  - [x] 12.4 Implement generate_v2 Lambda handler
    - Create `backend/src/generate_v2.py`
    - Implement `lambda_handler(event, context)` function
    - Parse JSON body, validate with schema_v2
    - Call `decide_architecture()` to determine services
    - Call `get_prices()` from existing pricing_service
    - Call `compute_cost_estimate_v2()` with unit_prices, assumptions, notes, pricing_location, pricing_api_region
    - Call `generate_mermaid_v2()` and `generate_drawio()`
    - Call `analyze_architecture()` for warnings
    - Build and return full response with diagram (base64), spec, cost_estimate, warnings, mermaid_diagram, provisioning_steps
    - Return HTTP 400 for invalid JSON, HTTP 422 for validation errors
    - Include CORS headers in all responses
    - Use deterministic fallback when SageMaker Endpoint not configured
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x]* 12.5 Write unit tests for schema_v2 validation
    - Test valid complete payload passes
    - Test missing required sections returns errors
    - Test invalid enum values return field errors
    - Test optional sections (processing, governance, costs) can be omitted
    - _Requirements: 15.5_

  - [x]* 12.6 Write unit tests for warning_engine
    - Test OVER_BUDGET warning triggers when cost > budget
    - Test LARGE_VOLUME_ATHENA_ONLY triggers at >50TB
    - Test HIGH_CONCURRENCY_ATHENA triggers at >50 users
    - Test CDC_NO_GOVERNANCE triggers when CDC without Lake Formation
    - Test no warnings for well-configured architecture
    - _Requirements: 13.1, 13.2_

- [x] 13. Update SAM template and backend configuration
  - [x] 13.1 Add GenerateV2Function to SAM template
    - Add `GenerateV2Function` resource to `backend/template.yaml`
    - Configure CodeUri: src/, Handler: generate_v2.lambda_handler
    - Add policies: DynamoDBCrudPolicy, S3CrudPolicy, CloudWatchLogsFullAccess, pricing:GetProducts/DescribeServices
    - Set environment variables: TEMPLATES_BUCKET, TABLE_NAME
    - Register API event: POST /generate-v2 on LakeHouseAPI
    - Preserve existing OrchestratorFunction and /generate-architecture route unchanged
    - _Requirements: 15.3, 19.1, 19.2, 19.3_

  - [x] 13.2 Update backend requirements.txt if needed
    - Verify `backend/src/requirements.txt` includes all dependencies for new modules
    - Existing deps (boto3, jinja2) should suffice; add any new ones if needed
    - _Requirements: 15.1_

- [x] 14. Checkpoint - Ensure backend endpoint works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement responsive design and visual polish
  - [x] 15.1 Add responsive breakpoints to WizardLayout
    - Desktop (lg:): sidebar + content + summary panel side by side
    - Tablet (md:): sidebar collapses to top bar, content full width
    - Mobile (sm:): fully stacked layout
    - Ensure all components adapt gracefully
    - _Requirements: 17.2_

  - [x] 15.2 Add loading, error, and success states
    - Loading: spinner/skeleton in StepResult during generation
    - Error: red alert with message and retry option
    - Success: green indicator with results
    - Distinct visual treatments for each state
    - _Requirements: 17.3_

  - [x] 15.3 Write integration tests for wizard navigation flow
    - Test full navigation forward through all steps
    - Test back navigation preserves data
    - Test skip on optional steps
    - Test validation blocks progression
    - _Requirements: 1.2, 1.3, 1.6, 1.7, 2.3_

- [x] 16. Documentation and build verification
  - [x] 16.1 Update README.md with V2 instructions
    - Document `npm install`, `npm run dev`, `npm run build`, `npm run preview`
    - Document VITE_API_BASE_URL configuration
    - Document V2 wizard feature overview
    - _Requirements: 21.3, 22.1_

  - [x] 16.2 Create DEPLOY.md with deployment instructions
    - Document production build steps
    - Document S3 upload procedure
    - Document VITE_API_BASE_URL configuration for production
    - Document CloudFront cache invalidation
    - _Requirements: 21.4, 22.2_

  - [x] 16.3 Verify static build output
    - Run `npm run build` and confirm output is static HTML/CSS/JS only
    - Verify no SSR dependencies in production bundle
    - Confirm SPA routing works with CloudFront 404/403 fallback to index.html
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 16.4 Document MCP validations performed
    - Include list of validations performed with MCPs (aws-documentation, aws-pricing, billing-cost-management)
    - Document which pricing data was verified and which services were validated
    - _Requirements: 22.4_

- [x] 17. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The existing `/generate-architecture` endpoint and V1 frontend remain untouched
- Frontend uses TypeScript + React + Tailwind CSS; Backend uses Python on Lambda
- The design does not include Correctness Properties, so property-based tests are not included
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["3.5"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4"] },
    { "id": 7, "tasks": ["8.5", "8.6", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3"] },
    { "id": 9, "tasks": ["10.1", "10.2"] },
    { "id": 10, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 11, "tasks": ["12.4"] },
    { "id": 12, "tasks": ["12.5", "12.6", "13.1", "13.2"] },
    { "id": 13, "tasks": ["15.1", "15.2"] },
    { "id": 14, "tasks": ["15.3", "16.1", "16.2", "16.3", "16.4"] }
  ]
}
```
