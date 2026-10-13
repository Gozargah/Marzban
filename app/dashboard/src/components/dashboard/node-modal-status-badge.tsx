import { useTranslation } from "react-i18next";
import { AlertCircle, Ban, LoaderCircle, Wifi, type LucideIcon } from "lucide-react";
import { NodeType } from "@/contexts/nodes-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<NonNullable<NodeType["status"]>, { icon: LucideIcon; className: string }> = {
  connected: { icon: Wifi, className: "bg-success-soft text-success border-success-border" },
  connecting: { icon: LoaderCircle, className: "bg-warning-soft text-warning border-warning-border" },
  disabled: { icon: Ban, className: "bg-secondary text-muted-foreground" },
  error: { icon: AlertCircle, className: "bg-destructive/10 text-destructive" },
};

export function NodeModalStatusBadge({ status, compact = false, className }: {
  status: NonNullable<NodeType["status"]>;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const config = statusConfig[status] ?? statusConfig.error;
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={cn("gap-1.5 font-medium capitalize", config.className, compact ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs", className)}>
      <Icon aria-hidden="true" className={cn("size-3 shrink-0", status === "connecting" && "motion-safe:animate-spin")} />
      {t(`nodeModal.status.${status}`)}
    </Badge>
  );
}
