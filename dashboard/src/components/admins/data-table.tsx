import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils.ts'
import useDirDetection from '@/hooks/use-dir-detection.tsx'
import React, { useState, useMemo, useEffect } from 'react'
import { ChevronDown, Edit2, Power, PowerOff, RefreshCw, Trash2, User, UserRound, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import { AdminDetails } from '@/service/api'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge.tsx'
import { statusColors } from '@/constants/UserSettings.ts'
import { useIsMobile } from '@/hooks/use-mobile.tsx'

interface DataTableProps<TData extends AdminDetails> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  onEdit: (admin: AdminDetails) => void
  onDelete: (admin: AdminDetails) => void
  onToggleStatus: (admin: AdminDetails) => void
  setStatusToggleDialogOpen: (isOpen: boolean) => void
  onResetUsage: (adminUsername: string) => void
  isLoading?: boolean
  isFetching?: boolean
}

const ExpandedRowContent = ({
  row,
  onEdit,
  onDelete,
  onToggleStatus,
  onResetUsage,
}: {
  row: AdminDetails
  onEdit: (admin: AdminDetails) => void
  onDelete: (admin: AdminDetails) => void
  onToggleStatus: (admin: AdminDetails) => void
  onResetUsage: (adminUsername: string) => void
}) => {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const isSudo = row.is_sudo

  return (
    <div className="flex items-center justify-between py-4 px-2">
      <div className="flex gap-1">
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              'flex items-center justify-center rounded-full px-0.5 sm:px-1 py-0.5 w-fit max-w-[150px] gap-x-2 pointer-events-none',
              isSudo ? statusColors['active'].statusColor : statusColors['disabled'].statusColor || 'bg-gray-400 text-white',
              isMobile && 'py-2.5 h-6 px-1',
            )}
          >
            <div>{isMobile ? <UserRound className="w-4 h-4" /> : <span className="capitalize text-nowrap font-medium text-xs">{isSudo ? t(`sudo`) : t('admin')}</span>}</div>
          </Badge>
        </div>
        <span>|</span>
        <div className="flex items-center gap-1">
          <User className="w-4 h-4" />
          <span>{row.total_users ? row.total_users : 0}</span>
        </div>
      </div>
      <div className="flex justify-end gap-1">
        <Button onClick={() => onToggleStatus(row)} variant="ghost" size="icon">
          {row.is_disabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onEdit(row)} title={t('edit')}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onResetUsage(row.username)} title={t('admins.resetUsersUsage')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(row)} title={t('delete')}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

export function DataTable<TData extends AdminDetails>({ columns, data, onEdit, onDelete, onToggleStatus, onResetUsage, isLoading = false, isFetching = false }: DataTableProps<TData>) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const { t } = useTranslation()
  const [visibleRows, setVisibleRows] = useState<number>(0)
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  const dir = useDirDetection()
  const isRTL = dir === 'rtl'
  const isLoadingData = isLoading || isFetching

  useEffect(() => {
    if (isLoading || isFetching) {
      setVisibleRows(0)
      return
    }

    const totalRows = table.getRowModel().rows.length
    let currentRow = 0

    const loadNextRow = () => {
      if (currentRow < totalRows) {
        setVisibleRows(prev => prev + 1)
        currentRow++
        setTimeout(loadNextRow, 50)
      }
    }

    loadNextRow()
  }, [isLoading, isFetching, table.getRowModel().rows.length])

  const LoadingState = useMemo(() => (
    <TableRow>
      <TableCell colSpan={columns.length} className="h-24">
        <div dir={dir} className="flex flex-col items-center justify-center gap-2">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm">{t('loading')}</span>
        </div>
      </TableCell>
    </TableRow>
  ), [columns.length, dir, t])

  const EmptyState = useMemo(() => (
    <TableRow>
      <TableCell colSpan={columns.length} className="h-24 text-center">
        <span className="text-muted-foreground">{t('noResults')}</span>
      </TableCell>
    </TableRow>
  ), [columns.length, t])

  const handleRowToggle = (rowId: string) => {
    setExpandedRow(expandedRow === rowId ? null : rowId)
  }

  const handleEditModal = (cellId: string, rowData: AdminDetails) => {
    const isChevron = cellId === 'chevron'
    const isSmallScreen = window.innerWidth < 768
    if (!isSmallScreen && !isChevron) {
      onEdit(rowData)
    }
  }

  return (
    <div className="rounded-md border">
      <Table dir={cn(isRTL && 'rtl')}>
        <TableHeader className="relative">
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow className="uppercase" key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'text-xs sticky z-10 overflow-visible',
                    isRTL && 'text-right',
                    index === 0 && 'w-[270px] md:w-auto',
                    index === 1 && 'min-w-[70px] md:w-auto',
                    index === 2 && 'min-w-[70px] md:w-auto',
                    index === 3 && 'min-w-[70px] md:w-auto',
                    index === 4 && 'min-w-[70px] md:w-[120px]',
                    index >= 3 && 'hidden md:table-cell',
                    header.id === 'chevron' && 'table-cell md:hidden',
                  )}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoadingData ? LoadingState : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, index) => (
              <React.Fragment key={row.id}>
                <TableRow
                  className={cn(
                    'cursor-pointer md:cursor-default border-b hover:!bg-inherit md:hover:!bg-muted/50',
                    expandedRow === row.id && 'border-transparent',
                    index >= visibleRows && 'opacity-0',
                    'transition-all duration-300 ease-in-out'
                  )}
                  style={{
                    transform: index >= visibleRows ? 'translateY(10px)' : 'translateY(0)',
                  }}
                  onClick={() => window.innerWidth < 768 && handleRowToggle(row.id)}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e: any) => {
                        const target = e.target as HTMLElement
                        if (target.closest('button') || target.closest('[role="menuitem"]')) return
                        handleEditModal(cell.column.id, row.original)
                      }}
                      className={cn(
                        'py-4 text-sm',
                        index === 5 && 'hidden md:w-[85px]',
                        index >= 3 && 'hidden md:table-cell',
                        cell.column.id === 'chevron' && 'table-cell md:hidden',
                        dir === 'rtl' ? 'pl-3' : 'pr-3',
                      )}
                    >
                      {cell.column.id === 'chevron' ? (
                        <div className="flex items-center justify-center cursor-pointer" onClick={() => handleRowToggle(row.id)}>
                          <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', expandedRow === row.id && 'rotate-180')} />
                        </div>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {expandedRow === row.id && (
                  <TableRow 
                    className={cn(
                      "md:hidden border-b hover:!bg-inherit",
                      index >= visibleRows && 'opacity-0',
                      'transition-all duration-300 ease-in-out'
                    )}
                    style={{
                      transform: index >= visibleRows ? 'translateY(10px)' : 'translateY(0)',
                    }}
                  >
                    <TableCell colSpan={columns.length} className="p-0 text-sm">
                      <ExpandedRowContent
                        row={row.original}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggleStatus={onToggleStatus}
                        onResetUsage={onResetUsage}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          ) : EmptyState}
        </TableBody>
      </Table>
    </div>
  )
}
