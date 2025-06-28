import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import React, { useState, useCallback, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { UserResponse } from '@/service/api'
import { ChevronDown, LoaderCircle } from 'lucide-react'
import ActionButtons from '../ActionButtons'
import { OnlineStatus } from '../OnlineStatus'
import { StatusBadge } from '../StatusBadge'
import UsageSliderCompact from '../UsageSliderCompact'
import { useTranslation } from 'react-i18next'

interface DataTableProps<TData extends UserResponse, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  isFetching?: boolean
  onEdit?: (user: UserResponse) => void
}

export function DataTable<TData extends UserResponse, TValue>({ columns, data, isLoading = false, isFetching = false, onEdit }: DataTableProps<TData, TValue>) {
  const { t } = useTranslation()
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const dir = useDirDetection()
  const isRTL = dir === 'rtl'
  const [visibleRows, setVisibleRows] = useState<number>(0)

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Add effect to handle staggered loading
  React.useEffect(() => {
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
        setTimeout(loadNextRow, 50) // Adjust timing as needed
      }
    }

    loadNextRow()
  }, [isLoading, isFetching, table.getRowModel().rows.length])

  const handleRowToggle = useCallback((rowId: number) => {
    setExpandedRow(prev => prev === rowId ? null : rowId)
  }, [])

  const handleEditModal = useCallback((e: React.MouseEvent, user: UserResponse) => {
    if ((e.target as HTMLElement).closest('.chevron')) return
    if (window.innerWidth < 768) {
      handleRowToggle(user.id)
      return
    }
    if ((e.target as HTMLElement).closest('[role="menu"], [role="menuitem"], [data-radix-popper-content-wrapper]')) return
    onEdit?.(user)
  }, [handleRowToggle, onEdit])

  const isLoadingData = isLoading || isFetching

  const ExpandedRowContent = useCallback(({ row }: { row: any }) => (
    <div className="p-4 flex flex-col gap-y-4">
      <UsageSliderCompact
        isMobile
        status={row.original.status}
        total={row.original.data_limit}
        totalUsedTraffic={row.original.lifetime_used_traffic}
        used={row.original.used_traffic}
      />
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <StatusBadge showOnlyExpiry expiryDate={row.original.expire} status={row.original.status} showExpiry />
          </div>
          <div onClick={e => e.stopPropagation()}>
            <ActionButtons user={row.original} />
          </div>
        </div>
        <div>
          <OnlineStatus lastOnline={row.original.online_at} />
        </div>
      </div>
    </div>
  ), [])

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

  return (
    <div className="rounded-md border overflow-hidden">
      <Table dir={isRTL ? 'rtl' : 'ltr'}>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="uppercase">
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'text-xs sticky z-10 bg-background',
                    isRTL && 'text-right',
                    index === 0 && 'w-[200px] sm:w-[270px] md:w-auto',
                    index === 1 && 'max-w-[70px] md:w-auto !px-0',
                    index === 2 && 'min-w-[100px] md:w-[450px] px-1',
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
                    expandedRow === row.original.id && 'border-transparent',
                    index >= visibleRows && 'opacity-0',
                    'transition-all duration-300 ease-in-out'
                  )}
                  style={{
                    transform: index >= visibleRows ? 'translateY(10px)' : 'translateY(0)',
                  }}
                  onClick={e => handleEditModal(e, row.original)}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'py-2 text-sm whitespace-nowrap',
                        index <= 1 && 'md:py-2 max-w-[calc(100vw-50px-32px-100px-48px)]',
                        index === 2 && 'w-[120px] !p-0 px-1',
                        index === 3 && 'w-8',
                        index === 3 && isRTL ? 'pr-0' : index === 3 && !isRTL && 'pl-0',
                        index >= 4 && 'hidden md:table-cell !p-0',
                        cell.column.id === 'chevron' && 'table-cell md:hidden',
                        isRTL ? 'pl-1.5 sm:pl-3' : 'pr-1.5 sm:pr-3',
                      )}
                    >
                      {cell.column.id === 'chevron' ? (
                        <div
                          className="chevron flex items-center justify-center cursor-pointer"
                          onClick={e => {
                            e.stopPropagation()
                            handleRowToggle(row.original.id)
                          }}
                        >
                          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expandedRow === row.original.id && 'rotate-180')} />
                        </div>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {expandedRow === row.original.id && (
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
                      <ExpandedRowContent row={row} />
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
