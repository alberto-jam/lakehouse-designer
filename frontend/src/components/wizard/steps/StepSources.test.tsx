import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import StepSources from './StepSources';

describe('StepSources', () => {
  const defaultProps = {
    data: undefined,
    onValidSubmit: vi.fn(),
    registerSubmit: vi.fn(),
  };

  it('renders all required fields', () => {
    render(<StepSources {...defaultProps} />);

    expect(screen.getByLabelText(/volume total de dados/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/registros por dia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantidade de fontes/i)).toBeInTheDocument();
  });

  it('renders source type checkboxes', () => {
    render(<StepSources {...defaultProps} />);

    expect(screen.getByLabelText('CSV')).toBeInTheDocument();
    expect(screen.getByLabelText('JSON')).toBeInTheDocument();
    expect(screen.getByLabelText('Parquet')).toBeInTheDocument();
    expect(screen.getByLabelText('Avro')).toBeInTheDocument();
    expect(screen.getByLabelText('ORC')).toBeInTheDocument();
  });

  it('initializes from existing data prop', () => {
    const existingData = {
      data_volume_tb: 5.5,
      records_per_day_millions: 10,
      data_source_count: 3,
      dms_cdc_enabled: false,
      source_types: ['CSV', 'Parquet'],
    };

    render(<StepSources {...defaultProps} data={existingData} />);

    expect(screen.getByLabelText(/volume total de dados/i)).toHaveValue(5.5);
    expect(screen.getByLabelText(/registros por dia/i)).toHaveValue(10);
    expect(screen.getByLabelText(/quantidade de fontes/i)).toHaveValue(3);
    expect(screen.getByLabelText('CSV')).toBeChecked();
    expect(screen.getByLabelText('Parquet')).toBeChecked();
    expect(screen.getByLabelText('JSON')).not.toBeChecked();
  });

  it('shows validation error when volume is empty on blur', async () => {
    render(<StepSources {...defaultProps} />);

    const volumeInput = screen.getByLabelText(/volume total de dados/i);
    fireEvent.focus(volumeInput);
    fireEvent.blur(volumeInput);

    await waitFor(() => {
      expect(screen.getByText(/volume de dados é obrigatório/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when volume is zero', async () => {
    const user = userEvent.setup();
    render(<StepSources {...defaultProps} />);

    const volumeInput = screen.getByLabelText(/volume total de dados/i);
    await user.type(volumeInput, '0');
    fireEvent.blur(volumeInput);

    await waitFor(() => {
      expect(screen.getByText(/deve ser um número positivo maior que zero/i)).toBeInTheDocument();
    });
  });

  it('calls onValidSubmit with correct data when form is valid', () => {
    const onValidSubmit = vi.fn();
    let submitFn: (() => void) | undefined;
    const registerSubmit = (fn: () => void) => { submitFn = fn; };

    render(
      <StepSources
        data={undefined}
        onValidSubmit={onValidSubmit}
        registerSubmit={registerSubmit}
      />
    );

    // Fill in valid data
    const volumeInput = screen.getByLabelText(/volume total de dados/i);
    const recordsInput = screen.getByLabelText(/registros por dia/i);
    const sourcesInput = screen.getByLabelText(/quantidade de fontes/i);

    fireEvent.change(volumeInput, { target: { value: '5' } });
    fireEvent.change(recordsInput, { target: { value: '10' } });
    fireEvent.change(sourcesInput, { target: { value: '3' } });

    // Toggle a source type
    fireEvent.click(screen.getByLabelText('CSV'));

    // Trigger submit
    submitFn!();

    expect(onValidSubmit).toHaveBeenCalledWith({
      data_volume_tb: 5,
      records_per_day_millions: 10,
      data_source_count: 3,
      dms_cdc_enabled: false,
      source_types: ['CSV'],
    });
  });

  it('does not call onValidSubmit when validation fails', () => {
    const onValidSubmit = vi.fn();
    let submitFn: (() => void) | undefined;
    const registerSubmit = (fn: () => void) => { submitFn = fn; };

    render(
      <StepSources
        data={undefined}
        onValidSubmit={onValidSubmit}
        registerSubmit={registerSubmit}
      />
    );

    // Submit without filling anything
    submitFn!();

    expect(onValidSubmit).not.toHaveBeenCalled();
  });

  it('registers submit function via registerSubmit prop', () => {
    const registerSubmit = vi.fn();
    render(<StepSources {...defaultProps} registerSubmit={registerSubmit} />);

    expect(registerSubmit).toHaveBeenCalledWith(expect.any(Function));
  });

  it('validates data_source_count must be non-negative integer', async () => {
    const user = userEvent.setup();
    render(<StepSources {...defaultProps} />);

    const sourcesInput = screen.getByLabelText(/quantidade de fontes/i);
    await user.type(sourcesInput, '-1');
    fireEvent.blur(sourcesInput);

    await waitFor(() => {
      expect(screen.getByText(/número inteiro não-negativo/i)).toBeInTheDocument();
    });
  });
});
