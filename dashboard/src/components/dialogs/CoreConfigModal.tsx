import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { UseFormReturn } from 'react-hook-form'
import { toast } from '@/hooks/use-toast'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Editor from '@monaco-editor/react'
import { useTheme } from '../../components/theme-provider'
import { useCallback, useState, useEffect } from 'react'
import { Copy, X } from 'lucide-react'
import { useCreateCoreConfig, useModifyCoreConfig, useGetInbounds } from '@/service/api'
import { queryClient } from '@/utils/query-client'

export const coreConfigFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  config: z.string().min(1, 'Configuration is required'),
  fallback_id: z.number().optional(),
  excluded_inbound_ids: z.array(z.number()).optional(),
  public_key: z.string().optional(),
  private_key: z.string().optional(),
})

export type CoreConfigFormValues = z.infer<typeof coreConfigFormSchema>

interface CoreConfigModalProps {
  isDialogOpen: boolean
  onOpenChange: (open: boolean) => void
  form: UseFormReturn<CoreConfigFormValues>
  editingCore: boolean
  editingCoreId?: number
}

interface ValidationResult {
  isValid: boolean
  error?: string
}

export default function CoreConfigModal({ isDialogOpen, onOpenChange, form, editingCore, editingCoreId }: CoreConfigModalProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const { resolvedTheme } = useTheme()
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true })
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [generatedShortId, setGeneratedShortId] = useState<string | null>(null)
  const [keyPair, setKeyPair] = useState<{ publicKey: string, privateKey: string } | null>(null)
  const createCoreMutation = useCreateCoreConfig()
  const modifyCoreMutation = useModifyCoreConfig()

  // Get all inbounds for the select dropdown - Only fetch when modal is open
  const { data: inboundsData } = useGetInbounds({
    query: {
      enabled: isDialogOpen // Only fetch data when the modal is open
    }
  })

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
          JSON.parse(form.getValues().config)
          setValidation({ isValid: true })
        } catch (e) {
          setValidation({
            isValid: false,
            error: e instanceof Error ? e.message : 'Invalid JSON',
          })
        }
      }
    },
    [form],
  )

  const handleEditorDidMount = useCallback(() => {
    setIsEditorReady(true)
  }, [])

  const generateKeyPair = () => {
    // This would normally call an API to generate keys
    // Mock implementation for now
    const publicKey = `HKKshhooop${Math.random().toString(36).substring(2, 10)}wjldbsnbJHKLS`
    const privateKey = `kjhsdhsgPHHJVJS${Math.random().toString(36).substring(2, 10)}nkmsbdk`

    setKeyPair({ publicKey, privateKey });
    
    toast({
      description: t('coreConfigModal.keyPairGenerated'),
    })
  }

  const generateShortId = () => {
    // Mock implementation
    const shortId = Math.random().toString(36).substring(2, 10)
    setGeneratedShortId(shortId)
    
    toast({
      description: t('coreConfigModal.shortIdGenerated'),
    })
  }

  const copyToClipboard = (text: string, messageKey: string) => {
    navigator.clipboard.writeText(text)
    toast({
      description: t(messageKey),
    })
  }

  const defaultConfig = JSON.stringify({
    log: {
      loglevel: "error"
    },
    inbounds: [
      {
        tag: "Inbound Name",
        listen: "0.0.0.0",
        port: 1122,
        protocol: "vless",
        settings: {
          clients: [],
          decryption: "none"
        },
        streamSettings: {
          network: "tcp",
          tcpSettings: {},
          security: "none"
        },
        sniffing: {
          enabled: true,
          destOverride: ["http", "tls"]
        }
      }
    ]
  }, null, 2)

  const onSubmit = async (values: CoreConfigFormValues) => {
    try {
      // Validate JSON
      let configObj;
      try {
        configObj = JSON.parse(values.config)
      } catch (e) {
        toast({
          title: t('error', { defaultValue: 'Error' }),
          description: t('coreConfigModal.invalidJson'),
          variant: "destructive"
        })
        return
      }

      // Convert excluded_inbound_ids array to comma-separated string
      const excludeInboundTags = values.excluded_inbound_ids && values.excluded_inbound_ids.length > 0
        ? values.excluded_inbound_ids.join(',')
        : null;

      if (editingCore && editingCoreId) {
        // Update existing core
        await modifyCoreMutation.mutateAsync({
          coreId: editingCoreId,
          data: {
            name: values.name,
            config: configObj,
            exclude_inbound_tags: excludeInboundTags
          },
          params: {
            restart_nodes: true
          }
        });
      } else {
        // Create new core
        await createCoreMutation.mutateAsync({
          data: {
            name: values.name,
            config: configObj,
            exclude_inbound_tags: excludeInboundTags
          }
        });
      }

      toast({
        title: t('success', { defaultValue: 'Success' }),
        description: t(editingCore ? 'coreConfigModal.editSuccess' : 'coreConfigModal.createSuccess', {
          name: values.name,
          defaultValue: editingCore
            ? `Core "${values.name}" has been updated successfully`
            : `Core "${values.name}" has been created successfully`
        })
      })

      // Invalidate cores query to refresh list
      queryClient.invalidateQueries({ queryKey: ['/api/cores'] })

      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      console.error('Core config operation failed:', error)
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t(editingCore ? 'coreConfigModal.editFailed' : 'coreConfigModal.createFailed', {
          name: values.name,
          error: error?.message || '',
          defaultValue: editingCore
            ? `Failed to update core "${values.name}"`
            : `Failed to create core "${values.name}"`
        }),
        variant: "destructive"
      })
    }
  }

  // Get available inbounds from the config when form loads
  useEffect(() => {
    if (isDialogOpen && isEditorReady) {
      try {
        const configValue = form.getValues().config;
        if (configValue) {
          const parsedConfig = JSON.parse(configValue);
          if (parsedConfig.inbounds && Array.isArray(parsedConfig.inbounds)) {
            // Extract the inbound tags
            const inboundTags = parsedConfig.inbounds
              .filter((inbound: any) => inbound.tag)
              .map((inbound: any) => inbound.tag);

            console.log("Available inbound tags:", inboundTags);
          }
        }
      } catch (error) {
        console.error("Failed to parse config for inbounds:", error);
      }
    }
  }, [isDialogOpen, isEditorReady, form]);

  // Initialize form fields when modal opens
  useEffect(() => {
    if (isDialogOpen) {
      if (!editingCore) {
        // Set default values for new core
        form.setValue("excluded_inbound_ids", []);
        form.setValue("fallback_id", undefined);
        
        if (!form.getValues().config) {
          form.setValue("config", defaultConfig);
        }
      }
    }
  }, [isDialogOpen, editingCore, form, defaultConfig]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] h-full sm:h-auto overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn("text-xl text-start font-semibold", dir === "rtl" && "sm:text-right")}>
            {editingCore ? t('coreConfigModal.editCore') : t('coreConfigModal.addConfig')}
          </DialogTitle>
          <p className={cn("text-sm text-muted-foreground text-start", dir === "rtl" && "sm:text-right")}>
            {t('coreConfigModal.createNewConfig')}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('coreConfigModal.jsonConfig')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('coreConfigModal.editJson')}</p>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="config"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div dir="ltr" className="rounded-lg border h-[450px]">
                            <Editor
                              height="100%"
                              defaultLanguage="json"
                              value={field.value} // Use value instead of defaultValue to support editing
                              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                              onChange={field.onChange}
                              onValidate={handleEditorValidation}
                              onMount={handleEditorDidMount}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                roundedSelection: true,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                formatOnPaste: true,
                                formatOnType: true,
                              }}
                            />
                          </div>
                        </FormControl>
                        {validation.error && !validation.isValid && (
                          <FormMessage>{validation.error}</FormMessage>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('coreConfigModal.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('coreConfigModal.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fallback_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('coreConfigModal.fallback')}</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                        value={field.value !== undefined && field.value !== null ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('coreConfigModal.selectFallback')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {inboundsData && inboundsData.length > 0 ? (
                            inboundsData.map((inbound: any) => (
                              <SelectItem key={`fallback-${inbound.id}`} value={String(inbound.id)}>
                                {inbound.tag || inbound.id}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem key="fallback-default-1" value="1">{t('coreConfigModal.fallback')} 1</SelectItem>
                              <SelectItem key="fallback-default-2" value="2">{t('coreConfigModal.fallback')} 2</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excluded_inbound_ids"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('coreConfigModal.excludedInbound')}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const parsedValue = value ? parseInt(value) : undefined;
                          field.onChange(parsedValue ? [parsedValue] : []);
                        }}
                        value={field.value && Array.isArray(field.value) && field.value.length > 0 
                          ? String(field.value[0]) 
                          : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('coreConfigModal.selectInbound')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {inboundsData && inboundsData.length > 0 ? (
                            inboundsData.map((inbound: any) => (
                              <SelectItem key={`inbound-${inbound.id}`} value={String(inbound.id)}>
                                {inbound.tag || inbound.id}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem key="inbound-default-1" value="1">{t('coreConfigModal.inbound')} 1</SelectItem>
                              <SelectItem key="inbound-default-2" value="2">{t('coreConfigModal.inbound')} 2</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 space-y-4">
                  <Button type="button" onClick={generateKeyPair} className="w-full">
                    {t('coreConfigModal.generateKeyPair')}
                  </Button>

                  {keyPair && (
                    <div className="p-4 border rounded-md relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn("absolute top-2 h-6 w-6", 
                          dir === "rtl" ? "left-2" : "right-2"
                        )}
                        onClick={() => setKeyPair(null)}
                        aria-label={t('close')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">{t('coreConfigModal.publicKey')}</p>
                          <div className="flex items-center gap-2">
                            <code className="bg-muted p-2 rounded text-sm flex-1 overflow-x-auto whitespace-nowrap">
                              {keyPair.publicKey}
                            </code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(keyPair.publicKey, 'coreConfigModal.publicKeyCopied')}
                              aria-label={t('copy')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium mb-1">{t('coreConfigModal.privateKey')}</p>
                          <div className="flex items-center gap-2">
                            <code className="bg-muted p-2 rounded text-sm flex-1 overflow-x-auto whitespace-nowrap">
                              {keyPair.privateKey}
                            </code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(keyPair.privateKey, 'coreConfigModal.privateKeyCopied')}
                              aria-label={t('copy')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button type="button" onClick={generateShortId} className="w-full">
                    {t('coreConfigModal.generateShortId')}
                  </Button>
                </div>

                {generatedShortId && (
                  <div className="mt-4 p-4 border rounded-md relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn("absolute top-2 h-6 w-6", 
                        dir === "rtl" ? "left-2" : "right-2"
                      )}
                      onClick={() => setGeneratedShortId(null)}
                      aria-label={t('close')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <p className="text-sm font-medium mb-1">{t('coreConfigModal.shortId')}</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted p-2 rounded text-sm flex-1 overflow-x-auto whitespace-nowrap">
                        {generatedShortId}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(generatedShortId, 'coreConfigModal.shortIdCopied')}
                        aria-label={t('copy')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!validation.isValid}>
                {editingCore ? t('save') : t('create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 