import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  inputSize?: 'sm' | 'md' | 'lg';
}

const inputSizeStyles: Record<NonNullable<InputProps['inputSize']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
};

export function Input({
  label,
  error,
  hint,
  inputSize = 'md',
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'rounded-md border bg-white transition-colors duration-150',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
          hasError
            ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
            : 'border-slate-300 focus:border-slate-400 focus:ring-slate-200',
          inputSizeStyles[inputSize],
          className,
        ].join(' ')}
        aria-invalid={hasError}
        aria-describedby={
          hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        {...props}
      />
      {hint && !hasError && (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={`${inputId}-error`} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
