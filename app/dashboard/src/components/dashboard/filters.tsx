import { RefreshCw, Search, X } from "lucide-react";
import debounce from "lodash.debounce";
import React, { FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useDashboard } from "contexts/DashboardContext";

export const ReloadIcon = React.forwardRef<
  SVGSVGElement,
  React.ComponentProps<typeof RefreshCw>
>(({ className, ...props }, ref) => (
  <RefreshCw ref={ref} className={cn("size-4 shrink-0", className)} {...props} />
));
ReloadIcon.displayName = "ReloadIcon";

export type FilterProps = React.ComponentProps<"div">;

const setSearchField = debounce((search: string) => {
  useDashboard.getState().onFilterChange({
    ...useDashboard.getState().filters,
    offset: 0,
    search,
  });
}, 300);

export const Filters: FC<FilterProps> = ({ className, ...props }) => {
  const { loading, filters, onFilterChange, refetchUsers, onCreateUser } = useDashboard();
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchField(e.target.value);
  };

  const clear = () => {
    setSearchField.cancel();
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
    onFilterChange({
      ...filters,
      offset: 0,
      search: "",
    });
  };

  useEffect(() => {
    let lastSearch = useDashboard.getState().filters.search ?? "";
    if (searchInputRef.current) {
      searchInputRef.current.value = lastSearch;
    }

    const unsubscribe = useDashboard.subscribe((state) => {
      const nextSearch = state.filters.search ?? "";
      if (nextSearch !== lastSearch) {
        lastSearch = nextSearch;
        if (searchInputRef.current && searchInputRef.current.value !== nextSearch) {
          searchInputRef.current.value = nextSearch;
        }
      }
    });

    return () => {
      unsubscribe();
      setSearchField.cancel();
    };
  }, []);

  return (
    <div
      id="filters"
      className={cn(
        "sticky top-0 z-10 -mx-3 px-3 lg:-mx-6 lg:px-6 py-4",
        "grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-3",
        className
      )}
      {...props}
    >
      <div className="col-span-1 order-2 md:order-1 md:col-span-2 lg:col-span-1">
        <div className="relative w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={t("search")}
            onChange={onChange}
            className="ps-9 pe-14"
          />
          <div className="absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {loading && <Spinner className="size-3.5 text-muted-foreground" />}
            {filters.search && filters.search.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={clear}
                aria-label={t("clear", { defaultValue: "Clear search" })}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-1 order-1 md:order-2 md:col-span-2 lg:col-span-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("refreshUsers", { defaultValue: "Refresh users" })}
          disabled={loading}
          onClick={refetchUsers}
        >
          <ReloadIcon className={cn(loading && "animate-spin")} />
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="px-5"
          onClick={() => onCreateUser(true)}
        >
          {t("createUser")}
        </Button>
      </div>
    </div>
  );
};
