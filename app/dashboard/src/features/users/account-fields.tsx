import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resetStrategy } from "constants/UserSettings";
import dayjs from "dayjs";
import { RefreshCw } from "lucide-react";
import ReactDatePicker from "react-datepicker";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { relativeExpiryDate } from "utils/dateFormatter";
import type { FormType } from "./form";

export function UserAccountFields({ fieldId, disabled, isEditing, language }: { fieldId: (name: string) => string; disabled: boolean; isEditing: boolean; language: string }) {
  const form = useFormContext<FormType>();
  const { t } = useTranslation();
  const [dataLimit, userStatus] = useWatch({ control: form.control, name: ["data_limit", "status"] });
  const isOnHold = userStatus === "on_hold";
  const createRandomUsername = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const username = Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) => characters[value % characters.length]).join("");
    form.setValue("username", username, { shouldDirty: true, shouldValidate: true });
  };
  return (
    <FieldSet className="min-w-0 gap-5">
      <FieldLegend>{t("userDialog.accountDetails", { defaultValue: "Account details" })}</FieldLegend>
      <div className="flex items-start gap-3">
        <Field className="min-w-0 flex-1" data-invalid={!!form.formState.errors.username}>
          <div className="flex items-center gap-2">
            <FieldLabel htmlFor={fieldId("username")}>{t("username")}</FieldLabel>
            {!isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={t("userDialog.generateRandomUsername", {
                  defaultValue: "Generate random username",
                })}
                onClick={createRandomUsername}
              >
                <RefreshCw />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Input
              id={fieldId("username")}
              autoComplete="off"
              disabled={disabled || isEditing}
              aria-invalid={!!form.formState.errors.username}
              aria-describedby={form.formState.errors.username ? fieldId("username-error") : undefined}
              {...form.register("username")}
            />
            {isEditing && (
              <Controller
                name="status"
                control={form.control}
                render={({ field }) => (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Switch
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          disabled={disabled}
                          aria-label={t(`status.${field.value}`)}
                          checked={field.value === "active"}
                          onCheckedChange={(checked) => field.onChange(checked ? "active" : "disabled")}
                        />
                      }
                    />
                    <TooltipContent>{t(`status.${field.value}`)}</TooltipContent>
                  </Tooltip>
                )}
              />
            )}
          </div>
          <FieldError id={fieldId("username-error")}>{form.formState.errors.username?.message && t(form.formState.errors.username.message)}</FieldError>
        </Field>
        {!isEditing && (
          <Field className="w-auto shrink-0">
            <FieldLabel htmlFor={fieldId("on-hold")}>{t("userDialog.onHold")}</FieldLabel>
            <Controller
              name="status"
              control={form.control}
              render={({ field }) => (
                <Switch
                  id={fieldId("on-hold")}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  checked={field.value === "on_hold"}
                  onCheckedChange={(checked) => field.onChange(checked ? "on_hold" : "active")}
                />
              )}
            />
          </Field>
        )}
      </div>
      <Controller
        control={form.control}
        name="data_limit"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={fieldId(field.name)}>{t("userDialog.dataLimit")}</FieldLabel>
            <div className="relative">
              <Input
                {...field}
                id={fieldId(field.name)}
                type="number"
                min={0}
                step="any"
                className="pe-12"
                value={field.value ?? ""}
                aria-invalid={fieldState.invalid}
                aria-describedby={`${fieldId("data-limit-description")}${fieldState.invalid ? ` ${fieldId("data-limit-error")}` : ""}`}
              />
              <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                GB
              </span>
            </div>
            <FieldDescription id={fieldId("data-limit-description")}>{t("userDialog.unlimitedHint", { defaultValue: "Leave empty for unlimited traffic." })}</FieldDescription>
            <FieldError id={fieldId("data-limit-error")}>{fieldState.error?.message && t(fieldState.error.message)}</FieldError>
          </Field>
        )}
      />
      {!!(dataLimit && dataLimit > 0) && (
        <Field>
          <FieldLabel htmlFor={fieldId("reset-strategy")}>{t("userDialog.periodicUsageReset")}</FieldLabel>
          <select
            id={fieldId("reset-strategy")}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            {...form.register("data_limit_reset_strategy")}
          >
            {resetStrategy.map((strategy) => (
              <option key={strategy.value} value={strategy.value}>
                {t("userDialog.resetStrategy" + strategy.title)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field
        data-invalid={
          !!(isOnHold ? form.formState.errors.on_hold_expire_duration : form.formState.errors.expire)
        }
      >
        <FieldLabel htmlFor={fieldId(isOnHold ? "on_hold_expire_duration" : "expire")}>
          {isOnHold ? t("userDialog.onHoldExpireDuration") : t("userDialog.expiryDate")}
        </FieldLabel>
        {isOnHold ? (
          <Controller
            control={form.control}
            name="on_hold_expire_duration"
            render={({ field, fieldState }) => (
              <>
                <div className="relative">
                  <Input
                    {...field}
                    id={fieldId(field.name)}
                    type="number"
                    min={0.1}
                    step="any"
                    className="pe-14"
                    value={field.value ?? ""}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.invalid ? fieldId("duration-error") : undefined}
                    onChange={(event) => {
                      form.setValue("expire", null);
                      field.onChange(event);
                    }}
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {t("userDialog.days")}
                  </span>
                </div>
                <FieldError id={fieldId("duration-error")}>{fieldState.error?.message && t(fieldState.error.message)}</FieldError>
              </>
            )}
          />
        ) : (
          <Controller
            name="expire"
            control={form.control}
            render={({ field, fieldState }) => {
              const { status, time } = relativeExpiryDate(field.value);
              return (
                <>
                  <div className="[&_.react-datepicker-wrapper]:w-full">
                    <ReactDatePicker
                      id={fieldId(field.name)}
                      name={field.name}
                      onBlur={field.onBlur}
                      locale={(language.startsWith("zh") ? "zh-cn" : language.split("-")[0])}
                      dateFormat={t("dateFormat")}
                      placeholderText={t("neverExpires", { defaultValue: "Never expires" })}
                      minDate={new Date()}
                      disabled={disabled}
                      isClearable={!disabled}
                      selected={field.value ? dayjs(field.value * 1000).toDate() : null}
                      onChange={(date: Date | null) => {
                        form.setValue("on_hold_expire_duration", null);
                        field.onChange(date ? dayjs(date).endOf("day").unix() : null);
                      }}
                      customInput={
                        <Input
                          ref={field.ref}
                          aria-invalid={fieldState.invalid}
                          aria-describedby={
                            fieldState.invalid
                              ? fieldId("expire-error")
                              : field.value
                                ? fieldId("expiry-description")
                                : undefined
                          }
                        />
                      }
                    />
                  </div>
                  {!!field.value && (
                    <FieldDescription id={fieldId("expiry-description")}>
                      {t(status, { time })}
                    </FieldDescription>
                  )}
                  <FieldError id={fieldId("expire-error")}>{fieldState.error?.message && t(fieldState.error.message)}</FieldError>
                </>
              );
            }}
          />
        )}
      </Field>
      <Field data-invalid={!!form.formState.errors.note}>
        <FieldLabel htmlFor={fieldId("note")}>{t("userDialog.note")}</FieldLabel>
        <Textarea
          id={fieldId("note")}
          rows={3}
          placeholder={t("userDialog.notePlaceholder", { defaultValue: "Optional notes about this user" })}
          aria-invalid={!!form.formState.errors.note}
          aria-describedby={form.formState.errors.note ? fieldId("note-error") : undefined}
          {...form.register("note")}
        />
        <FieldError id={fieldId("note-error")}>{form.formState.errors.note?.message && t(form.formState.errors.note.message)}</FieldError>
      </Field>
    </FieldSet>
  );
}
