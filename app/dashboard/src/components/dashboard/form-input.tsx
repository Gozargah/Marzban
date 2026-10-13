import { forwardRef, useId, ReactNode } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Shares the accessible field markup used by node configuration forms.
export const FormInput = forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & { label?: ReactNode; error?: string }
>(({ label, error, id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field className="gap-1.5" data-invalid={!!error}>
      {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
      <Input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </Field>
  );
});
FormInput.displayName = "FormInput";
