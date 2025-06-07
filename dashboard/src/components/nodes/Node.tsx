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
import { useToast } from '@/hooks/use-toast'
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

export default function Node({ node, onEdit, onToggleStatus }: NodeProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
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
      toast({
        title: t('success', { defaultValue: 'Success' }),
        description: t('nodes.deleteSuccess', {
          name: node.name,
          defaultValue: 'Node «{name}» has been deleted successfully',
        }),
      })
      setDeleteDialogOpen(false)
      // Invalidate nodes queries
      queryClient.invalidateQueries({ queryKey: ['/api/nodes'] })
    } catch (error) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t('nodes.deleteFailed', {
          name: node.name,
          defaultValue: 'Failed to delete node «{name}»',
        }),
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card className="p-4 relative group h-full hover:bg-accent transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(node)}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'min-h-2 min-w-2 rounded-full',
                  node.status === 'connected' ? 'bg-green-500' : node.status === 'connecting' ? 'bg-yellow-500' : node.status === 'error' ? 'bg-red-500' : 'bg-gray-500',
                )}
              />
              <div className="font-medium truncate">{node.name}</div>
            </div>
            <CardTitle className="text-sm text-muted-foreground truncate flex items-center gap-1">
              <FlagFromIP ip={node.address} />
              <span>
                {node.address}:{node.port}
              </span>
            </CardTitle>
            {(node.xray_version || node.node_version) && (
              <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                {node.xray_version && (
                  <span>
                    {t('node.xrayVersion', { defaultValue: 'Xray Version' })}: {node.xray_version}
                  </span>
                )}
                {node.node_version && (
                  <span>
                    {t('node.coreVersion', { defaultValue: 'Core Version' })}: {node.node_version}
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
                <Power className="h-4 w-4 mr-2" />
                {node.status === 'connected' ? t('disable') : t('enable')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={e => {
                  e.stopPropagation()
                  onEdit(node)
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

      <DeleteAlertDialog node={node} isOpen={isDeleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} onConfirm={handleConfirmDelete} />
    </>
  )
}
