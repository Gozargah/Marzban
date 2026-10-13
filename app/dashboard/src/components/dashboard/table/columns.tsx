import { createColumnHelper, tableFeatures } from "@tanstack/react-table";
import { FC, useEffect, useState } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import { useTranslation } from "react-i18next";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Filter,
  Link2,
  Pencil,
  QrCode,
} from "lucide-react";

import { OnlineBadge } from "@/components/OnlineBadge";
import { OnlineStatus } from "@/components/OnlineStatus";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { resetStrategy } from "constants/UserSettings";
import { useDashboard } from "contexts/DashboardContext";
import { User } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { formatBytes } from "utils/formatByte";

export const features = tableFeatures({});
const helper = createColumnHelper<typeof features, User>();

export type SortType = {
  sort: string;
  column: string;
};

export const Sort: FC<SortType> = ({ sort, column }) => {
  if (sort === column) {
    return <ChevronUp className="size-3.5 shrink-0 text-primary" />;
  }
  if (sort === `-${column}`) {
    return <ChevronDown className="size-3.5 shrink-0 text-primary" />;
  }
  return <ArrowUpDown className="size-3 shrink-0 opacity-40" />;
};

export const getResetStrategy = (strategy?: string | null): string => {
  if (!strategy || strategy === "no_reset") return "";
  const entry = resetStrategy.find((r) => r.value === strategy);
  return entry ? entry.title : "";
};

export type UsageSliderProps = {
  used: number;
  total: number | null;
  dataLimitResetStrategy?: string | null;
  totalUsedTraffic: number;
  className?: string;
};

export const UsageSliderCompact: FC<UsageSliderProps> = ({ used, total, className }) => {
  const isUnlimited = total === 0 || total === null;
  return (
    <div className={cn("text-xs font-medium text-muted-foreground whitespace-nowrap", className)}>
      <span className="font-semibold text-foreground">{formatBytes(used)}</span>
      <span className="mx-1 text-muted-foreground/60">/</span>
      <span>{isUnlimited ? "∞" : formatBytes(total)}</span>
    </div>
  );
};

export const UsageSlider: FC<UsageSliderProps> = ({
  used,
  total,
  dataLimitResetStrategy,
  totalUsedTraffic,
  className,
}) => {
  const { t } = useTranslation();
  const isUnlimited = total === 0 || total === null;
  const percent = isUnlimited ? 100 : Math.min((used / (total || 1)) * 100, 100);
  const isReached = !isUnlimited && (used / (total || 1)) * 100 >= 100;
  const isWarning = !isUnlimited && percent >= 85 && !isReached;
  const resetTitle = getResetStrategy(dataLimitResetStrategy);
  const resetLabel = resetTitle
    ? t(`userDialog.resetStrategy${resetTitle}`, { defaultValue: resetTitle })
    : "";

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      <div className="flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-foreground">
            {formatBytes(used)}
          </span>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-muted-foreground">
            {isUnlimited ? "∞" : formatBytes(total)}
          </span>
          {resetLabel && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground"
            >
              {resetLabel}
            </Badge>
          )}
        </div>
        {!isUnlimited && (
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums shrink-0",
              isReached
                ? "text-destructive"
                : isWarning
                ? "text-amber-500"
                : "text-muted-foreground"
            )}
          >
            {percent.toFixed(0)}%
          </span>
        )}
      </div>

      <Progress
        value={percent}
        className="h-1.5 w-full bg-secondary"
        indicatorClassName={
          isReached
            ? "bg-destructive"
            : isWarning
            ? "bg-amber-500"
            : "bg-primary"
        }
      />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {t("usersTable.total")}:{" "}
          <span className="tabular-nums font-medium text-foreground/80">
            {formatBytes(totalUsedTraffic)}
          </span>
        </span>
      </div>
    </div>
  );
};

