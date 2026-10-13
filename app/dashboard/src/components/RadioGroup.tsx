import { shadowsocksMethods, XTLSFlows } from "constants/Proxies";
import { InboundType, ProtocolType, useDashboard } from "@/contexts/dashboard-context";
import { FC, forwardRef, useState } from "react";
import { ControllerRenderProps, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const InboundCard: FC<{
  inbound: InboundType;
  isChecked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}> = ({ inbound, isChecked, onToggle, disabled }) => {
  return (
    <label
      onClick={(e) => {
        if (disabled) return;
        e.preventDefault();
        onToggle();
      }}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border p-2 text-xs transition-colors cursor-pointer select-none",
        isChecked
          ? "border-primary/50 bg-primary/5 text-foreground font-medium"
          : "border-border bg-card/50 text-muted-foreground hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Checkbox
          checked={isChecked}
          disabled={disabled}
          onCheckedChange={onToggle}
          className="pointer-events-none"
        />
        <span className="truncate uppercase font-medium">
          {inbound.tag} <span className="normal-case text-muted-foreground">({inbound.network})</span>
        </span>
      </div>
      {inbound.tls && inbound.tls !== "none" && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase shrink-0">
          {inbound.tls}
        </Badge>
      )}
    </label>
  );
};

const RadioCard: FC<{
  title: string;
  description: string;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  disabled?: boolean;
}> = ({
  title,
  description,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  disabled,
}) => {
    const form = useFormContext();
    const inbounds = useDashboard((state) => state.inbounds);
    const { t } = useTranslation();

    const [inBoundDefaultValue] = useWatch({
      name: [`inbounds.${title}`],
      control: form.control,
    });

    const availableInbounds = inbounds.get(title as ProtocolType) || [];
    const protocolHasInbound = availableInbounds.length > 0;
    const shouldBeDisabled = disabled || (!isSelected && !protocolHasInbound);

    const selectedInbounds: string[] = Array.isArray(inBoundDefaultValue) ? inBoundDefaultValue : [];
    const isPartialSelected =
      isSelected &&
      selectedInbounds.length > 0 &&
      selectedInbounds.length < availableInbounds.length;

    const handleInboundToggle = (tag: string) => {
      let newInbounds: string[];
      if (selectedInbounds.includes(tag)) {
        newInbounds = selectedInbounds.filter((t) => t !== tag);
      } else {
        newInbounds = [...selectedInbounds, tag];
      }
      form.setValue(`inbounds.${title}`, newInbounds);

      if (newInbounds.length === 0) {
        const selected_proxies: string[] = form.getValues("selected_proxies") || [];
        form.setValue(
          "selected_proxies",
          selected_proxies.filter((p: string) => p !== title)
        );
        if (isExpanded) onToggleExpand();
      }
    };

    return (
      <div
        className={cn(
          "rounded-lg border transition-all overflow-hidden",
          isSelected
            ? "border-primary/50 bg-card shadow-xs"
            : "border-border bg-card/60 hover:bg-card",
          shouldBeDisabled && "opacity-50 pointer-events-none"
        )}
      >
        {/* Protocol header */}
        <div className="relative flex items-center justify-between p-3 select-none">
          {isPartialSelected && (
            <span
              className="absolute top-2 start-2 size-1.5 rounded-full bg-amber-500"
              title="Partially selected"
            />
          )}
          <label
            onClick={(e) => {
              if (shouldBeDisabled) return;
              e.preventDefault();
              onToggleSelect();
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          >
            <Checkbox
              checked={isSelected}
              disabled={shouldBeDisabled}
              onCheckedChange={onToggleSelect}
              className="pointer-events-none"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold capitalize text-foreground leading-tight">
                {title}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {description}
              </span>
            </div>
          </label>

          {isSelected && protocolHasInbound && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`${title} settings`}
              className={cn(
                "size-7 text-muted-foreground hover:text-foreground transition-transform",
                isExpanded && "bg-muted text-foreground rotate-90"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              <Settings2 className="size-4" />
            </Button>
          )}
        </div>

        {/* Accordion settings panel */}
        {isSelected && isExpanded && (
          <div className="border-t border-border/80 bg-muted/20 p-3 space-y-3 animate-in fade-in-0 duration-150">
            {/* Inbound selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                {t("inbound")}
              </Label>
              <div className="grid grid-cols-1 gap-1.5">
                {availableInbounds.map((inbound) => (
                  <InboundCard
                    key={inbound.tag}
                    inbound={inbound}
                    isChecked={selectedInbounds.includes(inbound.tag)}
                    onToggle={() => handleInboundToggle(inbound.tag)}
                  />
                ))}
              </div>
            </div>

            {/* Protocol-specific proxy parameters */}
            {title === "vmess" && (
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">ID</Label>
                <Input
                  placeholder={t("userDialog.generatedByDefault")}
                  className="h-8 text-xs font-mono"
                  {...form.register("proxies.vmess.id")}
                />
              </div>
            )}

            {title === "vless" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">ID</Label>
                  <Input
                    placeholder={t("userDialog.generatedByDefault")}
                    className="h-8 text-xs font-mono"
                    {...form.register("proxies.vless.id")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Flow</Label>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer"
                    {...form.register("proxies.vless.flow")}
                  >
                    {XTLSFlows.map((entry) => (
                      <option key={entry.title} value={entry.value}>
                        {entry.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {title === "trojan" && (
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("password")}
                </Label>
                <Input
                  placeholder={t("userDialog.generatedByDefault")}
                  className="h-8 text-xs font-mono"
                  {...form.register("proxies.trojan.password")}
                />
              </div>
            )}

            {title === "shadowsocks" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("password")}
                  </Label>
                  <Input
                    placeholder={t("userDialog.generatedByDefault")}
                    className="h-8 text-xs font-mono"
                    {...form.register("proxies.shadowsocks.password")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("userDialog.method")}
                  </Label>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer"
                    {...form.register("proxies.shadowsocks.method")}
                  >
                    {shadowsocksMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

export type RadioListType = {
  title: string;
  description: string;
};

export type RadioGroupProps = ControllerRenderProps & {
  list: RadioListType[];
  disabled?: boolean;
};

export const RadioGroup = forwardRef<any, RadioGroupProps>(
  ({ name, list, onChange, disabled, value }, ref) => {
    const form = useFormContext();
    const [expandedAccordions, setExpandedAccordions] = useState<string[]>([]);
    const selectedValues: string[] = Array.isArray(value) ? value : [];

    const toggleAccordion = (title: string) => {
      setExpandedAccordions((prev) =>
        prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
      );
    };

    const handleToggleSelect = (title: string) => {
      let nextValue: string[];
      if (selectedValues.includes(title)) {
        nextValue = selectedValues.filter((v) => v !== title);
        setExpandedAccordions((prev) => prev.filter((t) => t !== title));
      } else {
        nextValue = [...selectedValues, title];
        // Activate all inbounds for this protocol
        const defaultInbounds =
          useDashboard.getState().inbounds.get(title as ProtocolType) || [];
        form.setValue(
          `inbounds.${title}`,
          defaultInbounds.map((i) => i.tag)
        );
      }
      onChange({
        target: {
          value: nextValue,
          name,
        },
      });
    };

    return (
      <div ref={ref} className="grid grid-cols-1 gap-2.5">
        {list.map((item) => (
          <RadioCard
            key={item.title}
            title={item.title}
            description={item.description}
            isSelected={selectedValues.includes(item.title)}
            isExpanded={expandedAccordions.includes(item.title)}
            onToggleSelect={() => handleToggleSelect(item.title)}
            onToggleExpand={() => toggleAccordion(item.title)}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }
);
RadioGroup.displayName = "RadioGroup";
