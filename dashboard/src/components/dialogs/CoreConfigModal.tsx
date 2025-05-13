import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {useTranslation} from 'react-i18next'
import {UseFormReturn} from 'react-hook-form'
import {toast} from '@/hooks/use-toast'
import {z} from 'zod'
import {cn} from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import Editor from '@monaco-editor/react'
import {useTheme} from '../../components/theme-provider'
import {useCallback, useState, useEffect} from 'react'
import {X, Maximize2, Minimize2} from 'lucide-react'
import {useCreateCoreConfig, useModifyCoreConfig} from '@/service/api'
import {queryClient} from '@/utils/query-client'
import {CopyButton} from '@/components/CopyButton'
import {generateKeyPair} from '@stablelib/x25519'
import {encodeURLSafe} from '@stablelib/base64'

export const coreConfigFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    config: z.string().min(1, 'Configuration is required'),
    fallback_id: z.array(z.string()).optional(),
    excluded_inbound_ids: z.array(z.string()).optional(),
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

export default function CoreConfigModal({
                                            isDialogOpen,
                                            onOpenChange,
                                            form,
                                            editingCore,
                                            editingCoreId
                                        }: CoreConfigModalProps) {
    const {t} = useTranslation()
    const dir = useDirDetection()
    const {resolvedTheme} = useTheme()
    const [validation, setValidation] = useState<ValidationResult>({isValid: true})
    const [isEditorReady, setIsEditorReady] = useState(false)
    const [generatedShortId, setGeneratedShortId] = useState<string | null>(null)
    const [keyPair, setKeyPair] = useState<{ publicKey: string, privateKey: string } | null>(null)
    const createCoreMutation = useCreateCoreConfig()
    const modifyCoreMutation = useModifyCoreConfig()
    const [isEditorFullscreen, setIsEditorFullscreen] = useState(false)
    const [inboundTags, setInboundTags] = useState<string[]>([])


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
                    setValidation({isValid: true})
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

    const generatePrivateAndPublicKey = () => {
        const keyPair = generateKeyPair()
        const formattedKeyPair = {
            privateKey: encodeURLSafe(keyPair.secretKey).replace(/=/g, '').replace(/\n/g, ''),
            publicKey: encodeURLSafe(keyPair.publicKey).replace(/=/g, '').replace(/\n/g, '')
        }
        setKeyPair(formattedKeyPair)

        toast({
            description: t('coreConfigModal.keyPairGenerated'),
        })
    }

    const generateShortId = () => {
        // Generate 8 random bytes and convert to hex string (equivalent to openssl rand -hex 8)
        const randomBytes = new Uint8Array(8);
        crypto.getRandomValues(randomBytes);
        const shortId = Array.from(randomBytes)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');

        setGeneratedShortId(shortId)

        toast({
            description: t('coreConfigModal.shortIdGenerated'),
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
                    title: t('error', {defaultValue: 'Error'}),
                    description: t('coreConfigModal.invalidJson'),
                    variant: "destructive"
                })
                return
            }

            // Convert fallback_id array to comma-separated string
            const fallbackTags = values.fallback_id && values.fallback_id.length > 0
                ? values.fallback_id.join(',')
                : null;

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
                        fallbacks_inbound_tags: fallbackTags,
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
                        fallbacks_inbound_tags: fallbackTags,
                        exclude_inbound_tags: excludeInboundTags
                    }
                });
            }

            toast({
                title: t('success', {defaultValue: 'Success'}),
                description: t(editingCore ? 'coreConfigModal.editSuccess' : 'coreConfigModal.createSuccess', {
                    name: values.name,
                    defaultValue: editingCore
                        ? `Core "${values.name}" has been updated successfully`
                        : `Core "${values.name}" has been created successfully`
                })
            })

            // Invalidate cores query to refresh list
            queryClient.invalidateQueries({queryKey: ['/api/cores']})

            onOpenChange(false)
            form.reset()
        } catch (error: any) {
            console.error('Core config operation failed:', error)
            toast({
                title: t('error', {defaultValue: 'Error'}),
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

    // Extract inbound tags from config JSON whenever config changes
    useEffect(() => {
        try {
            const configValue = form.getValues().config;
            if (configValue) {
                const parsedConfig = JSON.parse(configValue);
                if (parsedConfig.inbounds && Array.isArray(parsedConfig.inbounds)) {
                    const tags = parsedConfig.inbounds
                        .filter((inbound: any) => typeof inbound.tag === 'string')
                        .map((inbound: any) => inbound.tag);
                    setInboundTags(tags);
                } else {
                    setInboundTags([]);
                }
            }
        } catch {
            setInboundTags([]);
        }
    }, [form.watch('config')]);

    // Initialize form fields when modal opens
    useEffect(() => {
        if (isDialogOpen) {
            if (!editingCore) {
                // Set default values for new core
                form.setValue("excluded_inbound_ids", []);
                form.setValue("fallback_id", []);

                if (!form.getValues().config) {
                    form.setValue("config", defaultConfig);
                }
            }
        }
    }, [isDialogOpen, editingCore, form, defaultConfig]);

    useEffect(() => {
        if (!isDialogOpen) {
            setIsEditorFullscreen(false);
        }
    }, [isDialogOpen]);

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-full sm:max-w-[1000px] h-full sm:h-auto  px-4 py-6">
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
                        <div
                            className="max-h-[75vh] overflow-y-auto pr-4 -mr-4 sm:max-h-[75vh] px-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">{t('coreConfigModal.jsonConfig')}</h3>
                                    <p className="text-sm text-muted-foreground mb-2">{t('coreConfigModal.editJson')}</p>
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="config"
                                            render={({field}) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <div className={cn(
                                                            "relative rounded-lg border h-[450px] sm:h-[500px] md:h-[550px]",
                                                            isEditorFullscreen &&
                                                            "fixed inset-0 z-50 bg-background flex flex-col h-full w-full max-w-none max-h-none p-0 m-0"
                                                        )} dir="ltr">
                                                            {!isEditorReady && (
                                                                <div
                                                                    className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
                                        <span
                                            className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></span>
                                                                </div>
                                                            )}
                                                            {/* Fullscreen Toggle Button */}
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className={cn(
                                                                    "absolute top-2 right-2 z-50",
                                                                    isEditorFullscreen ? "bg-muted" : ""
                                                                )}
                                                                onClick={() => setIsEditorFullscreen((v) => !v)}
                                                                aria-label={isEditorFullscreen ? t('exitFullscreen', {defaultValue: 'Exit Fullscreen'}) : t('fullscreen', {defaultValue: 'Fullscreen'})}
                                                            >
                                                                {isEditorFullscreen ? <Minimize2 className="h-5 w-5"/> :
                                                                    <Maximize2 className="h-5 w-5"/>}
                                                            </Button>
                                                            <Editor
                                                                height={isEditorFullscreen ? "100vh" : "100%"}
                                                                defaultLanguage="json"
                                                                value={field.value}
                                                                theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                                                                onChange={field.onChange}
                                                                onValidate={handleEditorValidation}
                                                                onMount={handleEditorDidMount}
                                                                options={{
                                                                    minimap: {enabled: false},
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
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>{t('coreConfigModal.name')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder={t('coreConfigModal.namePlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="fallback_id"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>{t('coreConfigModal.fallback')}</FormLabel>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {field.value && field.value.length > 0 ? (
                                                            field.value.map((tag: string) => (
                                                                <span key={tag}
                                                                      className="bg-muted/80 px-2 py-1 rounded-md text-sm flex items-center gap-2">
                                {tag}
                                                                    <button
                                                                        type="button"
                                                                        className="hover:text-destructive"
                                                                        onClick={() => field.onChange((field.value || []).filter((t: string) => t !== tag))}
                                                                    >
                                  ×
                                </button>
                              </span>
                                                            ))
                                                        ) : (
                                                            <span
                                                                className="text-muted-foreground text-sm">{t('coreConfigModal.selectFallback')}</span>
                                                        )}
                                                    </div>
                                                    <Select
                                                        value=""
                                                        onValueChange={(value: string) => {
                                                            if (!value) return;
                                                            const currentValue = field.value || [];
                                                            if (!currentValue.includes(value)) {
                                                                field.onChange([...currentValue, value]);
                                                            }
                                                        }}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue
                                                                    placeholder={t('coreConfigModal.selectFallback')}/>
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {inboundTags.length > 0 ? (
                                                                inboundTags.map((tag) => (
                                                                    <SelectItem
                                                                        key={tag}
                                                                        value={tag}
                                                                        disabled={field.value?.includes(tag)}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        {tag}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <SelectItem key="fallback-none" value="none">No inbounds
                                                                    found</SelectItem>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    {field.value && field.value.length > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => field.onChange([])}
                                                            className="w-full"
                                                        >
                                                            {t('coreConfigModal.clearAllFallbacks')}
                                                        </Button>
                                                    )}
                                                </div>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="excluded_inbound_ids"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>{t('coreConfigModal.excludedInbound')}</FormLabel>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {field.value && field.value.length > 0 ? (
                                                            field.value.map((tag: string) => (
                                                                <span key={tag}
                                                                      className="bg-muted/80 px-2 py-1 rounded-md text-sm flex items-center gap-2">
                                {tag}
                                                                    <button
                                                                        type="button"
                                                                        className="hover:text-destructive"
                                                                        onClick={() => field.onChange((field.value || []).filter((t: string) => t !== tag))}
                                                                    >
                                  ×
                                </button>
                              </span>
                                                            ))
                                                        ) : (
                                                            <span
                                                                className="text-muted-foreground text-sm">{t('coreConfigModal.selectInbound')}</span>
                                                        )}
                                                    </div>
                                                    <Select
                                                        value=""
                                                        onValueChange={(value: string) => {
                                                            if (!value) return;
                                                            const currentValue = field.value || [];
                                                            if (!currentValue.includes(value)) {
                                                                field.onChange([...currentValue, value]);
                                                            }
                                                        }}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue
                                                                    placeholder={t('coreConfigModal.selectInbound')}/>
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {inboundTags.length > 0 ? (
                                                                inboundTags.map((tag) => (
                                                                    <SelectItem
                                                                        key={tag}
                                                                        value={tag}
                                                                        disabled={field.value?.includes(tag)}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        {tag}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <SelectItem key="inbound-none" value="none">No inbounds
                                                                    found</SelectItem>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    {field.value && field.value.length > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => field.onChange([])}
                                                            className="w-full"
                                                        >
                                                            {t('coreConfigModal.clearAllExcluded')}
                                                        </Button>
                                                    )}
                                                </div>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <div className="pt-4 space-y-4">
                                        <Button type="button" onClick={generatePrivateAndPublicKey} className="w-full">
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
                                                    <X className="h-4 w-4"/>
                                                </Button>

                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-sm font-medium mb-1">{t('coreConfigModal.publicKey')}</p>
                                                        <div className="flex items-center gap-2">
                                                            <code
                                                                className="bg-muted p-2 rounded text-sm flex-1 overflow-x-auto whitespace-nowrap">
                                                                {keyPair.publicKey}
                                                            </code>
                                                            <CopyButton
                                                                value={keyPair.publicKey}
                                                                copiedMessage="coreConfigModal.publicKeyCopied"
                                                                defaultMessage="coreConfigModal.copyPublicKey"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-sm font-medium mb-1">{t('coreConfigModal.privateKey')}</p>
                                                        <div className="flex items-center gap-2">
                                                            <code
                                                                className="bg-muted p-2 rounded text-sm flex-1 overflow-x-auto whitespace-nowrap">
                                                                {keyPair.privateKey}
                                                            </code>
                                                            <CopyButton
                                                                value={keyPair.privateKey}
                                                                copiedMessage="coreConfigModal.privateKeyCopied"
                                                                defaultMessage="coreConfigModal.copyPrivateKey"
                                                            />
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
                                                <X className="h-4 w-4"/>
                                            </Button>
                                            <p className="text-sm font-medium mb-1">{t('coreConfigModal.shortId')}</p>
                                            <div className="flex items-center gap-2">
                                                <code
                                                    className="bg-muted p-2 rounded text-sm flex-1 overflow-x-auto whitespace-nowrap">
                                                    {generatedShortId}
                                                </code>
                                                <CopyButton
                                                    value={generatedShortId}
                                                    copiedMessage="coreConfigModal.shortIdCopied"
                                                    defaultMessage="coreConfigModal.copyShortId"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {!isEditorFullscreen && (
                            <div className="flex justify-end gap-x-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    {t('cancel')}
                                </Button>
                                <Button type="submit" disabled={!validation.isValid}>
                                    {editingCore ? t('save') : t('create')}
                                </Button>
                            </div>
                        )}
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
} 