export function ExpiryInfo({
  expire,
  status,
  onHoldDuration,
  className,
}: {
  expire?: number | null;
  status?: string;
  onHoldDuration?: number | null;
  className?: string;
}) {
  const { t } = useTranslation();

  if (status === "on_hold" && onHoldDuration) {
    const days = Math.round(onHoldDuration / 86400);
    return (
      <span className={cn("text-[11px] text-muted-foreground flex items-center gap-1", className)}>
        <Clock className="size-3 shrink-0 opacity-70" />
        <span>{days} {t("days", { defaultValue: "days" })} ({t("on_hold", { defaultValue: "on hold" })})</span>
      </span>
    );
  }

  if (!expire) {
    return (
      <span className={cn("text-[11px] text-muted-foreground", className)}>
        {t("neverExpires", { defaultValue: "Never expires" })}
      </span>
    );
  }

  const dateInfo = relativeExpiryDate(expire);
  const isExpired = dateInfo.status === "expired";

  return (
    <span
      className={cn(
        "text-[11px] flex items-center gap-1 whitespace-nowrap",
        isExpired ? "text-destructive font-medium" : "text-muted-foreground",
        className
      )}
    >
      <Clock className="size-3 shrink-0 opacity-70" />
      <span>{t(dateInfo.status, { time: dateInfo.time })}</span>
    </span>
  );
}

export type ActionButtonsProps = {
  user: User;
  className?: string;
};

export const ActionButtons: FC<ActionButtonsProps> = ({ user, className }) => {
  const { setQRCode, setSubLink, onEditingUser } = useDashboard();
  const { t } = useTranslation();
  const proxyLinks = user.links.join("\r\n");
  const subUrl = user.subscription_url.startsWith("/")
    ? window.location.origin + user.subscription_url
    : user.subscription_url;

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (copiedIndex !== null) {
      const timer = setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [copiedIndex]);

  const copy = (text: string, index: number) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedIndex(index);
  };

  return (
    <div
      className={cn("flex items-center justify-end gap-1", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <CopyToClipboard text={subUrl} onCopy={() => setCopiedIndex(0)}>
        <SimpleTooltip
          label={copiedIndex === 0 ? t("usersTable.copied") : t("usersTable.copyLink")}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("usersTable.copyLink")}
            title={copiedIndex === 0 ? t("usersTable.copied") : t("usersTable.copyLink")}
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              copy(subUrl, 0);
            }}
          >
            {copiedIndex === 0 ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <Link2 className="size-4" />
            )}
          </Button>
        </SimpleTooltip>
      </CopyToClipboard>

      <CopyToClipboard text={proxyLinks} onCopy={() => setCopiedIndex(1)}>
        <SimpleTooltip
          label={copiedIndex === 1 ? t("usersTable.copied") : t("usersTable.copyConfigs")}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("usersTable.copyConfigs")}
            title={copiedIndex === 1 ? t("usersTable.copied") : t("usersTable.copyConfigs")}
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              copy(proxyLinks, 1);
            }}
          >
            {copiedIndex === 1 ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </SimpleTooltip>
      </CopyToClipboard>

      <SimpleTooltip label="QR Code">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="QR Code"
          title="QR Code"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setQRCode(user.links);
            setSubLink(user.subscription_url);
          }}
        >
          <QrCode className="size-4" />
        </Button>
      </SimpleTooltip>

      <SimpleTooltip label={t("userDialog.editUser", { defaultValue: "Edit user" })}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("userDialog.editUser", { defaultValue: "Edit user" })}
          title={t("userDialog.editUser", { defaultValue: "Edit user" })}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onEditingUser(user);
          }}
        >
          <Pencil className="size-4" />
        </Button>
      </SimpleTooltip>
    </div>
  );
};

export function UsernameHeader() {
  const { filters, onFilterChange } = useDashboard();
  const { t } = useTranslation();

  const handleSort = () => {
    let newSort = filters.sort;
    if (newSort.includes("username")) {
      newSort = newSort.startsWith("-") ? "-created_at" : "-username";
    } else {
      newSort = "username";
    }
    onFilterChange({ sort: newSort });
  };

  const isActive = filters.sort.includes("username");

  return (
    <button
      type="button"
      onClick={handleSort}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider rounded-md px-1.5 py-1 transition-colors cursor-pointer select-none",
        isActive
          ? "text-primary font-bold bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <span>{t("username")}</span>
      <Sort sort={filters.sort} column="username" />
    </button>
  );
}

