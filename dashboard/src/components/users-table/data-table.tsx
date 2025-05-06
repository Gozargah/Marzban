import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import React, { useState } from 'react'

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
}

export function DataTable<TData extends UserResponse, TValue>({ 
  columns, 
  data, 
  isLoading = false, 
  isFetching = false 
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation()
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  const isRTL = useDirDetection() === 'rtl'

  const handleRowToggle = (rowId: string) => {
    setExpandedRow(expandedRow === rowId ? null : rowId)
  }

  const dir = useDirDetection()
  
  const isLoadingData = isLoading || isFetching
  
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
                    index === 1 && 'max-w-[70px] md:w-auto md:px-0',
                    index === 2 && 'min-w-[100px] md:w-[450px]',
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
          {isLoadingData ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24">
                <div dir={dir} className="flex flex-col items-center justify-center gap-2">
                  <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-white">{t('loading')}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
              <React.Fragment key={row.id}>
                <TableRow
                  className={cn(
                    expandedRow === row.id ? 'bg-accent/30' : 'hover:bg-accent/30',
                    'transition-colors duration-200'
                  )}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        index === row.getVisibleCells().length - 1 && 'relative p-0 md:p-0',
                        index === 1 && 'max-w-[70px]',
                        index === 2 && 'hidden sm:table-cell',
                        index === 3 && 'hidden md:table-cell',
                      )}
                    >
                      {cell.column.id === 'chevron' ? (
                        <div
                          className={`absolute inset-0 flex items-center justify-center cursor-pointer`}
                          onClick={() => handleRowToggle(row.id)}
                        >
                          <ChevronDown
                            className={`
                            w-5 h-5 text-muted-foreground
                            transition-transform duration-300
                            ${expandedRow === row.id ? 'rotate-180' : ''}
                          `}
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
                      <div className="flex flex-col gap-y-4">
                        <UsageSliderCompact
                          isMobile
                          status={row.original.status}
                          total={row.original.data_limit}
                          totalUsedTraffic={row.original.lifetime_used_traffic}
                          used={row.original.used_traffic}
                          dataLimitResetStrategy={row.original.data_limit_reset_strategy || undefined}
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center">
                              <StatusBadge expiryDate={row.original.expire} status={row.original.status} isMobile />
                            </div>
                            <ActionButtons user={row.original} />
                          </div>
                          <div>
                            <OnlineStatus lastOnline={row.original.online_at} />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <span className="text-muted-foreground">{t('noResults')}</span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
