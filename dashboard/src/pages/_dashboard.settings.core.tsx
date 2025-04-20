import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../components/theme-provider'
import Cores from '@/components/settings/Cores'
import { useGetCoreConfig, useModifyCoreConfig, useGetAllCores, useDeleteCoreConfig } from '@/service/api'
import { toast } from '@/hooks/use-toast'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import CoreConfigModal, { coreConfigFormSchema, CoreConfigFormValues } from '@/components/dialogs/CoreConfigModal'

const defaultConfig = {
  log: {
    loglevel: 'error',
  },
  inbounds: [
    {
      tag: 'inbound Name',
      listen: '0.0.0.0',
      port: 1122,
      protocol: 'vless',
      settings: {
        clients: [],
        decryption: 'none',
      },
      streamSettings: {
        network: 'tcp',
        tcpSettings: {},
        security: 'none',
      },
      sniffing: {},
    },
  ],
}

interface ValidationResult {
  isValid: boolean
  error?: string
}

export default function CoreSettings() {
  const { data, error, isLoading } = useGetCoreConfig(1)
  const { mutate: modifyConfig } = useModifyCoreConfig()
  const { data: coresData, isLoading: isCoresLoading } = useGetAllCores({})
  const deleteCoreConfig = useDeleteCoreConfig()
  const [config, setConfig] = useState(JSON.stringify(data, null, 2))
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true })
  const [isEditorReady, setIsEditorReady] = useState(false)
  const { resolvedTheme } = useTheme()
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCoreId, setEditingCoreId] = useState<number | undefined>(undefined)

  const coreConfigForm = useForm<CoreConfigFormValues>({
    resolver: zodResolver(coreConfigFormSchema),
    defaultValues: {
      name: '',
      config: JSON.stringify(defaultConfig, null, 2),
      excluded_inbound_ids: [],
    },
  })

  useEffect(() => {
    setConfig(JSON.stringify(data, null, 2))
  }, [data])

  const handleEditorValidation = useCallback(
    (markers: any[]) => {
      // Monaco editor provides validation markers
      const hasErrors = markers.length > 0
      if (hasErrors) {
        setValidation({
          isValid: false,
          error: markers[0].message,
        })
      } else {
        try {
          // Additional validation - try parsing the JSON
          JSON.parse(config)
          setValidation({ isValid: true })
        } catch (e) {
          setValidation({
            isValid: false,
            error: e instanceof Error ? e.message : 'Invalid JSON',
          })
        }
      }
    },
    [config],
  )

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value) {
      setConfig(value)
    }
  }, [])

  const handleEditorDidMount = useCallback(() => {
    setIsEditorReady(true)
  }, [])

  const handleSave = async () => {
    try {
      modifyConfig({
        coreId: 1,
        data: JSON.parse(config),
        params: { restart_nodes: true }
      }, {
        onSuccess: () => {
          toast({
            description: t("settings.core.saveSuccess"),
          })
        },
        onError: () => {
          toast({
            variant: "destructive",
            description: t("settings.core.saveFailed"),
          })
        }
      })
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("settings.core.saveFailed"),
      })
    }
  }

  const handleAddCore = () => {
    setEditingCoreId(undefined)
    coreConfigForm.reset({
      name: '',
      config: JSON.stringify(defaultConfig, null, 2),
      excluded_inbound_ids: [],
    })
    setIsModalOpen(true)
  }

  const handleEditCore = (coreId: string | number) => {
    const numericCoreId = Number(coreId);
    setEditingCoreId(numericCoreId);
    
    // Find the core in the fetched data
    const coreToEdit = coresData?.cores?.find(core => core.id === numericCoreId);
    
    if (coreToEdit) {
      // Convert exclude_inbound_tags string to array of numbers if needed
      const excludedInboundIds = coreToEdit.exclude_inbound_tags ? 
        coreToEdit.exclude_inbound_tags.split(',')
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id)) : 
        [];
          
      coreConfigForm.reset({
        name: coreToEdit.name,
        config: JSON.stringify(coreToEdit.config, null, 2),
        excluded_inbound_ids: excludedInboundIds,
      });
    } else {
      // Fallback if core not found
      coreConfigForm.reset({
        name: 'Core Name',
        config: JSON.stringify(defaultConfig, null, 2),
        excluded_inbound_ids: [],
      });
    }
    
    setIsModalOpen(true);
  }

  const handleDuplicateCore = (coreId: string | number) => {
    const numericCoreId = Number(coreId);
    const coreToDuplicate = coresData?.cores?.find(core => core.id === numericCoreId);
    
    if (!coreToDuplicate) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t('settings.cores.coreNotFound', {
          defaultValue: 'Core not found',
        }),
        variant: "destructive"
      });
      return;
    }
    
    // Prepare for creating a new core based on the existing one
    coreConfigForm.reset({
      name: `${coreToDuplicate.name} (Copy)`,
      config: JSON.stringify(coreToDuplicate.config, null, 2),
      excluded_inbound_ids: coreToDuplicate.exclude_inbound_tags ? 
        coreToDuplicate.exclude_inbound_tags.split(',')
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id)) : 
        [],
    });
    
    setEditingCoreId(undefined); // Mark as new core
    setIsModalOpen(true);
    
    toast({
      title: t('info', { defaultValue: 'Info' }),
      description: t('settings.cores.duplicateInfo', {
        name: coreToDuplicate.name,
        defaultValue: `Prepare to create a copy of "${coreToDuplicate.name}". Make changes if needed and click Save.`
      })
    });
  }

  const handleDeleteCore = (coreId: string | number) => {
    const numericCoreId = Number(coreId);
    
    deleteCoreConfig.mutate({ 
      coreId: numericCoreId,
      params: { restart_nodes: true }
    }, {
      onSuccess: () => {
        toast({
          title: t('success', { defaultValue: 'Success' }),
          description: t('settings.cores.deleteSuccess', {
            name: `Core ${coreId}`,
            defaultValue: `Core has been deleted successfully`
          })
        });
      },
      onError: (error) => {
        toast({
          title: t('error', { defaultValue: 'Error' }),
          description: t('settings.cores.deleteFailed', {
            name: `Core ${coreId}`,
            defaultValue: `Failed to delete core`
          }),
          variant: "destructive"
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-y-6 pt-4">
      <Cores 
        cores={coresData?.cores}
        onAddCore={handleAddCore}
        onEditCore={handleEditCore}
        onDuplicateCore={handleDuplicateCore}
        onDeleteCore={handleDeleteCore}
        isDialogOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
      />

      <CoreConfigModal
        isDialogOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        form={coreConfigForm}
        editingCore={!!editingCoreId}
        editingCoreId={editingCoreId}
      />
    </div>
  )
}
