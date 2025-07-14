import { useState } from 'react'
import { Card, CardTitle } from '../ui/card'
import FlagFromIP from '@/utils/flagFromIP'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { MoreVertical, Pencil, Trash2, Power } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import useDirDetection from '@/hooks/use-dir-detection'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { queryClient } from '@/utils/query-client'
import { NodeResponse, useRemoveNode } from '@/service/api'

interface NodeProps {
  node: NodeResponse
  onEdit: (node: NodeResponse) => void
  onToggleStatus: (node: NodeResponse) => Promise<void>
}

const DeleteAlertDialog = ({ node, isOpen, onClose, onConfirm }: { node: NodeResponse; isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader className={cn(dir === 'rtl' && 'sm:text-right')}>
          <AlertDialogTitle>{t('nodes.deleteNode')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir={dir} dangerouslySetInnerHTML={{ __html: t('deleteNode.prompt', { name: node.name }) }} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={cn(dir === 'rtl' && 'sm:flex-row-reverse sm:gap-x-2')}>
          <AlertDialogCancel onClick={onClose}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function Node({ node, onEdit, onToggleStatus }: NodeProps) {
  const { t } = useTranslation()
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const removeNodeMutation = useRemoveNode()

  const handleDeleteClick = (event: Event) => {
    event.stopPropagation()
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    try {
      await removeNodeMutation.mutateAsync({
        nodeId: node.id,
      })
      toast.success(t('success', { defaultValue: 'Success' }), {
        description: t('nodes.deleteSuccess', {
          name: node.name,
          defaultValue: 'Node «{name}» has been deleted successfully',
        }),
      })
      setDeleteDialogOpen(false)
      // Invalidate nodes queries
      queryClient.invalidateQueries({ queryKey: ['/api/nodes'] })
    } catch (error) {
      toast.error(t('error', { defaultValue: 'Error' }), {
        description: t('nodes.deleteFailed', {
          name: node.name,
          defaultValue: 'Failed to delete node «{name}»',
        }),
      })
    }
  }

  return (
    <>
      <Card className="group relative h-full p-4 transition-colors hover:bg-accent">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onEdit(node)}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'min-h-2 min-w-2 rounded-full',
                  node.status === 'connected' ? 'bg-green-500' : node.status === 'connecting' ? 'bg-yellow-500' : node.status === 'error' ? 'bg-red-500' : 'bg-gray-500',
                )}
              />
              <div className="truncate font-medium">{node.name}</div>
            </div>
            <CardTitle className="flex items-center gap-1 truncate text-sm text-muted-foreground">
              <FlagFromIP ip={node.address} />
              <span>
                {node.address}:{node.port}
              </span>
            </CardTitle>
            {(node.xray_version || node.node_version) && (
              <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                {node.xray_version && (
                  <span>
                    {t('node.xrayVersion', { defaultValue: 'Xray Core Version' })}: {node.xray_version}
                  </span>
                )}
                {node.node_version && (
                  <span>
                    {t('node.coreVersion', { defaultValue: 'Node Core Version' })}: {node.node_version}
                  </span>
                )}
              </div>
            )}
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
                  onToggleStatus(node)
                }}
              >
                <Power className="mr-2 h-4 w-4" />
                {node.status === 'disabled' ? t('enable') : t('disable')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={e => {
                  e.stopPropagation()
                  onEdit(node)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDeleteClick} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <DeleteAlertDialog node={node} isOpen={isDeleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} onConfirm={handleConfirmDelete} />
    </>
  )
}
