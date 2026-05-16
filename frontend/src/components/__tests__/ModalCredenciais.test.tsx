import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ModalCredenciais from "../ModalCredenciais";

describe("ModalCredenciais", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onClear: vi.fn(),
  };

  // Requisito 1.1: Exibe modal quando isOpen=true
  it("renders modal when isOpen is true", () => {
    render(<ModalCredenciais {...defaultProps} />);

    expect(screen.getByText("Credenciais AWS")).toBeInTheDocument();
    expect(screen.getByLabelText("Access Key ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Secret Access Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Session Token")).toBeInTheDocument();
    expect(screen.getByText("Confirmar")).toBeInTheDocument();
    expect(screen.getByText("Limpar Credenciais")).toBeInTheDocument();
  });

  // Requisito 1.1: Não exibe modal quando isOpen=false
  it("does not render when isOpen is false", () => {
    render(<ModalCredenciais {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("Credenciais AWS")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Access Key ID")).not.toBeInTheDocument();
  });

  // Requisito 1.4: Preenche campos com initialValues
  it("pre-fills fields with initialValues", () => {
    const initialValues = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG",
      sessionToken: "FwoGZXIvYXdzEBYaDH",
    };

    render(
      <ModalCredenciais {...defaultProps} initialValues={initialValues} />
    );

    expect(screen.getByLabelText("Access Key ID")).toHaveValue(
      "AKIAIOSFODNN7EXAMPLE"
    );
    expect(screen.getByLabelText("Secret Access Key")).toHaveValue(
      "wJalrXUtnFEMI/K7MDENG"
    );
    expect(screen.getByLabelText("Session Token")).toHaveValue(
      "FwoGZXIvYXdzEBYaDH"
    );
  });

  // Requisito 1.5: Exibe validação para campos vazios
  it("shows validation message when trying to confirm with empty fields", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<ModalCredenciais {...defaultProps} onSave={onSave} />);

    await user.click(screen.getByText("Confirmar"));

    expect(
      screen.getByText("Todos os três campos são obrigatórios.")
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  // Requisito 1.2: Chama onSave com valores corretos
  it("calls onSave with correct values when fields are filled and Confirmar is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<ModalCredenciais {...defaultProps} onSave={onSave} />);

    await user.type(screen.getByLabelText("Access Key ID"), "AKIATEST123");
    await user.type(screen.getByLabelText("Secret Access Key"), "secretKey123");
    await user.type(screen.getByLabelText("Session Token"), "token123");

    await user.click(screen.getByText("Confirmar"));

    expect(onSave).toHaveBeenCalledWith({
      accessKeyId: "AKIATEST123",
      secretAccessKey: "secretKey123",
      sessionToken: "token123",
    });
  });

  // Requisito 1.6: Chama onClear quando "Limpar Credenciais" é clicado
  it("calls onClear when 'Limpar Credenciais' is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(<ModalCredenciais {...defaultProps} onClear={onClear} />);

    await user.click(screen.getByText("Limpar Credenciais"));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
