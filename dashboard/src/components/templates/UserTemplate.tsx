import { useState } from 'react'
import { Card, CardDescription, CardTitle } from '../ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Copy, EllipsisVertical, Infinity, Pen, Power, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import useDirDetection from '@/hooks/use-dir-detection'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatBytes } from '@/utils/formatByte'
import { createUserTemplate, useRemoveUserTemplate, UserTemplateCreate, UserTemplateResponse } from '@/service/api'
import { queryClient } from '@/utils/query-client.ts'

const DeleteAlertDialog = ({ userTemplate, isOpen, onClose, onConfirm }: { userTemplate: UserTemplateResponse; isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <div>
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader className={cn(dir === 'rtl' && 'sm:text-right')}>
            <AlertDialogTitle>{t('templates.deleteUserTemplateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              <span dir={dir} dangerouslySetInnerHTML={{ __html: t('templates.deleteUserTemplatePrompt', { name: userTemplate.name }) }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(dir === 'rtl' && 'sm:flex-row-reverse sm:gap-x-2')}>
            <AlertDialogCancel onClick={onClose}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              {t('remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const UserTemplate = ({
  template,
  onEdit,
  onToggleStatus,
}: {
  template: UserTemplateResponse
  onEdit: (userTemplate: UserTemplateResponse) => void
  onToggleStatus: (template: UserTemplateResponse) => void
}) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const removeUserTemplateMutation = useRemoveUserTemplate()
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDeleteClick = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
  }

  const handleConfirmDelete = async () => {
    try {
      await removeUserTemplateMutation.mutateAsync({
        templateId: template.id,
      })
      toast.success(t('success', { defaultValue: 'Success' }), {
        description: t('templates.deleteSuccess', {
          name: template.name,
          defaultValue: 'Template «{name}» has been deleted successfully',
        }),
      })
      setDeleteDialogOpen(false)
      // Invalidate nodes queries
      queryClient.invalidateQueries({ queryKey: ['/api/user_templates'] })
    } catch (error) {
      toast.error(t('error', { defaultValue: 'Error' }), {
        description: t('templates.deleteFailed', {
          name: template.name,
          defaultValue: 'Failed to delete template «{name}»',
        }),
      })
    }
  }

  const handleDuplicate = async () => {
    try {
      const newTemplate: UserTemplateCreate = {
        ...template,
        name: `${template.name} (copy)`,
      }
      await createUserTemplate(newTemplate)
      toast.success(t('success', { defaultValue: 'Success' }), {
        description: t('templates.duplicateSuccess', {
          name: template.name,
          defaultValue: 'Template «{name}» has been duplicated successfully',
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['/api/user_templates'] })
    } catch (error) {
      toast.error(t('error', { defaultValue: 'Error' }), {
        description: t('templates.duplicateFailed', {
          name: template.name,
          defaultValue: 'Failed to duplicate template «{name}»',
        }),
      })
    }
  }

  return (
    <Card className="group rounded-lg px-5 py-6 transition-colors hover:bg-accent">
      <div className="flex items-center justify-between">
        <div className="flex-1 cursor-pointer" onClick={() => onEdit(template)}>
          <CardTitle className="flex items-center gap-x-2">
            <div className={cn('min-h-2 min-w-2 rounded-full', template.is_disabled ? 'bg-red-500' : 'bg-green-500')} />
            <span>{template.name}</span>
          </CardTitle>
          <CardDescription>
            <div className="mt-2 flex flex-col gap-y-1">
              <p className={'flex items-center gap-x-1'}>
                {t('userDialog.dataLimit')}:{' '}
                <span dir="ltr">{!template.data_limit || template.data_limit === 0 ? <Infinity className="h-4 w-4"></Infinity> : formatBytes(template.data_limit ? template.data_limit : 0)}</span>
              </p>
              <p className={'flex items-center gap-x-1'}>
                {t('expire')}:
                <span>
                  {!template.expire_duration || template.expire_duration === 0 ? <Infinity className="h-4 w-4"></Infinity> : `${template.expire_duration / 60 / 60 / 24} ${t('dateInfo.day')}`}
                </span>
              </p>
            </div>
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="template-dropdown-menu">
              <EllipsisVertical />
              <span className="sr-only">Template Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={dir === 'rtl' ? 'end' : 'start'} className="template-dropdown-menu">
            <DropdownMenuItem
              onSelect={e => {
                e.stopPropagation()
                onToggleStatus(template)
              }}
            >
              <Power className="mr-2 h-4 w-4" />
              {template.is_disabled ? t('enable') : t('disable')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={e => {
                e.stopPropagation()
                onEdit(template)
              }}
            >
              <Pen className="h-4 w-4" />
              <span>{t('edit')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              dir={dir}
              className="template-dropdown-menu flex items-center"
              onSelect={e => {
                e.stopPropagation()
                handleDuplicate()
              }}
            >
              <Copy className="h-4 w-4" />
              <span>{t('duplicate')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              dir={dir}
              className="template-dropdown-menu flex items-center !text-red-500"
              onSelect={e => {
                e.stopPropagation()
                handleDeleteClick(e)
              }}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
              <span>{t('delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteAlertDialog userTemplate={template} isOpen={isDeleteDialogOpen} onClose={handleCloseDeleteDialog} onConfirm={handleConfirmDelete} />
    </Card>
  )
}

export default UserTemplate
