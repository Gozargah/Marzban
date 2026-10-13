import { ChangeEvent, FC } from "react";
import { useTranslation } from "react-i18next";
import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/contexts/dashboard-context";
import { setUsersPerPageLimitSize } from "utils/userPreferenceStorage";

export type PaginationType = {
  count?: number;
  perPage?: number;
  page?: number;
  onChange?: (page: number) => void;
  className?: string;
};

const MINIMAL_PAGE_ITEM_COUNT = 5;

function generatePageItems(total: number, current: number, width: number = 7) {
  if (total <= 0) return [0];
  if (width < MINIMAL_PAGE_ITEM_COUNT) width = MINIMAL_PAGE_ITEM_COUNT;
  if (total <= width) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const left = Math.max(
    0,
    Math.min(total - width, current - Math.floor(width / 2))
  );
  const items: (string | number)[] = Array.from({ length: width }, (_, i) => i + left);

  if (Number(items[0]) > 0) {
    items[0] = 0;
    items[1] = "prev-more";
  }
  if (Number(items[items.length - 1]) < total - 1) {
    items[items.length - 1] = total - 1;
    items[items.length - 2] = "next-more";
  }
  return items;
}

export const Pagination: FC<{ className?: string }> = ({ className }) => {
  const filters = useDashboard((state) => state.filters);
  const onFilterChange = useDashboard((state) => state.onFilterChange);
  const total = useDashboard((state) => state.users.total);
  const { t } = useTranslation();

  const perPage = filters.limit || 10;
  const offset = filters.offset || 0;
  const currentPage = Math.floor(offset / perPage);
  const noPages = Math.ceil(total / perPage) || 1;
  const pages = generatePageItems(noPages, currentPage, 7);

  const startItem = total === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + perPage, total);

  const changePage = (newPage: number) => {
    if (newPage < 0 || newPage >= noPages || newPage === currentPage) return;
    onFilterChange({
      ...filters,
      offset: newPage * perPage,
    });
  };

  const handlePageSizeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newLimit = parseInt(e.target.value, 10);
    onFilterChange({
      ...filters,
      limit: newLimit,
      offset: 0,
    });
    setUsersPerPageLimitSize(String(newLimit));
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {/* Items per page selector & range counter */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground order-2 sm:order-1">
        <div className="flex items-center gap-2">
          <select
            value={perPage}
            onChange={handlePageSizeChange}
            aria-label={t("itemsPerPage")}
            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span className="whitespace-nowrap">{t("itemsPerPage")}</span>
        </div>

        {total > 0 && (
          <span className="text-muted-foreground/80 hidden md:inline">
            ({startItem}–{endItem} / {total})
          </span>
        )}
      </div>

      {/* Pagination control buttons */}
      <div className="order-1 sm:order-2 flex justify-center sm:justify-end">
        <ShadcnPagination className="mx-0 w-auto">
          <PaginationContent className="gap-1">
            <PaginationItem>
              <PaginationPrevious
                disabled={currentPage === 0 || total === 0}
                onClick={() => changePage(currentPage - 1)}
                text={t("previous")}
              />
            </PaginationItem>

            {pages.map((pageIndex, idx) => {
              if (typeof pageIndex === "string") {
                return (
                  <PaginationItem key={`ellipsis-${pageIndex}-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              return (
                <PaginationItem key={`page-${pageIndex}`}>
                  <PaginationLink
                    isActive={pageIndex === currentPage}
                    onClick={() => changePage(pageIndex)}
                  >
                    {pageIndex + 1}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              <PaginationNext
                disabled={currentPage + 1 >= noPages || total === 0}
                onClick={() => changePage(currentPage + 1)}
                text={t("next")}
              />
            </PaginationItem>
          </PaginationContent>
        </ShadcnPagination>
      </div>
    </div>
  );
};
