import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mermaid library
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg>mock</svg>" }),
    run: vi.fn(),
  },
}));

// Mock credentialsService
vi.mock("../services/credentialsService", () => ({
  hasCredentials: vi.fn(),
  clearCredentials: vi.fn(),
  getCredentials: vi.fn(),
  saveCredentials: vi.fn(),
}));

// Mock apiClient
vi.mock("../services/apiClient", () => ({
  generateArchitecture: vi.fn(),
}));

import App from "../App";
import { hasCredentials, clearCredentials } from "../services/credentialsService";
import { generateArchitecture } from "../services/apiClient";

describe("App.tsx — Testes de Integração", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Requisito 1.3: App carrega com credenciais → wizard visível (V2 é o modo padrão)
  it("exibe o formulário quando credenciais estão disponíveis", () => {
    vi.mocked(hasCredentials).mockReturnValue(true);

    render(<App />);

    // V2 wizard é o modo padrão, deve exibir botão "Próximo"
    expect(
      screen.getByRole("button", { name: /Próximo/i })
    ).toBeInTheDocument();

    // Header deve estar visível
    expect(screen.getByText("Lake House Designer")).toBeInTheDocument();

    // Footer deve estar visível
    expect(
      screen.getByText(/estimativas de custo são aproximadas/i)
    ).toBeInTheDocument();
  });

  // Requisito 1.1: App carrega sem credenciais — no current implementation,
  // hasCredentials always returns true, but we test the mock behavior
  it("exibe o formulário mesmo quando hasCredentials retorna false (implementação atual)", () => {
    vi.mocked(hasCredentials).mockReturnValue(false);

    render(<App />);

    // Na implementação atual, o wizard V2 é sempre exibido
    expect(
      screen.getByRole("button", { name: /Próximo/i })
    ).toBeInTheDocument();
  });

  // Requisito 8.3: Submissão com erro 403 → mensagem de erro de autorização exibida
  it("exibe mensagem de erro de autorização quando API retorna 403", async () => {
    const user = userEvent.setup();
    vi.mocked(hasCredentials).mockReturnValue(true);
    vi.mocked(generateArchitecture).mockRejectedValue(
      new Error(
        "Erro de autorização. Recarregue a página e tente novamente."
      )
    );

    render(<App />);

    // Switch to V1 mode to access the classic form with spinbutton inputs
    const v1Button = screen.getByRole("button", { name: /Formulário \(V1\)/i });
    await user.click(v1Button);

    // Preencher formulário com dados válidos usando spinbuttons (inputs type=number)
    const numberInputs = screen.getAllByRole("spinbutton");
    // Os inputs numéricos são: Volume de Dados, Registros por Dia, Latência Máxima, Usuários Simultâneos,
    // Fontes de Coleta, APIs Externas, Nós Redshift
    await user.type(numberInputs[0], "10"); // data_volume_tb
    await user.type(numberInputs[1], "5"); // records_per_day_millions
    await user.type(numberInputs[2], "3"); // max_query_latency_sec
    await user.type(numberInputs[3], "50"); // concurrent_users

    // Submeter formulário
    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    await user.click(button);

    // Aguardar mensagem de erro aparecer
    await waitFor(() => {
      expect(
        screen.getByText(/Erro de autorização/i)
      ).toBeInTheDocument();
    });

    // Deve limpar credenciais quando erro de autorização ocorre
    expect(clearCredentials).toHaveBeenCalled();
  });

  // Requisito 8.1: Verifica que erros de conexão são exibidos na interface
  it("exibe mensagem de erro de conexão quando API falha por rede", async () => {
    const user = userEvent.setup();
    vi.mocked(hasCredentials).mockReturnValue(true);
    vi.mocked(generateArchitecture).mockRejectedValue(
      new Error("Erro de conexão. Verifique sua rede e tente novamente.")
    );

    render(<App />);

    // Switch to V1 mode to access the classic form with spinbutton inputs
    const v1Button = screen.getByRole("button", { name: /Formulário \(V1\)/i });
    await user.click(v1Button);

    // Preencher formulário
    const numberInputs = screen.getAllByRole("spinbutton");
    await user.type(numberInputs[0], "10");
    await user.type(numberInputs[1], "5");
    await user.type(numberInputs[2], "3");
    await user.type(numberInputs[3], "50");

    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    await user.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(/Erro de conexão/i)
      ).toBeInTheDocument();
    });
  });

  // Requisito 8.5: Erros são registrados no console
  it("registra erro técnico no console quando API falha", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(hasCredentials).mockReturnValue(true);
    vi.mocked(generateArchitecture).mockRejectedValue(
      new Error("Erro de autorização. Recarregue a página e tente novamente.")
    );

    render(<App />);

    // Switch to V1 mode to access the classic form with spinbutton inputs
    const v1Button = screen.getByRole("button", { name: /Formulário \(V1\)/i });
    await user.click(v1Button);

    const numberInputs = screen.getAllByRole("spinbutton");
    await user.type(numberInputs[0], "10");
    await user.type(numberInputs[1], "5");
    await user.type(numberInputs[2], "3");
    await user.type(numberInputs[3], "50");

    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    await user.click(button);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Erro técnico:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
