import { useTable } from "@tanstack/react-table";
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Filter,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { ReactComponent as AddFileIcon } from "assets/add_file.svg";
import { OnlineBadge } from "@/components/dashboard/table/online-badge";
import { OnlineStatus } from "@/components/dashboard/table/online-status";
import { Pagination } from "@/components/dashboard/table/users-pagination";
import { StatusBadge } from "@/components/dashboard/table/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useDashboard } from "contexts/DashboardContext";
import { formatBytes } from "utils/formatByte";
import {
  ActionButtons,
  columns,
  ExpiryInfo,
  features,
  getResetStrategy,
  Sort,
} from "./columns";

export type UsersTableProps = React.ComponentProps<"div">;

function EmptySection({
  isFiltered,
  onResetFilters,
}: {
  isFiltered: boolean;
  onResetFilters?: () => void;
}) {
  const { onCreateUser } = useDashboard();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center w-full">
      <AddFileIcon className="max-h-40 max-w-40 text-muted-foreground/60" />
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {isFiltered ? t("usersTable.noUserMatched") : t("usersTable.noUser")}
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          {isFiltered
            ? t("usersTable.noUserMatchedHint", {
              defaultValue: "Try adjusting your search or filters to find what you're looking for.",
            })
            : t("usersTable.noUserHint", {
              defaultValue: "Get started by adding your first VPN user.",
            })}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        {isFiltered ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onResetFilters}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>{t("resetFilters", { defaultValue: "Clear filters" })}</span>
          </Button>
        ) : (
          <Button size="sm" onClick={() => onCreateUser(true)}>
            {t("createUser")}
          </Button>
        )}
      </div>
    </div>
  );
}

