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
import {ChartPie, ChevronDown, Edit2, Power, PowerOff, Trash2, User} from "lucide-react";
import {Button} from "@/components/ui/button.tsx";
import {AdminDetails} from "@/service/api";
import {useTranslation} from "react-i18next";

interface DataTableProps<TData extends AdminDetails> {
    columns: ColumnDef<TData, any>[]
    data: TData[]
    onEdit: (admin: AdminDetails) => void
    onDelete: (admin: AdminDetails) => void
    onToggleStatus: (admin: AdminDetails) => void
    setStatusToggleDialogOpen: (isOpen: boolean) => void
}

const ExpandedRowContent = ({row, onEdit, onDelete, onToggleStatus}: {
    row: AdminDetails;
    onEdit: (admin: AdminDetails) => void;
    onDelete: (admin: AdminDetails) => void;
    onToggleStatus: (admin: AdminDetails) => void;
}) => {
    const {t} = useTranslation();

    return (
        <div className="flex items-center justify-between">
            <div className="flex gap-1">
                <div className="flex items-center gap-1">
                    <User className="w-4 h-4"/>
                    <span>{row.total_users ? row.total_users : 0}</span>
                </div>
                <span>|</span>
                <div className="flex items-center gap-1">
                    <ChartPie className="w-4 h-4"/>
                    <span>{row.users_usage ? `${(row.users_usage / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB` : '0 TB'}</span>
                </div>
            </div>
            <div className="flex justify-end gap-1">
                <Button
                    onClick={() => onToggleStatus(row)}
                    variant="ghost"
                    size="icon"
                >
                    {row.is_disabled ? <Power className="h-4 w-4"/> : <PowerOff className="h-4 w-4"/>}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(row)}
                    title={t('edit')}
                >
                    <Edit2 className="h-4 w-4"/>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(row)}
                    title={t('delete')}
                >
                    <Trash2 className="h-4 w-4 text-destructive"/>
                </Button>
            </div>
        </div>
    );
};

export function DataTable<TData extends AdminDetails>({
                                                          columns,
                                                          data,
                                                          onEdit,
                                                          onDelete,
                                                          onToggleStatus,
                                                          setStatusToggleDialogOpen
                                                      }: DataTableProps<TData>) {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });
    const dir = useDirDetection();
    const isRTL = dir === 'rtl';

    const handleRowToggle = (rowId: string) => {
        setExpandedRow(expandedRow === rowId ? null : rowId);
    };

    const handleEditModal = (cellId: string, rowData: AdminDetails) => {
        const isChevron = cellId === 'chevron';
        const isSmallScreen = window.innerWidth < 768;
        if (!isSmallScreen && !isChevron) {
            onEdit(rowData);
        }
    };

    const handleStatusToggle = (admin: AdminDetails) => {
        if (admin) {
            onToggleStatus(admin);
            setStatusToggleDialogOpen(true);
        }
    };

    return (
        <div className="rounded-md border">
            <Table dir={cn(isRTL && 'rtl')}>
                <TableHeader className="relative">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow className="uppercase" key={headerGroup.id}>
                            {headerGroup.headers.map((header, index) => (
                                <TableHead
                                    key={header.id}
                                    className={cn(
                                        'text-xs sticky z-10 overflow-visible',
                                        isRTL && 'text-right',
                                        index === 0 && 'w-[270px] md:w-auto',
                                        index === 1 && 'max-w-[70px] md:w-auto',
                                        index === 2 && 'min-w-[70px] md:w-auto',
                                        index === 3 && 'min-w-[70px] md:w-[120px]',
                                        index >= 2 && 'hidden md:table-cell',
                                        header.id === 'chevron' && 'table-cell md:hidden',
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
                                <TableRow
                                    className={cn(
                                        'cursor-pointer md:cursor-default border-b hover:!bg-inherit md:hover:!bg-muted/50',
                                        expandedRow === row.id && 'border-transparent'
                                    )}
                                    onClick={() => window.innerWidth < 768 && handleRowToggle(row.id)}
                                    data-state={row.getIsSelected() && 'selected'}
                                >
                                    {row.getVisibleCells().map((cell, index) => (
                                        <TableCell
                                            key={cell.id}
                                            onClick={(e: any) => {
                                                const target = e.target as HTMLElement;
                                                if (target.closest('button') || target.closest('[role="menuitem"]')) return;
                                                handleEditModal(cell.column.id, row.original);
                                            }}
                                            className={cn(
                                                'py-4 text-sm',
                                                index === 5 && 'hidden md:w-[85px]',
                                                index >= 2 && 'hidden md:table-cell',
                                                cell.column.id === 'chevron' && 'table-cell md:hidden',
                                                dir === 'rtl' ? 'pl-3' : 'pr-3',
                                            )}
                                        >
                                            {cell.column.id === 'chevron' ? (
                                                <div
                                                    className="flex items-center justify-center cursor-pointer"
                                                    onClick={() => handleRowToggle(row.id)}
                                                >
                                                    <ChevronDown
                                                        className={cn(
                                                            'h-4 w-4 transition-transform duration-300',
                                                            expandedRow === row.id && 'rotate-180'
                                                        )}
                                                    />
                                                </div>
                                            ) : (
                                                flexRender(cell.column.columnDef.cell, cell.getContext())
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                                {expandedRow === row.id && (
                                    <TableRow className="md:hidden border-b hover:!bg-inherit">
                                        <TableCell colSpan={columns.length} className="p-4 text-sm">
                                            <ExpandedRowContent
                                                row={row.original}
                                                onEdit={onEdit}
                                                onDelete={onDelete}
                                                onToggleStatus={handleStatusToggle}
                                            />
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
    );
}