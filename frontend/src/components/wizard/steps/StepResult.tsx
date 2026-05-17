import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { StepProps } from '../types';
import type { GenerateV2Response, GenerateV2Request } from '../../../services/typesV2';
import { generateV2 } from '../../../services/apiClient';
import DiagramaMermaid from '../../DiagramaMermaid';
import {
  CostBreakdown,
  ArchitectureWarnings,
  JsonViewer,
  DiagramDownload,
} from '../../result';

// =============================================================================
// Types
// =============================================================================

type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

// =============================================================================
// Progress Bar Sub-component
// =============================================================================

function GenerationProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">Gerando arquitetura...</span>
        <span className="text-sm text-slate-500">{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5">
        <div
          className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Status Badge Sub-component
// =============================================================================

function StatusBadge({ status }: { status: GenerationStatus }) {
  const config = {
    idle: { label: 'Aguardando', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    loading: { label: 'Gerando...', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    success: { label: 'Concluído', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    error: { label: 'Erro', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}
      data-testid="generation-status"
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}

// =============================================================================
// Section Wrapper Sub-component
// =============================================================================

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <h2 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

// =============================================================================
// StepResult Component
// =============================================================================

/**
 * StepResult is the final step (Step 9) of the Lakehouse Designer V2 wizard.
 *
 * It manages the generation lifecycle:
 * - Shows a "Generate" button in idle state
 * - Displays a progress bar during loading
 * - On success: renders status, Mermaid diagram preview, download button,
 *   CostBreakdown, ArchitectureWarnings, JsonViewer, and notes/audit trail
 * - On error: displays error message with retry option
 *
 * Sections are organized in clear hierarchy:
 * status → preview → downloads → costs → warnings → spec JSON → notes
 */
export default function StepResult({ data, onValidSubmit, registerSubmit }: StepProps) {
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [result, setResult] = useState<GenerateV2Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Simulated progress during loading
  useEffect(() => {
    if (status !== 'loading') {
      setProgress(0);
      return;
    }

    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 15;
      if (current >= 90) {
        current = 90; // Cap at 90% until real completion
        clearInterval(interval);
      }
      setProgress(Math.round(current));
    }, 500);

    return () => clearInterval(interval);
  }, [status]);

  /**
   * Triggers the architecture generation by calling the /generate-v2 endpoint.
   * Builds the payload from the wizard step data passed via the `data` prop.
   */
  const handleGenerate = useCallback(async () => {
    if (status === 'loading') return; // Prevent repeated submissions

    setStatus('loading');
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      // Build payload from wizard step data
      // The `data` prop contains the full wizard payload assembled by the WizardLayout
      const payload = data as unknown as GenerateV2Request;

      if (!payload || !payload.project) {
        throw new Error('Dados do wizard incompletos. Volte aos passos anteriores e preencha os campos obrigatórios.');
      }

      const response = await generateV2(payload);
      setProgress(100);
      setResult(response);
      setStatus('success');

      // Notify wizard that generation completed successfully
      onValidSubmit(response as unknown as import('../../../services/typesV2').StepData);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao gerar arquitetura.');
    }
  }, [data, status, onValidSubmit]);

  // Register the generate function so WizardLayout's "Generate" button can trigger it
  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleGenerate);
    }
  }, [registerSubmit, handleGenerate]);

  // =========================================================================
  // Render: Idle State
  // =========================================================================

  if (status === 'idle') {
    return (
      <div className="p-6 space-y-6" data-testid="step-result">
        <div className="text-center py-12 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800">
            Pronto para Gerar
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Todas as configurações foram preenchidas. Clique em &quot;Gerar Arquitetura&quot; para criar o diagrama, estimativa de custos e recomendações.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Gerar Arquitetura
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render: Loading State
  // =========================================================================

  if (status === 'loading') {
    return (
      <div className="p-6 space-y-6" data-testid="step-result">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
        </div>

        <div className="py-12 space-y-6 max-w-md mx-auto">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-emerald-600" />
          </div>
          <GenerationProgressBar progress={progress} />
          <p className="text-center text-sm text-slate-500">
            Processando configurações, calculando custos e gerando diagrama...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render: Error State
  // =========================================================================

  if (status === 'error') {
    return (
      <div className="p-6 space-y-6" data-testid="step-result">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-red-700 font-medium">
            Erro na Geração
          </p>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render: Success State
  // =========================================================================

  if (!result) return null;

  const hasMermaidDiagram = result.mermaid_diagram && result.mermaid_diagram.trim().length > 0;
  const hasWarnings = result.warnings && result.warnings.length > 0;
  const hasNotes = result.cost_estimate?.notes && result.cost_estimate.notes.length > 0;

  return (
    <div className="p-6 space-y-8" data-testid="step-result">
      {/* 1. Status */}
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        <span className="text-xs text-slate-400">
          Fonte: {result.spec_source === 'deterministic' ? 'Motor Determinístico' : 'SageMaker'}
        </span>
      </div>

      {/* 2. Preview do Diagrama (Mermaid) */}
      <Section title="Preview do Diagrama" testId="section-diagram-preview">
        {hasMermaidDiagram ? (
          <div className="border border-slate-200 rounded-lg p-4 bg-white overflow-x-auto">
            <DiagramaMermaid chart={result.mermaid_diagram} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic" role="alert">
            O diagrama não pôde ser renderizado. O conteúdo está vazio ou malformado.
          </p>
        )}
      </Section>

      {/* 3. Ações de Download */}
      <Section title="Downloads" testId="section-downloads">
        <DiagramDownload
          contentBase64={result.diagram.content_base64}
          filename={result.diagram.filename}
        />
      </Section>

      {/* 3.5 Pricing Calculator Link */}
      {result.pricing_calculator_url && (
        <Section title="AWS Pricing Calculator" testId="section-pricing-calculator">
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Estimativa criada no AWS Pricing Calculator</p>
              <a
                href={result.pricing_calculator_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
              >
                Abrir no Console AWS
              </a>
            </div>
          </div>
        </Section>
      )}

      {/* 4. Cost Breakdown */}
      {result.cost_estimate && (
        <Section title="Estimativa de Custos" testId="section-costs">
          <CostBreakdown costEstimate={result.cost_estimate} />
        </Section>
      )}

      {/* 5. Architecture Warnings */}
      {hasWarnings && (
        <Section title="Warnings" testId="section-warnings">
          <ArchitectureWarnings warnings={result.warnings} />
        </Section>
      )}

      {/* 6. Spec JSON */}
      <Section title="Especificação da Arquitetura (JSON)" testId="section-spec-json">
        <JsonViewer data={result.spec} title="DiagramSpec" />
      </Section>

      {/* 7. Notes / Audit Trail */}
      {hasNotes && (
        <Section title="Notas e Audit Trail" testId="section-notes">
          <ul className="space-y-2 text-sm">
            {result.cost_estimate.notes.map((note, index) => (
              <li
                key={index}
                className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-b-0"
              >
                <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                <span className="text-slate-600">{note}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
