import { ChangeEvent } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
  rows?: number;
}

export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  placeholder,
  options = [],
  disabled = false,
  min,
  max,
  rows = 3,
}: FormFieldProps) {
  const baseInputClass = `
    block w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400
    focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    transition-colors duration-150
    ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'}
  `;

  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {type === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={baseInputClass}
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          rows={rows}
          className={baseInputClass + ' resize-y'}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          className={baseInputClass}
        />
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
