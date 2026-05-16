import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CostBreakdown } from './CostBreakdown';
import type { CostEstimate } from '../../services/typesV2';

const mockCostEstimate: CostEstimate = {
  monthly_total_usd: 1234.56,
  breakdown: [
    {
      service: 'Amazon S3',
      monthly_cost_usd: 500.0,
      unit_price: 0.023,
      unit: 'GB/month',
      quantity: 21739,
    },
    {
      service: 'AWS Glue',
      monthly_cost_usd: 734.56,
      unit_price: 0.44,
      unit: 'DPU-hour',
      quantity: 1669,
    },
  ],
  assumptions: [
    '730 hours per month',
    '10 DPUs per Glue job',
    '5 TB scanned per query average',
  ],
  notes: [
    '[2024-01-15T10:30:00Z] Used AWS Price List API for S3 pricing',
    '[2024-01-15T10:30:01Z] Fallback pricing used for Glue (API unavailable)',
    'Manual override applied for Redshift',
  ],
  unit_prices: {
    's3_storage_gb': 0.023,
    'glue_dpu_hour': 0.44,
  },
  pricing_location: 'US East (N. Virginia)',
  pricing_api_region: 'us-east-1',
};

describe('CostBreakdown', () => {
  it('displays monthly total prominently', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    const totalElement = screen.getByTestId('monthly-total');
    expect(totalElement).toHaveTextContent('$1,234.56');
  });

  it('formats monetary values as USD with 2 decimal places', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    // Check the total
    expect(screen.getByTestId('monthly-total')).toHaveTextContent('$1,234.56');
    // Check table values
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$734.56')).toBeInTheDocument();
    expect(screen.getByText('$0.02')).toBeInTheDocument(); // unit price 0.023 rounded
  });

  it('renders breakdown table with correct columns', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    const table = screen.getByTestId('cost-table');

    // Check headers
    expect(within(table).getByText('Serviço')).toBeInTheDocument();
    expect(within(table).getByText('Custo Mensal (USD)')).toBeInTheDocument();
    expect(within(table).getByText('Preço Unitário')).toBeInTheDocument();
    expect(within(table).getByText('Quantidade')).toBeInTheDocument();
    expect(within(table).getByText('Unidade')).toBeInTheDocument();
  });

  it('renders each service in the breakdown table', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    expect(screen.getByText('Amazon S3')).toBeInTheDocument();
    expect(screen.getByText('AWS Glue')).toBeInTheDocument();
  });

  it('renders table footer with total', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    const table = screen.getByTestId('cost-table');
    expect(within(table).getByText('Total')).toBeInTheDocument();
  });

  it('displays assumptions as bullet points', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    const section = screen.getByTestId('assumptions-section');
    expect(within(section).getByText('730 hours per month')).toBeInTheDocument();
    expect(within(section).getByText('10 DPUs per Glue job')).toBeInTheDocument();
    expect(within(section).getByText('5 TB scanned per query average')).toBeInTheDocument();
  });

  it('hides assumptions section when empty', () => {
    const noAssumptions: CostEstimate = {
      ...mockCostEstimate,
      assumptions: [],
    };
    render(<CostBreakdown costEstimate={noAssumptions} />);
    expect(screen.queryByTestId('assumptions-section')).not.toBeInTheDocument();
  });

  it('displays notes/audit trail', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    const section = screen.getByTestId('notes-section');
    expect(within(section).getByText('Used AWS Price List API for S3 pricing')).toBeInTheDocument();
    expect(within(section).getByText('Fallback pricing used for Glue (API unavailable)')).toBeInTheDocument();
    expect(within(section).getByText('Manual override applied for Redshift')).toBeInTheDocument();
  });

  it('parses and displays timestamps from notes', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    const section = screen.getByTestId('notes-section');
    // Notes with timestamps should have the timestamp rendered separately
    const listItems = section.querySelectorAll('li');
    // First two notes have timestamps, third does not
    expect(listItems[0].querySelector('.font-mono')).not.toBeNull();
    expect(listItems[1].querySelector('.font-mono')).not.toBeNull();
    expect(listItems[2].querySelector('.font-mono')).toBeNull();
  });

  it('hides notes section when empty', () => {
    const noNotes: CostEstimate = {
      ...mockCostEstimate,
      notes: [],
    };
    render(<CostBreakdown costEstimate={noNotes} />);
    expect(screen.queryByTestId('notes-section')).not.toBeInTheDocument();
  });

  it('displays pricing_location and pricing_api_region', () => {
    render(<CostBreakdown costEstimate={mockCostEstimate} />);
    const metadata = screen.getByTestId('pricing-metadata');
    expect(within(metadata).getByText('US East (N. Virginia)')).toBeInTheDocument();
    expect(within(metadata).getByText('us-east-1')).toBeInTheDocument();
  });

  it('handles zero monthly total', () => {
    const zeroCost: CostEstimate = {
      ...mockCostEstimate,
      monthly_total_usd: 0,
      breakdown: [],
    };
    render(<CostBreakdown costEstimate={zeroCost} />);
    expect(screen.getByTestId('monthly-total')).toHaveTextContent('$0.00');
  });

  it('handles large monetary values correctly', () => {
    const largeCost: CostEstimate = {
      ...mockCostEstimate,
      monthly_total_usd: 99999.99,
    };
    render(<CostBreakdown costEstimate={largeCost} />);
    expect(screen.getByTestId('monthly-total')).toHaveTextContent('$99,999.99');
  });
});
