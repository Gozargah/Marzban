import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import React, { useState } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { UserResponse } from '@/service/api'
import { ChevronDown } from 'lucide-react'
import ActionButtons from '../ActionButtons'
import { OnlineStatus } from '../OnlineStatus'
import { StatusBadge } from '../StatusBadge'
import UsageSliderCompact from '../UsageSliderCompact'

interface DataTableProps<TData extends UserResponse, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData extends UserResponse, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
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
                    'font-bold text-xs py-2 sticky z-10 bg-background overflow-visible',
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
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
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
                        'py-4 text-sm',
                        index <= 1 && 'md:py-2 max-w-[calc(100vw-50px-32px-100px-48px)]',
                        index === 2 && 'w-[120px]',
                        index === 3 && 'w-8',
                        index === 3 && dir === 'rtl' ? 'pr-0' : index === 3 && dir === 'ltr' && 'pl-0',
                        index >= 4 && 'hidden md:table-cell',
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
                {/* Expanded Content */}
                {expandedRow === row.id && (
                  <TableRow className=" md:hidden border-b hover:!bg-inherit">
                    {/* Expanded content only visible on small screens */}
                    <TableCell colSpan={columns.length} className="p-4 text-sm">
                      <div className="flex flex-col gap-y-4">
                        <UsageSliderCompact
                          isMobile
                          status={row.original.status}
                          total={row.original.data_limit}
                          totalUsedTraffic={row.original.lifetime_used_traffic}
                          used={row.original.used_traffic}
                          dataLimitResetStrategy={row.original.data_limit_reset_strategy}
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
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
