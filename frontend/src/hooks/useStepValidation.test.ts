import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useStepValidation, ValidationRule } from './useStepValidation';

const sampleRules: ValidationRule[] = [
  {
    field: 'name',
    validate: (value) =>
      typeof value === 'string' && value.trim().length > 0
        ? null
        : 'Nome é obrigatório',
  },
  {
    field: 'volume',
    validate: (value) =>
      typeof value === 'number' && value > 0
        ? null
        : 'Volume deve ser maior que zero',
  },
];

describe('useStepValidation', () => {
  it('initializes with empty errors and empty touched set', () => {
    const { result } = renderHook(() => useStepValidation(sampleRules));

    expect(result.current.errors).toEqual({});
    expect(result.current.touched.size).toBe(0);
  });

  describe('validateField', () => {
    it('returns null and clears error for a valid field', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      let error: string | null;
      act(() => {
        error = result.current.validateField('name', 'My Project');
      });

      expect(error!).toBeNull();
      expect(result.current.errors).not.toHaveProperty('name');
    });

    it('returns error message and sets error for an invalid field', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      let error: string | null;
      act(() => {
        error = result.current.validateField('name', '');
      });

      expect(error!).toBe('Nome é obrigatório');
      expect(result.current.errors['name']).toBe('Nome é obrigatório');
    });

    it('clears a previously set error when field becomes valid', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      act(() => {
        result.current.validateField('name', '');
      });
      expect(result.current.errors['name']).toBe('Nome é obrigatório');

      act(() => {
        result.current.validateField('name', 'Valid Name');
      });
      expect(result.current.errors).not.toHaveProperty('name');
    });

    it('returns null for a field not in the rules', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      let error: string | null;
      act(() => {
        error = result.current.validateField('unknown_field', 'anything');
      });

      expect(error!).toBeNull();
    });

    it('does not affect other fields when validating one field', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      act(() => {
        result.current.validateField('name', '');
        result.current.validateField('volume', -1);
      });

      expect(result.current.errors['name']).toBe('Nome é obrigatório');
      expect(result.current.errors['volume']).toBe('Volume deve ser maior que zero');

      act(() => {
        result.current.validateField('name', 'Fixed');
      });

      expect(result.current.errors).not.toHaveProperty('name');
      expect(result.current.errors['volume']).toBe('Volume deve ser maior que zero');
    });
  });

  describe('validateAll', () => {
    it('returns true when all fields are valid', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll({ name: 'Project', volume: 10 });
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors).toEqual({});
    });

    it('returns false and sets errors when fields are invalid', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll({ name: '', volume: 0 });
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors['name']).toBe('Nome é obrigatório');
      expect(result.current.errors['volume']).toBe('Volume deve ser maior que zero');
    });

    it('marks all fields as touched', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      act(() => {
        result.current.validateAll({ name: 'Project', volume: 10 });
      });

      expect(result.current.touched.has('name')).toBe(true);
      expect(result.current.touched.has('volume')).toBe(true);
    });

    it('clears previous errors for fields that are now valid', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      act(() => {
        result.current.validateAll({ name: '', volume: 0 });
      });
      expect(Object.keys(result.current.errors).length).toBe(2);

      act(() => {
        result.current.validateAll({ name: 'Fixed', volume: 5 });
      });
      expect(result.current.errors).toEqual({});
    });

    it('handles undefined field values', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll({});
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors['name']).toBe('Nome é obrigatório');
      expect(result.current.errors['volume']).toBe('Volume deve ser maior que zero');
    });
  });

  describe('touchField', () => {
    it('adds a field to the touched set', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      act(() => {
        result.current.touchField('name');
      });

      expect(result.current.touched.has('name')).toBe(true);
      expect(result.current.touched.has('volume')).toBe(false);
    });

    it('does not remove previously touched fields', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      act(() => {
        result.current.touchField('name');
      });
      act(() => {
        result.current.touchField('volume');
      });

      expect(result.current.touched.has('name')).toBe(true);
      expect(result.current.touched.has('volume')).toBe(true);
    });

    it('is idempotent for the same field', () => {
      const { result } = renderHook(() => useStepValidation(sampleRules));

      act(() => {
        result.current.touchField('name');
        result.current.touchField('name');
      });

      expect(result.current.touched.size).toBe(1);
    });
  });
});
