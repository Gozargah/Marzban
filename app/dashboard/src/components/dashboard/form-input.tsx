import { forwardRef, useId, ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Shares the accessible field markup used by node configuration forms.
export const FormInput = forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & { label?: ReactNode; description?: ReactNode; error?: string }
>(({ label, description, error, id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field className="gap-1.5" data-invalid={!!error}>
      {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
      <Input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={[description && `${inputId}-description`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {description && <FieldDescription id={`${inputId}-description`}>{description}</FieldDescription>}
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </Field>
  );
});
FormInput.displayName = "FormInput";
