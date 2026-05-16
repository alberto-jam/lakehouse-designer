import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import Formulario from "../Formulario";

/**
 * Helper: finds an input/select by its label text.
 * The component uses <label> + sibling <input> without htmlFor,
 * so we locate the label then find the input within the same parent div.
 */
function getFieldByLabel(labelText: RegExp): HTMLInputElement | HTMLSelectElement {
  const label = screen.getByText(labelText);
  const container = label.closest("div")!;
  const input = container.querySelector("input, select") as
    | HTMLInputElement
    | HTMLSelectElement;
  return input;
}

describe("Formulario", () => {
  // Requisito 3.1: Renderiza todos os 5 campos obrigatórios
  it("renderiza todos os 5 campos do formulário", () => {
    render(<Formulario onSubmit={vi.fn()} loading={false} />);

    expect(screen.getByText(/Volume de Dados/i)).toBeInTheDocument();
    expect(getFieldByLabel(/Volume de Dados/i)).toBeInTheDocument();

    expect(screen.getByText(/Registros por Dia/i)).toBeInTheDocument();
    expect(getFieldByLabel(/Registros por Dia/i)).toBeInTheDocument();

    expect(screen.getByText(/Complexidade de Consulta/i)).toBeInTheDocument();
    expect(getFieldByLabel(/Complexidade de Consulta/i)).toBeInTheDocument();

    expect(screen.getByText(/Latência Máxima/i)).toBeInTheDocument();
    expect(getFieldByLabel(/Latência Máxima/i)).toBeInTheDocument();

    expect(screen.getByText(/Usuários Simultâneos/i)).toBeInTheDocument();
    expect(getFieldByLabel(/Usuários Simultâneos/i)).toBeInTheDocument();
  });

  // Requisito 3.5: Desabilita botão durante loading
  it("desabilita o botão de submissão quando loading=true", () => {
    render(<Formulario onSubmit={vi.fn()} loading={true} />);

    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    expect(button).toBeDisabled();
  });

  it("habilita o botão de submissão quando loading=false", () => {
    render(<Formulario onSubmit={vi.fn()} loading={false} />);

    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    expect(button).toBeEnabled();
  });

  // Requisito 3.2, 3.3: Exibe validação para campos inválidos/vazios
  it("exibe mensagens de validação quando campos obrigatórios estão vazios", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} loading={false} />);

    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    await user.click(button);

    const errorMessages = screen.getAllByText("Campo obrigatório");
    expect(errorMessages.length).toBeGreaterThanOrEqual(4);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("exibe mensagem de validação para valores numéricos menores ou iguais a zero", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} loading={false} />);

    const volumeInput = getFieldByLabel(/Volume de Dados/i);
    const registrosInput = getFieldByLabel(/Registros por Dia/i);
    const latenciaInput = getFieldByLabel(/Latência Máxima/i);
    const usuariosInput = getFieldByLabel(/Usuários Simultâneos/i);

    await user.type(volumeInput, "0");
    await user.type(registrosInput, "-1");
    await user.type(latenciaInput, "0");
    await user.type(usuariosInput, "-5");

    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    await user.click(button);

    const errorMessages = screen.getAllByText("O valor deve ser positivo");
    expect(errorMessages.length).toBeGreaterThanOrEqual(4);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Requisito 3.4: Chama onSubmit com dados válidos
  it("chama onSubmit com dados corretos quando todos os campos são válidos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Formulario onSubmit={onSubmit} loading={false} />);

    const volumeInput = getFieldByLabel(/Volume de Dados/i);
    const registrosInput = getFieldByLabel(/Registros por Dia/i);
    const complexidadeSelect = getFieldByLabel(/Complexidade de Consulta/i);
    const latenciaInput = getFieldByLabel(/Latência Máxima/i);
    const usuariosInput = getFieldByLabel(/Usuários Simultâneos/i);

    await user.type(volumeInput, "10");
    await user.type(registrosInput, "5");
    await user.selectOptions(complexidadeSelect, "high");
    await user.type(latenciaInput, "3");
    await user.type(usuariosInput, "50");

    const button = screen.getByRole("button", { name: /Gerar Arquitetura/i });
    await user.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const callArgs = onSubmit.mock.calls[0][0];
    expect(callArgs.data_volume_tb).toBe(10);
    expect(callArgs.records_per_day_millions).toBe(5);
    expect(callArgs.avg_query_complexity).toBe("high");
    expect(callArgs.max_query_latency_sec).toBe(3);
    expect(callArgs.concurrent_users).toBe(50);
  });
});
