import { useUsersQuery } from "@/features/users/queries";
import { useTable } from "@tanstack/react-table";
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Filter,
  RotateCcw,
} from "lucide-react";
import AddFileIcon from "assets/add_file.svg?react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/contexts/dashboard-context";
import {
  ActionButtons,
  columns,
  ExpiryInfo,
  features,
  getResetStrategy,
  Sort,
  UsageSlider,
} from "./columns";

export type UsersTableProps = React.ComponentProps<"div">;

function EmptySection({
  isFiltered,
  onResetFilters,
}: {
  isFiltered: boolean;
  onResetFilters?: () => void;
}) {
  const onCreateUser = useDashboard((state) => state.onCreateUser);
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
  const { users: { users }, loading, usersError } = useUsersQuery();
  const filters = useDashboard((state) => state.filters);
  const onEditingUser = useDashboard((state) => state.onEditingUser);
  const onFilterChange = useDashboard((state) => state.onFilterChange);

  const { t } = useTranslation();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const isFiltered = Boolean(
    filters.search ||
    filters.status
  );

  const handleSort = (column: string) => {
    let newSort = filters.sort;
    if (newSort === column || newSort === `-${column}`) {
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
      offset: 0,
    });
  };

  const handleStatusFilter = (status?: string) => {
    onFilterChange({
      status: status && status.length > 0 ? (status as "active" | "disabled" | "limited" | "expired" | "on_hold") : undefined,
      offset: 0,
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
    });
  };

  const table = useTable({
    features,
    columns,
    data: users,
  });

  return (
    <div aria-busy={loading} id="users-table" className={cn("w-full space-y-4", className)} {...props}>
      <span role="status" className="sr-only">{loading ? t("loading", { defaultValue: "Loading" }) : ""}</span>
      {loading && users.length === 0 ? (
        <div className="border border-border bg-card p-4 space-y-6" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex gap-6 motion-safe:animate-pulse">
            <div className="h-10 w-1/3 bg-muted" /><div className="h-10 w-1/4 bg-muted" /><div className="h-10 flex-1 bg-muted" />
          </div>)}
        </div>
      ) : usersError && users.length === 0 ? null : <>
      {/* Mobile list */}
      <div className="block md:hidden space-y-3">
        {/* Mobile toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-1.5 rounded-none border border-border bg-card px-3 py-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleSort("username")}
            className={cn(
              "inline-flex items-center gap-1 rounded-none px-2 py-1 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring",
              filters.sort.includes("username")
                ? "bg-primary/10 text-foreground font-bold"
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
                "inline-flex items-center gap-1 rounded-none px-2 py-1 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                filters.status
                  ? "bg-primary/10 text-foreground font-bold"
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
                      st === "active" && "bg-success",
                      st === "on_hold" && "bg-purple-500",
                      st === "disabled" && "bg-neutral-400",
                      st === "limited" && "bg-destructive",
                      st === "expired" && "bg-warning"
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
              "inline-flex items-center gap-1 rounded-none px-2 py-1 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring",
              filters.sort.includes("used_traffic")
                ? "bg-primary/10 text-foreground font-bold"
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
              const resetTitle = getResetStrategy(user.data_limit_reset_strategy);

              return (
                <div
                  key={user.username}
                  className="rounded-none border border-border bg-card p-3 transition-colors hover:border-border/80"
                >
                  {/* Card header (tap to toggle) */}
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? `user-details-${user.username}` : undefined}
                    className="w-full text-start cursor-pointer select-none space-y-2.5 outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={() => toggleRow(user.username)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <OnlineBadge lastOnline={user.online_at} className="shrink-0" />
                        <span className="font-semibold text-sm text-foreground truncate">
                          {user.username}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge
                          compact
                          showDetail={true}
                          status={user.status}
                        />
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </span>
                    </span>

                  </button>
                  <div className="mt-3">
                    <UsageSlider used={user.used_traffic} total={user.data_limit} totalUsedTraffic={user.lifetime_used_traffic} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                    <ExpiryInfo className="whitespace-normal" expire={user.expire} status={user.status} onHoldDuration={user.on_hold_expire_duration} />
                    <ActionButtons user={user} />
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div id={`user-details-${user.username}`} className="mt-3 pt-3 border-t border-border/60 space-y-3 animate-in fade-in-0 duration-150">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {t("lastOnline", { defaultValue: "Last online" })}:
                          </span>
                          <div>
                            <OnlineStatus lastOnline={user.online_at} className="m-0 font-medium" />
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
                        <div className="rounded-none bg-muted/40 p-2 text-xs text-muted-foreground">
                          <span className="font-semibold">{t("note", { defaultValue: "Note" })}:</span>{" "}
                          {user.note}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-none border border-border bg-card p-6">
            <EmptySection isFiltered={isFiltered} onResetFilters={resetFilters} />
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-none border border-border bg-card overflow-hidden">
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
                      aria-sort={filters.sort === (isStatus ? "expire" : header.id) ? "ascending" : filters.sort === `-${isStatus ? "expire" : header.id}` ? "descending" : undefined}
                      className={cn(
                        "bg-muted/50 font-semibold py-3 border-b border-border",
                        isUsername && "w-[25%] min-w-[180px]",
                        isStatus && "w-[25%] min-w-[170px]",
                        isUsage && "w-[28%] min-w-[210px]",
                        isActions && "w-[22%] min-w-[160px] text-end"
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
                  className="cursor-pointer hover:bg-muted/30 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                  aria-label={t("usersTable.editUser", { defaultValue: "Edit {{username}}", username: row.original.username })}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault(); onEditingUser(row.original);
                    }
                  }}
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

      </>}
      <Pagination />
    </div>
  );
};
