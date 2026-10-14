import { useEffect } from "react";
import { useFormState, useWatch, type FieldValues, type UseFormReturn } from "react-hook-form";
import { readDraft, saveDraft } from "./drafts";

/** Tab-scoped, short-lived drafts are cleared on save/discard/logout. Never reload automatically. */
export function useRecoverableDraft<T extends FieldValues>(key: string, form: UseFormReturn<T>, open: boolean) {
  const values = useWatch({ control: form.control });
  const { isDirty } = useFormState({ control: form.control });
  useEffect(() => {
    if (!open) return;
    const draft = readDraft(key);
    if (draft) form.reset(draft as T, { keepDefaultValues: true });
  }, [key, open, form]);
  useEffect(() => {
    if (!open) return;
    const subscription = form.watch((_values, { name }) => {
      if (name) saveDraft(key, form.getValues());
    });
    return () => subscription.unsubscribe();
  }, [key, open, form]);
  useEffect(() => {
    if (open && isDirty) saveDraft(key, form.getValues());
  }, [key, open, isDirty, values, form]);
}
