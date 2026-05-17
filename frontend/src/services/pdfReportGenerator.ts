/**
 * PDF Report Generator for Lakehouse Designer V2.
 * Generates a comprehensive PDF report with architecture details,
 * cost breakdown, warnings, and provisioning steps.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GenerateV2Response } from './typesV2';

// Logo path (loaded at runtime from public folder)
const LOGO_PATH = '/logo.png';

// Colors
const COLORS = {
  primary: [30, 41, 59] as [number, number, number],       // slate-800
  secondary: [100, 116, 139] as [number, number, number],  // slate-500
  accent: [16, 185, 129] as [number, number, number],      // emerald-500
  warning: [245, 158, 11] as [number, number, number],     // amber-500
  danger: [239, 68, 68] as [number, number, number],       // red-500
  info: [59, 130, 246] as [number, number, number],        // blue-500
  headerBg: [241, 245, 249] as [number, number, number],   // slate-100
};

/**
 * Loads an image from a URL and returns it as a base64 data URL.
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generates a PDF report from the architecture generation response.
 */
export async function generatePdfReport(
  response: GenerateV2Response,
  projectName: string
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Load logo
  const logoBase64 = await loadImageAsBase64(LOGO_PATH);

  // =========================================================================
  // Header with logo
  // =========================================================================
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, y, 30, 30);
    y += 5;
  }

  // Title
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Lakehouse Designer', logoBase64 ? margin + 35 : margin, y + 8);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.secondary);
  doc.text('Relatório de Arquitetura', logoBase64 ? margin + 35 : margin, y + 16);

  y += logoBase64 ? 35 : 25;

  // Separator line
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // =========================================================================
  // Project Info
  // =========================================================================
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Informações do Projeto', margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.secondary);

  const projectInfo = [
    `Projeto: ${projectName}`,
    `Tipo de Arquitetura: ${response.spec?.architecture_type ?? 'N/A'}`,
    `Fonte: ${response.spec_source ?? 'deterministic'}`,
    `Data: ${new Date().toLocaleDateString('pt-BR')}`,
  ];

  projectInfo.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 5;

  // =========================================================================
  // Architecture Services
  // =========================================================================
  if (response.spec?.services && response.spec.services.length > 0) {
    y = checkPageBreak(doc, y, 40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Serviços da Arquitetura', margin, y);
    y += 3;

    const servicesData = response.spec.services.map((s) => [
      s.label || s.service,
      s.layer || '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Serviço', 'Camada']],
      body: servicesData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // =========================================================================
  // Cost Breakdown
  // =========================================================================
  if (response.cost_estimate) {
    y = checkPageBreak(doc, y, 50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Estimativa de Custos', margin, y);
    y += 7;

    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.accent);
    doc.text(
      `Total Mensal Estimado: US$ ${response.cost_estimate.monthly_total_usd.toFixed(2)}`,
      margin,
      y
    );
    y += 3;

    // Pricing info
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.secondary);
    if (response.cost_estimate.pricing_location) {
      doc.text(`Região: ${response.cost_estimate.pricing_location}`, margin, y + 5);
      y += 5;
    }
    y += 3;

    // Cost table
    if (response.cost_estimate.breakdown && response.cost_estimate.breakdown.length > 0) {
      const costData = response.cost_estimate.breakdown.map((item) => [
        item.service,
        `US$ ${item.monthly_cost_usd.toFixed(2)}`,
        item.unit_price != null ? `${item.unit_price}` : '-',
        item.unit || '-',
        item.quantity != null ? `${item.quantity}` : '-',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Serviço', 'Custo Mensal', 'Preço Unit.', 'Unidade', 'Quantidade']],
        body: costData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: {
          fillColor: COLORS.primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          4: { halign: 'right' },
        },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Assumptions
    if (response.cost_estimate.assumptions && response.cost_estimate.assumptions.length > 0) {
      y = checkPageBreak(doc, y, 30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text('Premissas', margin, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.secondary);
      response.cost_estimate.assumptions.forEach((assumption) => {
        y = checkPageBreak(doc, y, 6);
        doc.text(`• ${assumption}`, margin + 3, y);
        y += 5;
      });
      y += 5;
    }

    // Notes
    if (response.cost_estimate.notes && response.cost_estimate.notes.length > 0) {
      y = checkPageBreak(doc, y, 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text('Notas', margin, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.secondary);
      response.cost_estimate.notes.forEach((note) => {
        y = checkPageBreak(doc, y, 6);
        doc.text(`• ${note}`, margin + 3, y);
        y += 5;
      });
      y += 5;
    }
  }

  // =========================================================================
  // Architecture Warnings
  // =========================================================================
  if (response.warnings && response.warnings.length > 0) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Alertas de Arquitetura', margin, y);
    y += 7;

    response.warnings.forEach((warning) => {
      y = checkPageBreak(doc, y, 15);
      const color =
        warning.severity === 'critical'
          ? COLORS.danger
          : warning.severity === 'warning'
            ? COLORS.warning
            : COLORS.info;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(`[${warning.severity.toUpperCase()}] ${warning.message}`, margin, y);
      y += 5;

      if (warning.recommendation) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.secondary);
        const lines = doc.splitTextToSize(`Recomendação: ${warning.recommendation}`, contentWidth - 5);
        doc.text(lines, margin + 3, y);
        y += lines.length * 4 + 3;
      }
    });
    y += 5;
  }

  // =========================================================================
  // Provisioning Steps
  // =========================================================================
  if (response.provisioning_steps && response.provisioning_steps.length > 0) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Passos de Provisionamento', margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.secondary);

    response.provisioning_steps.forEach((step, index) => {
      y = checkPageBreak(doc, y, 8);
      const lines = doc.splitTextToSize(`${index + 1}. ${step}`, contentWidth - 5);
      doc.text(lines, margin + 3, y);
      y += lines.length * 4 + 2;
    });
    y += 5;
  }

  // =========================================================================
  // Mermaid Diagram (text representation)
  // =========================================================================
  if (response.mermaid_diagram) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Diagrama de Arquitetura (Mermaid)', margin, y);
    y += 7;

    doc.setFontSize(7);
    doc.setFont('courier', 'normal');
    doc.setTextColor(...COLORS.secondary);

    const mermaidLines = response.mermaid_diagram.split('\n');
    mermaidLines.forEach((line) => {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, margin + 3, y);
      y += 3.5;
    });
  }

  // =========================================================================
  // Footer
  // =========================================================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.secondary);
    doc.text(
      `Gerado por Lakehouse Designer — Forceone | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  // Save
  const filename = `lakehouse-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Checks if there's enough space on the current page, adds a new page if not.
 */
function checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredSpace > pageHeight - 15) {
    doc.addPage();
    return 15; // Reset to top margin
  }
  return currentY;
}
