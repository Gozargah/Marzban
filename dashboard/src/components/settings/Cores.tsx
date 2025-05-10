import { useGetAllCores, useModifyCoreConfig } from '@/service/api'
import { CoreResponse } from '@/service/api'
import Core from './Core'
import { useState, useEffect } from 'react'
import CoreConfigModal, { coreConfigFormSchema, CoreConfigFormValues } from '@/components/dialogs/CoreConfigModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/hooks/use-toast'
import { useTranslation } from 'react-i18next'
import { queryClient } from '@/utils/query-client'
import { Button } from '@/components/ui/button'
import useDirDetection from '@/hooks/use-dir-detection'

const initialDefaultValues: Partial<CoreConfigFormValues> = {
  name: '',
  config: JSON.stringify({}, null, 2),
  excluded_inbound_ids: []
}

interface CoresProps {
  isDialogOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  cores?: CoreResponse[];
  onEditCore?: (coreId: number | string) => void;
  onDuplicateCore?: (coreId: number | string) => void;
  onDeleteCore?: (coreName: string, coreId: number) => void;
}

export default function Cores({ 
  isDialogOpen, 
  onOpenChange,
  cores,
  onEditCore,
  onDuplicateCore,
  onDeleteCore 
}: CoresProps) {
  const [editingCore, setEditingCore] = useState<CoreResponse | null>(null)
  const { t } = useTranslation()
  const modifyCoreMutation = useModifyCoreConfig()
  const dir = useDirDetection()
  
  const { data: coresData, isLoading } = useGetAllCores({})

  useEffect(() => {
    const handleOpenDialog = () => onOpenChange?.(true)
    window.addEventListener('openCoreDialog', handleOpenDialog)
    return () => window.removeEventListener('openCoreDialog', handleOpenDialog)
  }, [onOpenChange])

  const form = useForm<CoreConfigFormValues>({
    resolver: zodResolver(coreConfigFormSchema),
    defaultValues: initialDefaultValues
  })

  const handleEdit = (core: CoreResponse) => {
    setEditingCore(core)
    form.reset({
      name: core.name,
      config: JSON.stringify(core.config, null, 2),
      excluded_inbound_ids: core.exclude_inbound_tags ? 
        core.exclude_inbound_tags.split(',')
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id)) : 
        []
    })
    onOpenChange?.(true)
  }

  const handleToggleStatus = async (core: CoreResponse) => {
    try {
      await modifyCoreMutation.mutateAsync({
        coreId: core.id,
        data: {
          name: core.name,
          config: core.config,
          exclude_inbound_tags: core.exclude_inbound_tags
        },
        params: {
          restart_nodes: true
        }
      })
      
      toast({
        title: t('success', { defaultValue: 'Success' }),
        description: t('core.toggleSuccess', { 
          name: core.name,
          defaultValue: `Core "{name}" has been toggled successfully`
        })
      })
      
      // Invalidate the groups query to refresh the list
      queryClient.invalidateQueries({
        queryKey: ['/api/cores']
      })
    } catch (error) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t('core.toggleFailed', { 
          name: core.name,
          defaultValue: `Failed to toggle core "{name}"`
        }),
        variant: "destructive"
      })
    }
  }

  return (
    <div className="flex-1 w-full">
      <ScrollArea dir={dir} className="h-[calc(100vh-8rem)]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-6 w-full">
          {(cores || coresData?.cores)?.map((core: CoreResponse) => (
            <Core
              key={core.id}
              core={core}
              onEdit={onEditCore ? () => onEditCore(core.id) : () => handleEdit(core)}
              onToggleStatus={handleToggleStatus}
              onDuplicate={onDuplicateCore ? () => onDuplicateCore(core.id) : undefined}
              onDelete={onDeleteCore ? () => onDeleteCore(core.name, core.id) : undefined}
            />
          ))}
        </div>
      </ScrollArea>

      <CoreConfigModal
        isDialogOpen={!!isDialogOpen}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setEditingCore(null)
            form.reset(initialDefaultValues)
          }
          onOpenChange?.(open)
        }}
        form={form}
        editingCore={!!editingCore}
        editingCoreId={editingCore?.id}
      />
    </div>
  )
} 