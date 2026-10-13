import { z } from "zod";

export const GIB = 1073741824;

/** Слать bs_extra только если пользователь менял поле, даже если цифра совпала с отображаемой. */
export function shouldSubmitBsExtra(
  submittedBytes: number | null | undefined,
  dirty: boolean | undefined
): submittedBytes is number {
  return dirty === true && submittedBytes != null;
}

/** ГБ из инпута → байты. Отрицательные и NaN отклоняются до перевода. */
export function parseBsExtraGbInput(
  value: string | number | null | undefined
): number | undefined {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n) || n < 0) {
    throw new Error("bs_extra must be 0 or greater");
  }
  if (!n) {
    return 0;
  }
  return Number((n * GIB).toFixed(5));
}

export const bsExtraGbSchema = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .superRefine((val, ctx) => {
    if (val === "" || val === null || val === undefined) {
      return;
    }
    try {
      parseBsExtraGbInput(val);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be 0 or greater",
      });
    }
  })
  .transform((val) => {
    if (val === "" || val === null || val === undefined) {
      return undefined;
    }
    return parseBsExtraGbInput(val);
  });
