import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ResultadoArquitetura from "../ResultadoArquitetura";
import type { ArchitectureOutput } from "../../services/types";

// Mock mermaid to avoid async rendering issues in tests
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg>mocked diagram</svg>" }),
  },
}));

const mockResult: ArchitectureOutput = {
  architecture_type: "full_lakehouse_with_redshift",
  services: ["Amazon S3", "AWS Glue", "Amazon Redshift"],
  estimated_monthly_cost_usd: 2790,
  cost_breakdown_per_service: {
    "Amazon S3": 100,
    "AWS Glue": 500,
    "Amazon Redshift": 2190,
  },
  diagram_mermaid: "graph TD; A-->B",
  provisioning_steps: ["Step 1: Create S3 bucket", "Step 2: Configure Glue"],
  message: "Recommended architecture for your workload",
  cloudformation_template_url: "https://example.com/template.yaml",
};

describe("ResultadoArquitetura", () => {
  it("exibe o tipo de arquitetura formatado", () => {
    render(<ResultadoArquitetura result={mockResult} />);

    expect(
      screen.getByText("Full Lakehouse com Redshift")
    ).toBeInTheDocument();
  });

  it("exibe todos os serviços recomendados", () => {
    render(<ResultadoArquitetura result={mockResult} />);

    // Service names appear in both the services section and cost table,
    // so we use getAllByText and verify at least one instance exists
    expect(screen.getAllByText("Amazon S3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("AWS Glue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Amazon Redshift").length).toBeGreaterThanOrEqual(1);

    // Verify the "Serviços Recomendados" section heading exists
    expect(screen.getByText("Serviços Recomendados")).toBeInTheDocument();
  });

  it("exibe a mensagem do resultado", () => {
    render(<ResultadoArquitetura result={mockResult} />);

    expect(
      screen.getByText("Recommended architecture for your workload")
    ).toBeInTheDocument();
  });

  it("renderiza a tabela de custos com breakdown por serviço", () => {
    render(<ResultadoArquitetura result={mockResult} />);

    // Table header
    expect(screen.getByText("Serviço")).toBeInTheDocument();
    expect(screen.getByText("Custo Mensal (USD)")).toBeInTheDocument();

    // Cost values formatted as currency
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("$2,190.00")).toBeInTheDocument();

    // Total
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("$2,790.00")).toBeInTheDocument();
  });

  it("renderiza a seção de diagrama", () => {
    render(<ResultadoArquitetura result={mockResult} />);

    expect(
      screen.getByText("Diagrama de Arquitetura")
    ).toBeInTheDocument();
  });

  it("exibe os passos de provisionamento em ordem", () => {
    render(<ResultadoArquitetura result={mockResult} />);

    expect(
      screen.getByText("Step 1: Create S3 bucket")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Step 2: Configure Glue")
    ).toBeInTheDocument();

    // Verify order: Step 1 appears before Step 2 in the DOM
    const steps = screen.getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("Step 1: Create S3 bucket");
    expect(steps[1]).toHaveTextContent("Step 2: Configure Glue");
  });

  it("exibe o botão de download com template URL", () => {
    render(<ResultadoArquitetura result={mockResult} />);

    const downloadButton = screen.getByText("Baixar Template CloudFormation");
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton).not.toBeDisabled();
  });
});
