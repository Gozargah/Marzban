import {AdminDetails} from '@/service/api'
import {ColumnDef} from '@tanstack/react-table'
import {ChevronDown, Edit2, Trash2} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'

export const setupColumns = (
    {
        t,
        handleSort,
        filters,
        onEdit,
        onDelete,
    }: {
        t: (key: string) => string
        handleSort: (column: string) => void
        filters: { sort: string }
        onEdit: (admin: AdminDetails) => void
        onDelete: (admin: AdminDetails) => void
    }): ColumnDef<AdminDetails>[] => [
    {
        accessorKey: 'username',
        header: () => (
            <button onClick={handleSort.bind(null, 'username')} className="flex gap-1 px-2 py-3 w-full items-center">
                <div className="text-xs capitalize">
                    {t('username')}
                </div>
                {filters.sort && (filters.sort === 'username' || filters.sort === '-username') && (
                    <ChevronDown
                        size={16}
                        className={`
              transition-transform duration-300
              ${filters.sort === 'username' ? 'rotate-180' : ''}
              ${filters.sort === '-username' ? 'rotate-0' : ''}
            `}
                    />
                )}
            </button>
        ),
        cell: ({row}) => (
            <div className="font-medium">{row.getValue('username')}</div>
        ),
    },
    {
        accessorKey: 'is_disabled',
        header: () => (
            <button onClick={handleSort.bind(null, 'is_disabled')} className="flex gap-1 px-2 py-3 w-full items-center">
                <div className="text-xs capitalize">
                    {t('status')}
                </div>
                {filters.sort && (filters.sort === 'is_disabled' || filters.sort === '-is_disabled') && (
                    <ChevronDown
                        size={16}
                        className={`
              transition-transform duration-300
              ${filters.sort === 'is_disabled' ? 'rotate-180' : ''}
              ${filters.sort === '-is_disabled' ? 'rotate-0' : ''}
            `}
                    />
                )}
            </button>
        ),
        cell: ({row}) => {
            const isDisabled = row.getValue('is_disabled')
            return (
                <Badge variant={isDisabled ? 'secondary' : 'default'} className={!isDisabled ? 'bg-green-600' : ''}>
                    {isDisabled ? t('disabled') : t('active')}
                </Badge>
            )
        },
    },
    {
        accessorKey: 'role',
        header: () => <div className="text-xs capitalize">{t('role')}</div>,
        cell: ({row}) => {
            const isSudo = row.getValue('is_sudo')
            return isSudo ? (
                t('sudo')
            ) : (
                t('admin')
            )
        },
    },
    {
        accessorKey: 'users_count',
        header: () => (
            <button onClick={handleSort.bind(null, 'users_count')} className="flex gap-1 px-2 py-3 w-full items-center">
                <div className="text-xs capitalize">
                    {t('users.count')}
                </div>
                {filters.sort && (filters.sort === 'users_count' || filters.sort === '-users_count') && (
                    <ChevronDown
                        size={16}
                        className={`
              transition-transform duration-300
              ${filters.sort === 'users_count' ? 'rotate-180' : ''}
              ${filters.sort === '-users_count' ? 'rotate-0' : ''}
            `}
                    />
                )}
            </button>
        ),
        cell: ({row}) => (
            <div className="flex items-center gap-2">
                <span>{row.getValue('users_count') || 0}</span>
            </div>
        ),
    },
    {
        accessorKey: 'users_usage',
        header: () => (
            <button onClick={handleSort.bind(null, 'users_usage')}
                    className="flex gap-1 px-2 py-3 w-full items-center">
                <div className="text-xs capitalize">
                    {t('users.usage')}
                </div>
                {filters.sort && (filters.sort === 'users_usage' || filters.sort === '-users_usage') && (
                    <ChevronDown
                        size={16}
                        className={`
              transition-transform duration-300
              ${filters.sort === 'users_usage' ? 'rotate-180' : ''}
              ${filters.sort === '-users_usage' ? 'rotate-0' : ''}
            `}
                    />
                )}
            </button>
        ),
        cell: ({row}) => {
            const traffic = row.getValue('users_usage') as number | null
            return traffic ? `${(traffic / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB` : '0 TB'
        },
    },
    {
        id: 'actions',
        cell: ({row}) => (
            <div className="flex justify-end gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(row.original)}
                    title={t('edit')}
                >
                    <Edit2 className="h-4 w-4"/>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(row.original)}
                    title={t('delete')}
                >
                    <Trash2 className="h-4 w-4 text-destructive"/>
                </Button>
            </div>
        ),
    },
]