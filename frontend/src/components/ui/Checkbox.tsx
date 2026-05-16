import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: string;
  description?: string;
  error?: string;
  checkboxSize?: 'sm' | 'md';
}

const checkboxSizeStyles: Record<NonNullable<CheckboxProps['checkboxSize']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export function Checkbox({
  label,
  description,
  error,
  checkboxSize = 'md',
  id,
  className = '',
  ...props
}: CheckboxProps) {
  const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={checkboxId}
        className={[
          'flex items-start gap-3 cursor-pointer select-none',
          props.disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <input
          type="checkbox"
          id={checkboxId}
          className={[
            'rounded border transition-colors duration-150 cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400',
            'checked:bg-slate-800 checked:border-slate-800 checked:hover:bg-slate-700',
            'disabled:cursor-not-allowed',
            hasError ? 'border-red-300' : 'border-slate-300',
            checkboxSizeStyles[checkboxSize],
            'mt-0.5',
            className,
          ].join(' ')}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `${checkboxId}-error`
              : description
                ? `${checkboxId}-description`
                : undefined
          }
          {...props}
        />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          {description && (
            <span
              id={`${checkboxId}-description`}
              className="text-xs text-slate-500 mt-0.5"
            >
              {description}
            </span>
          )}
        </div>
      </label>
      {hasError && (
        <p id={`${checkboxId}-error`} className="text-xs text-red-600 ml-8" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
