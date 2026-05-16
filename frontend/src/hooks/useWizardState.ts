import { useReducer } from 'react';
import type { WizardState, WizardAction, StepData, GenerateV2Response } from '../services/typesV2';

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialWizardState: WizardState = {
  currentStep: 0,
  completedSteps: new Set<number>(),
  stepData: {},
  generationStatus: 'idle',
  generationResult: null,
  generationError: null,
};

// -----------------------------------------------------------------------------
// Reducer
// -----------------------------------------------------------------------------

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT_STEP':
      return {
        ...state,
        stepData: { ...state.stepData, [state.currentStep]: action.data },
        completedSteps: new Set([...state.completedSteps, state.currentStep]),
        currentStep: state.currentStep + 1,
      };
    case 'SKIP_STEP':
      return {
        ...state,
        currentStep: state.currentStep + 1,
      };
    case 'PREV_STEP': {
      // Discard current step data on back navigation
      const { [state.currentStep]: _discarded, ...remainingData } = state.stepData;
      return {
        ...state,
        stepData: remainingData,
        currentStep: state.currentStep - 1,
      };
    }
    case 'SET_GENERATION_STATUS':
      return { ...state, generationStatus: action.status };
    case 'SET_GENERATION_RESULT':
      return { ...state, generationResult: action.result, generationStatus: 'success' };
    case 'SET_GENERATION_ERROR':
      return { ...state, generationError: action.error, generationStatus: 'error' };
    case 'RESET':
      return initialWizardState;
    default:
      return state;
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useWizardState() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);

  const nextStep = (data: StepData) => dispatch({ type: 'NEXT_STEP', data });
  const skipStep = () => dispatch({ type: 'SKIP_STEP' });
  const prevStep = () => dispatch({ type: 'PREV_STEP' });
  const setGenerationStatus = (status: WizardState['generationStatus']) =>
    dispatch({ type: 'SET_GENERATION_STATUS', status });
  const setGenerationResult = (result: GenerateV2Response) =>
    dispatch({ type: 'SET_GENERATION_RESULT', result });
  const setGenerationError = (error: string) =>
    dispatch({ type: 'SET_GENERATION_ERROR', error });
  const reset = () => dispatch({ type: 'RESET' });

  return {
    state,
    nextStep,
    skipStep,
    prevStep,
    setGenerationStatus,
    setGenerationResult,
    setGenerationError,
    reset,
  };
}

// Export reducer and initial state for testing
export { wizardReducer, initialWizardState };
