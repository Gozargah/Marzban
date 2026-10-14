import { useUsersQuery } from "@/features/users/queries";
import { ChangeEvent, FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination as ShadcnPagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/contexts/dashboard-context";
import { setUsersPerPageLimitSize } from "utils/userPreferenceStorage";

export type PaginationType = {
  count?: number; perPage?: number; page?: number;
  onChange?: (page: number) => void; className?: string;
};

function generatePageItems(total: number, current: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const left = Math.max(0, Math.min(total - 7, current - 3));
  const items: (string | number)[] = Array.from({ length: 7 }, (_, i) => i + left);
  if (left > 0) { items[0] = 0; items[1] = "prev-more"; }
  if (left + 7 < total) { items[6] = total - 1; items[5] = "next-more"; }
  return items;
}

export const Pagination: FC<{ className?: string }> = ({ className }) => {
  const { users: { total }, loading, usersError, isPlaceholderData } = useUsersQuery();
  const filters = useDashboard((state) => state.filters);
  const onFilterChange = useDashboard((state) => state.onFilterChange);
  const { t } = useTranslation();
  const perPage = filters.limit || 10;
  const offset = filters.offset || 0;
  const noPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.floor(offset / perPage), noPages - 1);

  // Keep the last page usable when deleting its final user or reducing results.
  useEffect(() => {
    if (!loading && !usersError && !isPlaceholderData && offset > 0 && offset >= total) {
      onFilterChange({ offset: Math.max(0, Math.ceil(total / perPage) - 1) * perPage });
    }
  }, [loading, usersError, isPlaceholderData, offset, total, perPage, onFilterChange]);

  const changePage = (page: number) => {
    if (loading || page < 0 || page >= noPages || page === currentPage) return;
    onFilterChange({ offset: page * perPage });
  };
  const changePageSize = (event: ChangeEvent<HTMLSelectElement>) => {
    const limit = Number(event.target.value);
    onFilterChange({ limit, offset: 0 });
    setUsersPerPageLimitSize(String(limit));
  };

  return (
    <div className={cn("flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">
          <select value={perPage} onChange={changePageSize} disabled={loading}
            className="h-8 rounded-none border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50">
            {[10, 20, 30, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>{t("itemsPerPage")}</span>
        </label>
        <span dir="ltr" className="tabular-nums">{total === 0 ? 0 : Math.min(offset + 1, total)}–{Math.min(offset + perPage, total)} / {total}</span>
      </div>
      <ShadcnPagination className="mx-0 w-auto">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <Button variant="ghost" size="icon" aria-label={t("previous")} disabled={loading || currentPage === 0 || total === 0} onClick={() => changePage(currentPage - 1)}>
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
          </PaginationItem>
          {generatePageItems(noPages, currentPage).map((page) => typeof page === "string" ? (
            <PaginationItem key={page} className="hidden sm:block"><PaginationEllipsis /></PaginationItem>
          ) : (
            <PaginationItem key={page} className={cn(page !== currentPage && "hidden sm:block")}>
              <Button variant={page === currentPage ? "outline" : "ghost"} size="icon" disabled={loading}
                aria-current={page === currentPage ? "page" : undefined} aria-label={t("usersTable.pageLabel", { page: page + 1 })} onClick={() => changePage(page)}>{page + 1}</Button>
            </PaginationItem>
          ))}
          <PaginationItem>
            <Button variant="ghost" size="icon" aria-label={t("next")} disabled={loading || currentPage + 1 >= noPages || total === 0} onClick={() => changePage(currentPage + 1)}>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </ShadcnPagination>
    </div>
  );
};
