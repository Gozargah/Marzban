import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types/User";

export const setupColumns = (t: (key: string) => string): ColumnDef<User>[] => [
  // Username Column
  {
    accessorKey: "username",
    header: t("username"), // Use the translation key
    cell: ({ row }) => (
      <div className="font-medium px-4">
        {row.getValue("username")}
      </div>
    ),
  },
  // Status Column with Expire and Used Traffic
  {
    accessorKey: "status",
    header: t("columns.status"), // Use the translation key
    cell: ({ row }) => {
      const status: User["status"] = row.getValue("status");
      const expire = row.original.expire
        ? new Date(row.original.expire).toLocaleDateString()
        : "Never";
      const usedTraffic = row.original.used_traffic;

      return (
        <div className="flex flex-col">
          dib
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
  // Details Column: Responsive 3 Boxes
  {
    id: "details",
    header: t("columns.details"), // Use the translation key
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-2 justify-between">
        
      </div>
    ),
  },
];
