import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/features/shared/query-keys";
import { useInbounds } from "@/features/users/use-inbounds";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { toast } from "sonner";

// Multiplier applied to traffic used through this inbound (2 = 1 GB used counts as 2 GB).
export function InboundCoefficient({ tag, disabled }: { tag: string; disabled?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const client = useQueryClient();
  const { inbounds } = useInbounds();
  const current = [...inbounds.values()].flat().find((inbound) => inbound.tag === tag)?.usage_coefficient ?? 1;
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(String(current)), [current]);
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 && parsed <= 100;
  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/inbounds/${encodeURIComponent(tag)}/usage-coefficient`, {
        method: "PUT",
        body: { usage_coefficient: parsed },
        retry: 0,
      });
      await client.invalidateQueries({ queryKey: queryKeys.inbounds });
      toast.success(t("hostsDialog.usageCoefficientSaved", { defaultValue: "Usage ratio saved" }));
    } catch (error: any) {
      const detail = error?.response?._data?.detail;
      toast.error(
        typeof detail === "string"
          ? detail
          : t("hostsDialog.usageCoefficientError", { defaultValue: "Could not save the usage ratio" }),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {t("hostsDialog.usageCoefficient", { defaultValue: "Usage ratio" })}
      </label>
      <Input
        id={id}
        type="number"
        min={0.01}
        max={100}
        step="any"
        dir="ltr"
        value={value}
        disabled={disabled || saving}
        aria-invalid={!valid}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-20"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || saving || !valid || parsed === current}
        onClick={save}
      >
        {t("save", { defaultValue: "Save" })}
      </Button>
    </div>
  );
}