export const UsersTable: FC<UsersTableProps> = ({ className, ...props }) => {
  const {
    filters,
    users: { users },
    users: totalUsers,
    onEditingUser,
    onFilterChange,
  } = useDashboard();

  const { t } = useTranslation();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const isFiltered = Boolean(
    filters.search ||
    filters.status ||
    (users.length !== totalUsers.total && totalUsers.total > 0)
  );

  const handleSort = (column: string) => {
    let newSort = filters.sort;
    if (newSort.includes(column)) {
      if (newSort.startsWith("-")) {
        newSort = "-created_at";
      } else {
        newSort = "-" + column;
      }
    } else {
      newSort = column;
    }
    onFilterChange({
      sort: newSort,
    });
  };

  const handleStatusFilter = (status?: string) => {
    onFilterChange({
      status: status && status.length > 0 ? (status as any) : undefined,
    });
  };

  const toggleRow = (username: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [username]: !prev[username],
    }));
  };

  const resetFilters = () => {
    onFilterChange({
      search: "",
      status: undefined,
      offset: 0,
      sort: "-created_at",
    });
  };

  const table = useTable({
    features,
    columns,
    data: users,
  });

  return (
    <div id="users-table" className={cn("w-full space-y-4", className)} {...props}>
      {/* Mobile view: Modern Card List */}
      <div className="block md:hidden space-y-3">
        {/* Mobile toolbar */}
        <div className="flex items-center justify-between gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold shadow-xs">
          <button
            type="button"
            onClick={() => handleSort("username")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors cursor-pointer",
              filters.sort.includes("username")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{t("users")}</span>
            <Sort sort={filters.sort} column="username" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 uppercase tracking-wider transition-colors outline-none cursor-pointer",
                filters.status
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="size-3" />
              <span>
                {t("usersTable.status")}
                {filters.status ? `: ${t(`status.${filters.status}`, { defaultValue: filters.status })}` : ""}
              </span>
              <ChevronDown className="size-3 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-36">
              <DropdownMenuItem onClick={() => handleStatusFilter("")}>
                {t("all", { defaultValue: "All" })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {(["active", "on_hold", "disabled", "limited", "expired"] as const).map((st) => (
                <DropdownMenuItem
                  key={st}
                  onClick={() => handleStatusFilter(st)}
                  className="capitalize gap-2"
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

          <button
            type="button"
            onClick={() => handleSort("used_traffic")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors cursor-pointer",
              filters.sort.includes("used_traffic")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{t("usersTable.dataUsage")}</span>
            <Sort sort={filters.sort} column="used_traffic" />
          </button>
        </div>

        {/* User cards */}
        {users.length > 0 ? (
          <div className="space-y-2.5">
            {users.map((user) => {
              const isExpanded = Boolean(expandedRows[user.username]);
              const isUnlimited = user.data_limit === 0 || user.data_limit === null;
              const percent = isUnlimited
                ? 100
                : Math.min((user.used_traffic / (user.data_limit || 1)) * 100, 100);
              const isReached = !isUnlimited && (user.used_traffic / (user.data_limit || 1)) * 100 >= 100;
              const isWarning = !isUnlimited && percent >= 85 && !isReached;
              const resetTitle = getResetStrategy(user.data_limit_reset_strategy);

              return (
                <div
                  key={user.username}
                  className="rounded-xl border border-border bg-card p-3 shadow-xs transition-colors hover:border-border/80"
                >
                  {/* Card header (tap to toggle) */}
                  <div
                    className="cursor-pointer select-none space-y-2.5"
                    onClick={() => toggleRow(user.username)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <OnlineBadge lastOnline={user.online_at} className="shrink-0" />
                        <span className="font-semibold text-sm text-foreground truncate">
                          {user.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge
                          compact
                          showDetail={true}
                          expiryDate={user.expire}
                          status={user.status}
                        />
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </div>
                    </div>

                    {/* Bandwidth summary bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {formatBytes(user.used_traffic)}
                          </span>
                          <span>/</span>
                          <span>{isUnlimited ? "∞" : formatBytes(user.data_limit || 0)}</span>
                        </div>
                        {!isUnlimited && (
                          <span
                            className={cn(
                              "text-[11px] font-semibold tabular-nums",
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
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-3 animate-in fade-in-0 duration-150">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {t("lastOnline", { defaultValue: "Last online" })}:
                          </span>
                          <div>
                            <OnlineStatus lastOnline={user.online_at} className="m-0 font-medium" />
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {t("expiration", { defaultValue: "Expiration" })}:
                          </span>
                          <div>
                            <ExpiryInfo
                              expire={user.expire}
                              status={user.status}
                              onHoldDuration={user.on_hold_expire_duration}
                            />
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {t("usersTable.total")}:
                          </span>
                          <div className="font-medium tabular-nums text-foreground">
                            {formatBytes(user.lifetime_used_traffic)}
                          </div>
                        </div>

                        {resetTitle && (
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              {t("resetStrategy", { defaultValue: "Reset cycle" })}:
                            </span>
                            <div className="font-medium text-foreground">
                              {t(`userDialog.resetStrategy${resetTitle}`, {
                                defaultValue: resetTitle,
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {user.note && (
                        <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                          <span className="font-semibold">{t("note", { defaultValue: "Note" })}:</span>{" "}
                          {user.note}
                        </div>
                      )}

                      {/* Action buttons toolbar */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8 text-xs font-medium"
                          onClick={() => onEditingUser(user)}
                        >
                          <Pencil className="size-3.5" />
                          <span>{t("edit", { defaultValue: "Edit" })}</span>
                        </Button>

                        <ActionButtons user={user} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <EmptySection isFiltered={isFiltered} onResetFilters={resetFilters} />
          </div>
        )}
      </div>

      {/* Desktop view: Professional Data Table */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-border">
                {headerGroup.headers.map((header) => {
                  const isActions = header.id === "actions";
                  const isUsername = header.id === "username";
                  const isStatus = header.id === "status";
                  const isUsage = header.id === "used_traffic";

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "bg-muted/50 font-semibold py-3 border-b border-border",
                        isUsername && "w-[26%] min-w-[190px]",
                        isStatus && "w-[30%] min-w-[220px]",
                        isUsage && "w-[30%] min-w-[220px]",
                        isActions && "w-[14%] min-w-[140px] text-end"
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors group"
                  onClick={() => onEditingUser(row.original)}
                >
                  {row.getAllCells().map((cell) => {
                    const isActions = cell.column.id === "actions";
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn("py-3", isActions && "text-end")}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64">
                  <EmptySection isFiltered={isFiltered} onResetFilters={resetFilters} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination />
    </div>
  );
};
