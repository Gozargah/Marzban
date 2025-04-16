import {ColumnDef, flexRender, getCoreRowModel, useReactTable} from '@tanstack/react-table'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {cn} from "@/lib/utils.ts";
import useDirDetection from "@/hooks/use-dir-detection.tsx";
import React, {useState} from "react";
import {ChevronDown} from "lucide-react";

interface DataTableProps<TData> {
    columns: ColumnDef<TData, any>[]
    data: TData[]
}

export function DataTable<TData>({columns, data}: DataTableProps<TData>) {
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })
    const handleRowToggle = (rowId: string) => {
        setExpandedRow(expandedRow === rowId ? null : rowId)
    }
    const dir = useDirDetection()

    const isRTL = useDirDetection() === 'rtl'
    return (
        <div className="rounded-md border">
            <Table dir={cn(isRTL && 'rtl')}>
                <TableHeader className="relative">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow className="uppercase" key={headerGroup.id}>
                            {headerGroup.headers.map((header, index) => {
                                return (
                                    <TableHead key={header.id}
                                               className={cn(
                                                   'text-xs sticky z-10 overflow-visible',
                                                   isRTL && 'text-right',
                                                   index === 0 && 'w-[270px] md:w-auto',
                                                   index === 1 && 'max-w-[70px] md:w-auto ',
                                                   index === 2 && 'min-w-[100px] md:w-auto',
                                                   index >= 3 && 'hidden md:table-cell',
                                                   header.id === 'chevron' && 'table-cell md:hidden',
                                               )}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <React.Fragment key={row.id}>
                                {/* Collapsible Row */}
                                <TableRow
                                    className={cn('cursor-pointer md:cursor-default border-b hover:!bg-inherit md:hover:!bg-muted/50', expandedRow === row.id && 'border-transparent')}
                                    onClick={() => window.innerWidth < 768 && handleRowToggle(row.id)} // Only toggle on small screens
                                    data-state={row.getIsSelected() && 'selected'}
                                >
                                    {row.getVisibleCells().map((cell, index) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                'py-2 text-sm',
                                                index===5 && 'hidden md:w-[85px]',
                                                index >= 3 && 'hidden md:table-cell',
                                                cell.column.id === 'chevron' && 'table-cell md:hidden',
                                                dir === 'rtl' ? 'pl-3' : 'pr-3',
                                            )}
                                        >
                                            {cell.column.id === 'chevron' ? (
                                                <div className="flex items-center justify-center cursor-pointer"
                                                     onClick={() => handleRowToggle(row.id)}>
                                                    <ChevronDown
                                                        className={cn('h-4 w-4 transition-transform duration-300', expandedRow === row.id && 'rotate-180')}/>
                                                </div>
                                            ) : (
                                                flexRender(cell.column.columnDef.cell, cell.getContext())
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                                {/* Expanded Content */}
                                {expandedRow === row.id && (
                                    <TableRow className=" md:hidden border-b hover:!bg-inherit">
                                        {/* Expanded content only visible on small screens */}
                                        <TableCell colSpan={columns.length} className="p-4 text-sm">
                                            <div className="flex flex-col gap-y-4">
                                                <div className="flex flex-col">
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center"
                            >
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}