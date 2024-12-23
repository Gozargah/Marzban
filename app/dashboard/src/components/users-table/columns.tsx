import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types/User";
import { OnlineBadge } from "../OnlineBadge";
import { StatusBadge } from "../StatusBadge";
import UsageSliderCompact from "../UsageSliderCompact";
import { OnlineStatus } from "../OnlineStatus";
import ActionButtons from "../ActionButtons";
import { Button } from "../ui/button";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

export const setupColumns = ({
  t,
  handleSort,
  filters,
  handleStatusFilter,
  dir,
}: {
  t: (key: string) => string;
  handleSort: (column: string) => void;
  filters: { sort: string };
  handleStatusFilter: (value: any) => void;
  dir: any;
}): ColumnDef<User>[] => [
  {
    accessorKey: "username",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => handleSort("username")}>
        <div className="text-xs uppercase font-bold">
          <span className="md:hidden">
            {t("users")}
          </span>
          <span className="hidden md:block">
            {t("username")}
          </span>
        </div>
        {filters.sort &&
          (filters.sort === "username" || filters.sort === "-username") && (
            <ChevronDown
              className={`
              transition-transform duration-300
              ${filters.sort === "username" ? "rotate-180" : ""}
              ${filters.sort === "-username" ? "rotate-0" : ""}
            `}
            />
          )}
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-medium pl-1 md:pl-2 overflow-hidden text-ellipsis whitespace-nowrap">
        <div className="flex items-center gap-x-3 py-1 px-1">
          <OnlineBadge lastOnline={row.original.online_at} />
          <span className="whitespace-nowrap text-ellipsis overflow-hidden text-base">
            {row.getValue("username")}
          </span>
          <div className="hidden md:block">
            <OnlineStatus lastOnline={row.original.online_at} />
          </div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => (
      <Select dir={dir || ""} onValueChange={handleStatusFilter}>
        <SelectTrigger className="border-none p-0 ring-none px-0 md:px-2 max-w-28">
          <span className="uppercase text-xs px-1">{t("usersTable.status")}</span>
        </SelectTrigger>
        <SelectContent dir="ltr">
          <SelectItem className="py-4" value="0"></SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="disabled">Disabled</SelectItem>
          <SelectItem value="limited">Limited</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
        </SelectContent>
      </Select>
    ),
    cell: ({ row }) => {
      const status: User["status"] = row.getValue("status");
      const expire = row.original.expire;

      return (
        <div className="flex flex-col gap-y-2 py-1">
          <StatusBadge expiryDate={expire} status={status} />
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const expireA = rowA.original.expire || Infinity;
      const expireB = rowB.original.expire || Infinity;

      if (expireA !== expireB) return expireA - expireB;

      return rowA.original.used_traffic - rowB.original.used_traffic;
    },
  },
  {
    id: "details",
    header: t("dataUsage"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 justify-between">
        <UsageSliderCompact
          total={row.original.data_limit}
          used={row.original.used_traffic}
          totalUsedTraffic={row.original.lifetime_used_traffic}
          dataLimitResetStrategy={row.original.data_limit_reset_strategy}
          status={row.original.status}
        />
        <div className="hidden md:block w-[200px] px-4 py-4">
          <ActionButtons user={row.original} />
        </div>
      </div>
    ),
  },
  {
    id: "chevron",
    cell: () => <div className="flex flex-wrap justify-between"></div>,
  },
];
