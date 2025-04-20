import { Card } from '@/components/ui/card'
import { CoreResponse, useDeleteCoreConfig } from '@/service/api'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useState } from 'react'
import { MoreVertical, Pencil, Trash2, Copy } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import { queryClient } from '@/utils/query-client'

interface CoreProps {
  core: CoreResponse
  onEdit: (core: CoreResponse) => void
  onToggleStatus: (core: CoreResponse) => Promise<void>
  onDuplicate?: () => void
  onDelete?: () => void
}

const DeleteAlertDialog = ({
  core,
  isOpen,
  onClose,
  onConfirm,
}: {
  core: CoreResponse
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader className={cn(dir === "rtl" && "sm:text-right")}>
          <AlertDialogTitle>{t('deleteConfirmation')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir={dir} dangerouslySetInnerHTML={{ __html: t('core.deleteConfirm', { name: core.name }) }} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={cn(dir === "rtl" && "sm:gap-x-2 sm:flex-row-reverse")}>
          <AlertDialogCancel onClick={onClose}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function Core({ core, onEdit, onToggleStatus, onDuplicate, onDelete }: CoreProps) {
  const { t } = useTranslation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const deleteCoreMutation = useDeleteCoreConfig()

  const handleDeleteClick = (event: Event) => {
    event.stopPropagation()
    if (onDelete) {
      onDelete()
    } else {
      setShowDeleteDialog(true)
    }
  }

  const handleConfirmDelete = async () => {
    try {
      await deleteCoreMutation.mutateAsync({ coreId: core.id })
      toast({
        title: t('success', { defaultValue: 'Success' }),
        description: t('settings.cores.deleteSuccess', {
          name: core.name,
          defaultValue: 'Core configuration has been deleted successfully'
        })
      })
      setShowDeleteDialog(false)
      queryClient.invalidateQueries({ queryKey: ['/api/cores'] })
    } catch (error) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t('settings.cores.deleteFailed', {
          name: core.name,
          defaultValue: 'Failed to delete core configuration'
        }),
        variant: "destructive"
      })
    }
  }

  return (
    <>
      <Card className="px-4 py-5 relative group h-full hover:bg-accent transition-colors">
        <div className="flex items-center gap-3">
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => onEdit(core)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "min-h-2 min-w-2 rounded-full",
                  "bg-green-500"
                )} />
                <div className="font-medium">{core.name}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Core ID: {core.id}
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {t('createdAt')}: {new Date(core.created_at).toLocaleDateString()}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => {
                e.stopPropagation()
                onEdit(core)
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('edit')}
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem onSelect={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('duplicate')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={handleDeleteClick}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <DeleteAlertDialog
        core={core}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
} 