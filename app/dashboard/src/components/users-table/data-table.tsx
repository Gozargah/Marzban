import React, { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useDirDetection from "@/hooks/use-dir-detection";
import { cn } from "@/lib/utils";


interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null); // Track expanded row
  const [filters, setFilters] = useState({ status: "", sort: "" }); // Filters for status and sort
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const isRTL = useDirDetection() === "rtl";

  const handleRowToggle = (rowId: string) => {
    setExpandedRow(expandedRow === rowId ? null : rowId);
  };

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sort: prev.sort === column ? `${column} DESC` : column,
    }));
  };

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({
      ...prev,
      status: e.target.value,
    }));
  };

  return (
    <div className="rounded-md border">
      <Table dir={cn(isRTL && "rtl")}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow className="uppercase" key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "font-bold text-xs px-8",
                    isRTL && "text-right",
                    index >= 3 && "hidden md:table-cell" // Hide extra columns on md
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <React.Fragment key={row.id}>
                {/* Collapsible Row */}
                <TableRow
                  className={cn(
                    "cursor-pointer md:cursor-default hover:bg-gray-100 border-b",
                    expandedRow === row.id && "border-transparent"
                  )}
                  onClick={() =>
                    window.innerWidth < 768 && handleRowToggle(row.id)
                  } // Only toggle on small screens
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-4 text-sm sm:py-2",
                        index >= 3 && "hidden md:table-cell" // Hide extra columns on md
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {/* Expanded Content */}
                {expandedRow === row.id && (
                  <TableRow className="bg-gray-50 md:hidden border-b">
                    {/* Expanded content only visible on small screens */}
                    <TableCell
                      colSpan={columns.length}
                      className="p-4 text-sm"
                    >
                      <div>
                        <p className="text-gray-700">
                          Expanded content for row {row.id}.
                        </p>
                        {/* Add more content here */}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
