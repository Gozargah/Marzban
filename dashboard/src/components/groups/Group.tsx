import { Card } from '@/components/ui/card'
import { GroupResponse } from '@/service/api'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useRemoveGroup } from '@/service/api'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useState } from 'react'
import { MoreVertical, Pencil, Power, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import { queryClient } from '@/utils/query-client'

interface GroupProps {
  group: GroupResponse
  onEdit: (group: GroupResponse) => void
  onToggleStatus: (group: GroupResponse) => Promise<void>
}

const DeleteAlertDialog = ({ group, isOpen, onClose, onConfirm }: { group: GroupResponse; isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader className={cn(dir === 'rtl' && 'sm:text-right')}>
          <AlertDialogTitle>{t('deleteConfirmation')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir={dir} dangerouslySetInnerHTML={{ __html: t('group.deleteConfirm', { name: group.name }) }} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={cn(dir === 'rtl' && 'sm:gap-x-2 sm:flex-row-reverse')}>
          <AlertDialogCancel onClick={onClose}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function Group({ group, onEdit, onToggleStatus }: GroupProps) {
  const { t } = useTranslation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const deleteGroupMutation = useRemoveGroup()

  const handleDeleteClick = (event: Event) => {
    event.stopPropagation()
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    try {
      await deleteGroupMutation.mutateAsync({ groupId: group.id })
      toast.success(t('success', { defaultValue: 'Success' }), {
        description: t('group.deleteSuccess', {
          name: group.name,
          defaultValue: 'Group "{name}" has been deleted successfully',
        }),
      })
      setShowDeleteDialog(false)
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] })
    } catch (error) {
      toast.error(t('error', { defaultValue: 'Error' }), {
        description: t('group.deleteFailed', {
          name: group.name,
          defaultValue: 'Failed to delete group "{name}"',
        })
      })
    }
  }

  return (
    <>
      <Card className="px-4 py-5 relative group h-full hover:bg-accent transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(group)}>
            <div className="flex items-center gap-2">
              <div className={cn('min-h-2 min-w-2 rounded-full', group.is_disabled ? 'bg-red-500' : 'bg-green-500')} />
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{group.name}</div>
                <div className="font-mono text-xs text-muted-foreground">({group.inbound_tags?.length || 0})</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {t('admins.total.users')}: {group.total_users || 0}
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
                  onToggleStatus(group)
                }}
              >
                <Power className="h-4 w-4 mr-2" />
                {group.is_disabled ? t('enable') : t('disable')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={e => {
                  e.stopPropagation()
                  onEdit(group)
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDeleteClick} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <DeleteAlertDialog group={group} isOpen={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} onConfirm={handleConfirmDelete} />
    </>
  )
}
