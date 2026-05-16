import { useState, useCallback } from 'react';

/**
 * Defines a validation rule for a single field.
 * - `field`: the field name to validate
 * - `validate`: function that receives the field value and returns an error message string or null
 */
export interface ValidationRule {
  field: string;
  validate: (value: unknown) => string | null;
}

/**
 * Hook that provides per-field validation for wizard step components.
 * Tracks errors and touched state, and exposes methods for validating
 * individual fields, all fields at once, and marking fields as touched.
 */
export function useStepValidation(rules: ValidationRule[]) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  /**
   * Validates a single field by its name and value.
   * Updates the errors state accordingly.
   * Returns the error message or null if valid.
   */
  const validateField = useCallback(
    (field: string, value: unknown): string | null => {
      const rule = rules.find((r) => r.field === field);
      if (!rule) return null;

      const error = rule.validate(value);
      setErrors((prev) => {
        if (error) {
          return { ...prev, [field]: error };
        }
        const { [field]: _, ...rest } = prev;
        return rest;
      });
      return error;
    },
    [rules]
  );

  /**
   * Validates all fields at once using the provided data record.
   * Marks all fields as touched and updates errors state.
   * Returns true if all fields pass validation, false otherwise.
   */
  const validateAll = useCallback(
    (data: Record<string, unknown>): boolean => {
      const newErrors: Record<string, string> = {};
      for (const rule of rules) {
        const error = rule.validate(data[rule.field]);
        if (error) {
          newErrors[rule.field] = error;
        }
      }
      setErrors(newErrors);
      setTouched(new Set(rules.map((r) => r.field)));
      return Object.keys(newErrors).length === 0;
    },
    [rules]
  );

  /**
   * Marks a field as touched (user has interacted with it).
   * Used to control when error messages are displayed.
   */
  const touchField = useCallback((field: string) => {
    setTouched((prev) => new Set([...prev, field]));
  }, []);

  return { errors, touched, validateField, validateAll, touchField };
}
