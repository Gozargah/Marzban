import { Card } from '@/components/ui/card'
import { CoreResponse } from '@/service/api'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { MoreVertical, Pencil, Trash2, Copy } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface CoreProps {
  core: CoreResponse
  onEdit: (core: CoreResponse) => void
  onToggleStatus: (core: CoreResponse) => Promise<void>
  onDuplicate?: () => void
  onDelete?: () => void
}

export default function Core({ core, onEdit, onDuplicate, onDelete }: CoreProps) {
  const { t } = useTranslation()

  const handleDeleteClick = (event: Event) => {
    event.stopPropagation()
    if (onDelete) {
      onDelete()
    }
  }

  return (
    <Card className="px-4 py-5 relative group h-full hover:bg-accent transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(core)}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={cn('min-h-2 min-w-2 rounded-full', 'bg-green-500')} />
              <div className="font-medium">{core.name}</div>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={e => {
                e.stopPropagation()
                onEdit(core)
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {t('edit')}
            </DropdownMenuItem>
            {onDuplicate && (
              <DropdownMenuItem
                onSelect={e => {
                  e.stopPropagation()
                  onDuplicate()
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                {t('duplicate')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={handleDeleteClick} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}
