import { AdminDetails } from '@/service/api'
import { ColumnDef } from '@tanstack/react-table'
import { ChartPie, ChevronDown, MoreVertical, Pen, Power, PowerOff, RefreshCw, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.tsx'
import { formatBytes } from '@/utils/formatByte.ts'
import { AdminStatusBadge } from '@/components/AdminStatusBadge'

interface ColumnSetupProps {
  t: (key: string) => string
  handleSort: (column: string) => void
  filters: { sort: string }
  onEdit: (admin: AdminDetails) => void
  onDelete: (admin: AdminDetails) => void
  toggleStatus: (admin: AdminDetails) => void
  onResetUsage: (adminUsername: string) => void
}

const createSortButton = (
  column: string,
  label: string,
  t: (key: string) => string,
  handleSort: (column: string) => void,
  filters: {
    sort: string
  },
) => (
  <button onClick={handleSort.bind(null, column)} className="flex w-full items-center gap-1 py-1">
    <div className="text-xs">{t(label)}</div>
    {filters.sort && (filters.sort === column || filters.sort === '-' + column) && (
      <ChevronDown size={16} className={`transition-transform duration-300 ${filters.sort === column ? 'rotate-180' : ''} ${filters.sort === '-' + column ? 'rotate-0' : ''} `} />
    )}
  </button>
)

export const setupColumns = ({ t, handleSort, filters, onEdit, onDelete, toggleStatus, onResetUsage }: ColumnSetupProps): ColumnDef<AdminDetails>[] => [
  {
    accessorKey: 'username',
    header: () => createSortButton('username', 'username', t, handleSort, filters),
    cell: ({ row }) => (
      <div className="overflow-hidden text-ellipsis whitespace-nowrap pl-1 font-medium md:pl-2">
        <div className="flex items-start gap-x-3 px-1 py-1">
          <div className="pt-1">
            {row.original.is_disabled ? (
              <div className="min-h-[10px] min-w-[10px] rounded-full border border-gray-400 shadow-sm dark:border-gray-600" />
            ) : (
              <div className="min-h-[10px] min-w-[10px] rounded-full bg-green-500 shadow-sm" />
            )}
          </div>
          <div className="flex flex-col gap-y-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">{row.getValue('username')}</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'used_traffic',
    header: () => createSortButton('used_traffic', 'admins.used.traffic', t, handleSort, filters),
    cell: ({ row }) => {
      const traffic = row.getValue('used_traffic') as number | null
      return (
        <div className="flex items-center gap-2">
          <ChartPie className="hidden h-4 w-4 sm:block" />
          <span dir="ltr">{traffic ? formatBytes(traffic) : '0 B'}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'lifetime_used_traffic',
    header: () => createSortButton('lifetime_used_traffic', 'admins.lifetime.used.traffic', t, handleSort, filters),
    cell: ({ row }) => {
      const total = row.getValue('lifetime_used_traffic') as number | null
      return (
        <div className="flex items-center gap-2">
          <span dir="ltr">{formatBytes(total || 0)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'is_sudo',
    header: () => <div className="flex items-center text-xs capitalize">{t('admins.role')}</div>,
    cell: ({ row }) => {
      const isSudo = row.getValue('is_sudo')
      const isDisabled = row.original.is_disabled
      return (
        <div className="flex items-center gap-2">
          <AdminStatusBadge isSudo={!!isSudo} isDisabled={!!isDisabled} />
        </div>
      )
    },
  },
  {
    accessorKey: 'total_users',
    header: () => createSortButton('total_users', 'admins.total.users', t, handleSort, filters),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <User className="h-4 w-4" />
        <span>{row.getValue('total_users') || 0}</span>
      </div>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={e => {
                e.preventDefault()
                e.stopPropagation()
                onEdit(row.original)
              }}
            >
              <Pen className="mr-2 h-4 w-4" />
              {t('edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={e => {
                e.preventDefault()
                e.stopPropagation()
                toggleStatus(row.original)
              }}
            >
              {row.original.is_disabled ? <Power className="mr-2 h-4 w-4" /> : <PowerOff className="mr-2 h-4 w-4" />}
              {row.original.is_disabled ? t('enable') : t('disable')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={e => {
                e.preventDefault()
                e.stopPropagation()
                onResetUsage(row.original.username)
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('admins.reset')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={e => {
                e.preventDefault()
                e.stopPropagation()
                onDelete(row.original)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
  {
    id: 'chevron',
    cell: () => <div className="flex flex-wrap justify-between"></div>,
  },
]
