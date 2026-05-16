import { describe, it, expect } from 'vitest';
import { wizardReducer, initialWizardState } from './useWizardState';
import type { WizardState, WizardAction, ProjectData, SourcesData, GenerateV2Response } from '../services/typesV2';

describe('wizardReducer', () => {
  const mockProjectData: ProjectData = {
    project_name: 'test-project',
    environment: 'dev',
    region: 'us-east-1',
    description: 'A test project',
  };

  const mockSourcesData: SourcesData = {
    data_volume_tb: 10,
    records_per_day_millions: 5,
    data_source_count: 3,
    dms_cdc_enabled: false,
    source_types: ['CSV', 'JSON'],
  };

  describe('NEXT_STEP', () => {
    it('saves step data, marks step complete, and increments currentStep', () => {
      const state = initialWizardState;
      const action: WizardAction = { type: 'NEXT_STEP', data: mockProjectData };

      const result = wizardReducer(state, action);

      expect(result.currentStep).toBe(1);
      expect(result.stepData[0]).toEqual(mockProjectData);
      expect(result.completedSteps.has(0)).toBe(true);
    });

    it('preserves previously saved step data', () => {
      const state: WizardState = {
        ...initialWizardState,
        currentStep: 1,
        stepData: { 0: mockProjectData },
        completedSteps: new Set([0]),
      };
      const action: WizardAction = { type: 'NEXT_STEP', data: mockSourcesData };

      const result = wizardReducer(state, action);

      expect(result.currentStep).toBe(2);
      expect(result.stepData[0]).toEqual(mockProjectData);
      expect(result.stepData[1]).toEqual(mockSourcesData);
      expect(result.completedSteps.has(0)).toBe(true);
      expect(result.completedSteps.has(1)).toBe(true);
    });
  });

  describe('SKIP_STEP', () => {
    it('increments currentStep without saving data', () => {
      const state: WizardState = {
        ...initialWizardState,
        currentStep: 4,
        stepData: { 0: mockProjectData },
        completedSteps: new Set([0]),
      };
      const action: WizardAction = { type: 'SKIP_STEP' };

      const result = wizardReducer(state, action);

      expect(result.currentStep).toBe(5);
      expect(result.stepData[4]).toBeUndefined();
      expect(result.completedSteps.has(4)).toBe(false);
    });

    it('does not modify existing step data', () => {
      const state: WizardState = {
        ...initialWizardState,
        currentStep: 2,
        stepData: { 0: mockProjectData, 1: mockSourcesData },
        completedSteps: new Set([0, 1]),
      };
      const action: WizardAction = { type: 'SKIP_STEP' };

      const result = wizardReducer(state, action);

      expect(result.stepData[0]).toEqual(mockProjectData);
      expect(result.stepData[1]).toEqual(mockSourcesData);
    });
  });

  describe('PREV_STEP', () => {
    it('discards current step data and decrements currentStep', () => {
      const state: WizardState = {
        ...initialWizardState,
        currentStep: 2,
        stepData: { 0: mockProjectData, 1: mockSourcesData, 2: mockProjectData },
        completedSteps: new Set([0, 1]),
      };
      const action: WizardAction = { type: 'PREV_STEP' };

      const result = wizardReducer(state, action);

      expect(result.currentStep).toBe(1);
      expect(result.stepData[2]).toBeUndefined();
      expect(result.stepData[0]).toEqual(mockProjectData);
      expect(result.stepData[1]).toEqual(mockSourcesData);
    });

    it('works when current step has no data', () => {
      const state: WizardState = {
        ...initialWizardState,
        currentStep: 3,
        stepData: { 0: mockProjectData },
        completedSteps: new Set([0]),
      };
      const action: WizardAction = { type: 'PREV_STEP' };

      const result = wizardReducer(state, action);

      expect(result.currentStep).toBe(2);
      expect(result.stepData[0]).toEqual(mockProjectData);
    });
  });

  describe('SET_GENERATION_STATUS', () => {
    it('updates generationStatus', () => {
      const state = initialWizardState;
      const action: WizardAction = { type: 'SET_GENERATION_STATUS', status: 'loading' };

      const result = wizardReducer(state, action);

      expect(result.generationStatus).toBe('loading');
    });
  });

  describe('SET_GENERATION_RESULT', () => {
    it('sets generationResult and status to success', () => {
      const mockResult: GenerateV2Response = {
        diagram: { content_base64: 'abc123', filename: 'test.drawio' },
        spec_source: 'deterministic',
        spec: { architecture_type: 'lakehouse', services: [], connections: [], layers: [] },
        cost_estimate: {
          monthly_total_usd: 150,
          breakdown: [],
          assumptions: [],
          notes: [],
          unit_prices: {},
          pricing_location: 'US East (N. Virginia)',
          pricing_api_region: 'us-east-1',
        },
        warnings: [],
        mermaid_diagram: 'graph TD; A-->B',
        provisioning_steps: [],
      };
      const state: WizardState = { ...initialWizardState, generationStatus: 'loading' };
      const action: WizardAction = { type: 'SET_GENERATION_RESULT', result: mockResult };

      const result = wizardReducer(state, action);

      expect(result.generationResult).toEqual(mockResult);
      expect(result.generationStatus).toBe('success');
    });
  });

  describe('SET_GENERATION_ERROR', () => {
    it('sets generationError and status to error', () => {
      const state: WizardState = { ...initialWizardState, generationStatus: 'loading' };
      const action: WizardAction = { type: 'SET_GENERATION_ERROR', error: 'Network timeout' };

      const result = wizardReducer(state, action);

      expect(result.generationError).toBe('Network timeout');
      expect(result.generationStatus).toBe('error');
    });
  });

  describe('RESET', () => {
    it('returns to initial state', () => {
      const state: WizardState = {
        currentStep: 5,
        completedSteps: new Set([0, 1, 2, 3, 4]),
        stepData: { 0: mockProjectData, 1: mockSourcesData },
        generationStatus: 'error',
        generationResult: null,
        generationError: 'Some error',
      };
      const action: WizardAction = { type: 'RESET' };

      const result = wizardReducer(state, action);

      expect(result.currentStep).toBe(0);
      expect(result.completedSteps.size).toBe(0);
      expect(Object.keys(result.stepData)).toHaveLength(0);
      expect(result.generationStatus).toBe('idle');
      expect(result.generationResult).toBeNull();
      expect(result.generationError).toBeNull();
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged for unknown action type', () => {
      const state = initialWizardState;
      // @ts-expect-error testing unknown action
      const result = wizardReducer(state, { type: 'UNKNOWN_ACTION' });

      expect(result).toEqual(state);
    });
  });
});
