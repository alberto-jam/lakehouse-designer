import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NavigationButtons } from '../NavigationButtons';

describe('NavigationButtons', () => {
  const defaultProps = {
    isFirstStep: false,
    isLastStep: false,
    isOptional: false,
    isLoading: false,
    onBack: vi.fn(),
    onNext: vi.fn(),
    onSkip: vi.fn(),
    onGenerate: vi.fn(),
  };

  // Requisito 1.6: Esconde "Voltar" no primeiro passo
  it('hides "Voltar" button on first step', () => {
    render(<NavigationButtons {...defaultProps} isFirstStep={true} />);

    expect(screen.queryByText('Voltar')).not.toBeInTheDocument();
  });

  // Requisito 1.6: Exibe "Voltar" quando não é o primeiro passo
  it('shows "Voltar" button when not first step', () => {
    render(<NavigationButtons {...defaultProps} isFirstStep={false} />);

    expect(screen.getByText('Voltar')).toBeInTheDocument();
  });

  // Requisito 1.7: Esconde "Próximo" e exibe "Gerar Arquitetura" no último passo
  it('hides "Próximo" and shows "Gerar Arquitetura" on last step', () => {
    render(<NavigationButtons {...defaultProps} isLastStep={true} />);

    expect(screen.queryByText('Próximo')).not.toBeInTheDocument();
    expect(screen.getByText('Gerar Arquitetura')).toBeInTheDocument();
  });

  // Requisito 1.7: Exibe "Próximo" e esconde "Gerar Arquitetura" quando não é o último passo
  it('shows "Próximo" and hides "Gerar Arquitetura" when not last step', () => {
    render(<NavigationButtons {...defaultProps} isLastStep={false} />);

    expect(screen.getByText('Próximo')).toBeInTheDocument();
    expect(screen.queryByText('Gerar Arquitetura')).not.toBeInTheDocument();
  });

  // Requisito 2.5: Exibe "Pular" para passos opcionais
  it('shows "Pular" button for optional steps', () => {
    render(<NavigationButtons {...defaultProps} isOptional={true} />);

    expect(screen.getByText('Pular')).toBeInTheDocument();
  });

  // Requisito 2.5: Esconde "Pular" para passos obrigatórios
  it('hides "Pular" button for required steps', () => {
    render(<NavigationButtons {...defaultProps} isOptional={false} />);

    expect(screen.queryByText('Pular')).not.toBeInTheDocument();
  });

  // Desabilita botões durante loading
  it('disables all buttons during loading state', () => {
    render(
      <NavigationButtons
        {...defaultProps}
        isFirstStep={false}
        isOptional={true}
        isLoading={true}
      />
    );

    expect(screen.getByText('Voltar')).toBeDisabled();
    expect(screen.getByText('Pular')).toBeDisabled();
    expect(screen.getByText('Próximo')).toBeDisabled();
  });

  // Desabilita "Gerar Arquitetura" durante loading
  it('disables "Gerar Arquitetura" during loading state', () => {
    render(
      <NavigationButtons {...defaultProps} isLastStep={true} isLoading={true} />
    );

    expect(screen.getByText('Gerar Arquitetura')).toBeDisabled();
  });

  // Chama onBack ao clicar em "Voltar"
  it('calls onBack when "Voltar" is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(<NavigationButtons {...defaultProps} onBack={onBack} />);

    await user.click(screen.getByText('Voltar'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // Chama onNext ao clicar em "Próximo"
  it('calls onNext when "Próximo" is clicked', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();

    render(<NavigationButtons {...defaultProps} onNext={onNext} />);

    await user.click(screen.getByText('Próximo'));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // Chama onSkip ao clicar em "Pular"
  it('calls onSkip when "Pular" is clicked', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();

    render(
      <NavigationButtons {...defaultProps} isOptional={true} onSkip={onSkip} />
    );

    await user.click(screen.getByText('Pular'));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  // Chama onGenerate ao clicar em "Gerar Arquitetura"
  it('calls onGenerate when "Gerar Arquitetura" is clicked', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    render(
      <NavigationButtons
        {...defaultProps}
        isLastStep={true}
        onGenerate={onGenerate}
      />
    );

    await user.click(screen.getByText('Gerar Arquitetura'));

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  // Não exibe "Pular" no último passo mesmo se opcional
  it('does not show "Pular" on last step even if optional', () => {
    render(
      <NavigationButtons
        {...defaultProps}
        isLastStep={true}
        isOptional={true}
      />
    );

    expect(screen.queryByText('Pular')).not.toBeInTheDocument();
  });
});
