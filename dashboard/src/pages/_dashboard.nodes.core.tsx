import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../components/theme-provider'
import Cores from '@/components/settings/Cores'
import { useGetCoreConfig, useModifyCoreConfig, useGetAllCores, useDeleteCoreConfig } from '@/service/api'
import { toast } from '@/hooks/use-toast'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import CoreConfigModal, { coreConfigFormSchema, CoreConfigFormValues } from '@/components/dialogs/CoreConfigModal'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

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
  const queryClient = useQueryClient()
  const { mutate: modifyConfig } = useModifyCoreConfig()
  const { data: coresData, isLoading: isCoresLoading } = useGetAllCores({})
  const deleteCoreConfig = useDeleteCoreConfig()
  const [config, setConfig] = useState(JSON.stringify(data, null, 2))
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true })
  const [isEditorReady, setIsEditorReady] = useState(false)
  const { resolvedTheme } = useTheme()
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCoreId, setEditingCoreId] = useState<number | undefined>(undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [coreToDelete, setCoreToDelete] = useState<string | null>(null)
  const [coreIdToDelete, setCoreIdToDelete] = useState<number | null>(null)
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

  const handleDeleteCore = (coreName: string, coreId: number) => {
    setCoreToDelete(coreName);
    setCoreIdToDelete(Number(coreId));
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCore = () => {
    if (coreToDelete == null) return;
    deleteCoreConfig.mutate({
      coreId: Number(coreIdToDelete),
      params: { restart_nodes: true }
    }, {
      onSuccess: () => {
        toast({
          title: t('success', { defaultValue: 'Success' }),
          description: t('settings.cores.deleteSuccess', {
            name: `Core ${coreToDelete}`,
            defaultValue: `Core has been deleted successfully`
          })
        });
        setDeleteDialogOpen(false);
        setCoreToDelete(null);
        queryClient.invalidateQueries({ queryKey: ['/api/cores'] });
      },
      onError: (error) => {
        toast({
          title: t('error', { defaultValue: 'Error' }),
          description: t('settings.cores.deleteFailed', {
            name: `Core ${coreToDelete}`,
            defaultValue: `Failed to delete core`
          }),
          variant: "destructive"
        });
        setDeleteDialogOpen(false);
        setCoreToDelete(null);
      }
    });
  };

  return (
    <div className="flex flex-col">
      <Cores
        cores={coresData?.cores}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className={cn(dir === "rtl" && "sm:text-right")}>
            <AlertDialogTitle>{t("settings.cores.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              <span dir={dir} dangerouslySetInnerHTML={{ __html: t("core.deleteConfirm", { name: coreToDelete }) }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn("flex items-center gap-2", dir === "rtl" && "sm:gap-x-2")}>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteCore}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