export function StatusHeader() {
  const { filters, onFilterChange } = useDashboard();
  const { t } = useTranslation();

  const handleSort = () => {
    let newSort = filters.sort;
    if (newSort.includes("expire")) {
      newSort = newSort.startsWith("-") ? "-created_at" : "-expire";
    } else {
      newSort = "expire";
    }
    onFilterChange({ sort: newSort });
  };

  const handleStatusFilter = (status?: string) => {
    onFilterChange({
      status: status && status.length > 0 ? (status as any) : undefined,
    });
  };

  const hasFilter = Boolean(filters.status);

  return (
    <div className="flex items-center gap-2 select-none">
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider rounded-md px-2 py-1 transition-colors outline-none cursor-pointer",
            hasFilter
              ? "bg-primary/10 text-primary hover:bg-primary/20 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Filter className="size-3" />
          <span>
            {t("usersTable.status")}
            {filters.status ? `: ${t(`status.${filters.status}`, { defaultValue: filters.status })}` : ""}
          </span>
          <ChevronDown className="size-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-36">
          <DropdownMenuItem onClick={() => handleStatusFilter("")}>
            {t("all", { defaultValue: "All" })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(["active", "on_hold", "disabled", "limited", "expired"] as const).map((st) => (
            <DropdownMenuItem
              key={st}
              onClick={() => handleStatusFilter(st)}
              className={cn("capitalize gap-2", filters.status === st && "font-semibold bg-accent")}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  st === "active" && "bg-emerald-500",
                  st === "on_hold" && "bg-purple-500",
                  st === "disabled" && "bg-neutral-400",
                  st === "limited" && "bg-destructive",
                  st === "expired" && "bg-amber-500"
                )}
              />
              <span>{t(`status.${st}`, { defaultValue: st })}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-muted-foreground/40">|</span>

      <button
        type="button"
        onClick={handleSort}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold rounded-md px-1.5 py-1 transition-colors cursor-pointer",
          filters.sort.includes("expire")
            ? "text-primary font-bold bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <span>{t("expire", { defaultValue: "Expiry" })}</span>
        <Sort sort={filters.sort} column="expire" />
      </button>
    </div>
  );
}

export function DataUsageHeader() {
  const { filters, onFilterChange } = useDashboard();
  const { t } = useTranslation();

  const handleSort = () => {
    let newSort = filters.sort;
    if (newSort.includes("used_traffic")) {
      newSort = newSort.startsWith("-") ? "-created_at" : "-used_traffic";
    } else {
      newSort = "used_traffic";
    }
    onFilterChange({ sort: newSort });
  };

  const isActive = filters.sort.includes("used_traffic");

  return (
    <button
      type="button"
      onClick={handleSort}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider rounded-md px-1.5 py-1 transition-colors cursor-pointer select-none",
        isActive
          ? "text-primary font-bold bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <span>{t("usersTable.dataUsage")}</span>
      <Sort sort={filters.sort} column="used_traffic" />
    </button>
  );
}

export const columns = helper.columns([
  helper.accessor("username", {
    header: () => <UsernameHeader />,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-2.5 py-1">
          <OnlineBadge lastOnline={user.online_at} className="shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground text-sm truncate leading-tight">
              {user.username}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <OnlineStatus lastOnline={user.online_at} className="m-0 text-[11px]" />
              {user.note && (
                <span
                  className="text-[11px] text-muted-foreground/70 truncate max-w-[140px]"
                  title={user.note}
                >
                  • {user.note}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    },
  }),
  helper.display({
    id: "status",
    header: () => <StatusHeader />,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex flex-col gap-1 py-1">
          <StatusBadge expiryDate={user.expire} status={user.status} showDetail={true} />
          <ExpiryInfo
            expire={user.expire}
            status={user.status}
            onHoldDuration={user.on_hold_expire_duration}
          />
        </div>
      );
    },
  }),
  helper.accessor("used_traffic", {
    header: () => <DataUsageHeader />,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="py-1">
          <UsageSlider
            used={user.used_traffic}
            total={user.data_limit}
            dataLimitResetStrategy={user.data_limit_reset_strategy}
            totalUsedTraffic={user.lifetime_used_traffic}
          />
        </div>
      );
    },
  }),
  helper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex justify-end py-1">
          <ActionButtons user={user} />
        </div>
      );
    },
  }),
]);
