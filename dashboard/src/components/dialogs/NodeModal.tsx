import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { UseFormReturn } from 'react-hook-form'
import {
    useCreateNode,
    useModifyNode,
    NodeConnectionType,
    useGetAllCores,
    CoreResponse,
    getNode,
    reconnectNode,
    useSyncNode
} from '@/service/api'
import { toast } from 'sonner'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { queryClient } from '@/utils/query-client'
import useDirDetection from '@/hooks/use-dir-detection'
import { useState, useEffect } from 'react'
import { Loader2, Settings, RefreshCw, Activity, RotateCcw, Wifi } from 'lucide-react'
import { v4 as uuidv4, v5 as uuidv5, v6 as uuidv6, v7 as uuidv7 } from 'uuid'
import { LoaderButton } from '../ui/loader-button'
import useDynamicErrorHandler from "@/hooks/use-dynamic-errors.ts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import UserOnlineStatsDialog from './UserOnlineStatsModal'

export const nodeFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    address: z.string().min(1, 'Address is required'),
    port: z.number().min(1, 'Port is required'),
    usage_coefficient: z.number().optional(),
    connection_type: z.enum([NodeConnectionType.grpc, NodeConnectionType.rest]),
    server_ca: z.string().min(1, 'Server CA is required'),
    keep_alive: z.number().min(1, 'Keep alive is required'),
    keep_alive_unit: z.enum(['seconds', 'minutes', 'hours']).default('seconds'),
    max_logs: z.number().min(1, 'Max logs is required'),
    api_key: z.string().min(1, 'API key is required'),
    core_config_id: z.number().min(1, 'Core configuration is required'),
    gather_logs: z.boolean().default(true),
})

export type NodeFormValues = z.infer<typeof nodeFormSchema>

interface NodeModalProps {
    isDialogOpen: boolean
    onOpenChange: (open: boolean) => void
    form: UseFormReturn<NodeFormValues>
    editingNode: boolean
    editingNodeId?: number
}

type ConnectionStatus = 'idle' | 'success' | 'error' | 'checking'

export default function NodeModal({ isDialogOpen, onOpenChange, form, editingNode, editingNodeId }: NodeModalProps) {
    const { t } = useTranslation()
    const dir = useDirDetection()
    const addNodeMutation = useCreateNode()
    const modifyNodeMutation = useModifyNode()
    const syncNodeMutation = useSyncNode()
    const handleError = useDynamicErrorHandler();
    const { data: cores } = useGetAllCores()
    const [statusChecking, setStatusChecking] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
    const [errorDetails, setErrorDetails] = useState<string | null>(null)
    const [autoCheck, setAutoCheck] = useState(false)
    const [showErrorDetails, setShowErrorDetails] = useState(false)
    const [debouncedValues, setDebouncedValues] = useState<NodeFormValues | null>(null)
    const [reconnecting, setReconnecting] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [showOnlineStats, setShowOnlineStats] = useState(false)

    // Reset status when modal opens/closes
    useEffect(() => {
        if (isDialogOpen) {
            setConnectionStatus('idle')
            setErrorDetails(null)
            setAutoCheck(true)
        }
    }, [isDialogOpen])

    // Debounce form values changes
    useEffect(() => {
        const values = form.getValues()
        const timer = setTimeout(() => {
            setDebouncedValues(values)
        }, 1000) // Wait 1 second after typing stops

        return () => clearTimeout(timer)
    }, [form.watch('name'), form.watch('address'), form.watch('port'), form.watch('api_key')])

    // Auto-check connection when debounced values change and are valid
    useEffect(() => {
        if (!isDialogOpen || !autoCheck || editingNode || !debouncedValues) return

        const { name, address, port, api_key } = debouncedValues
        if (name && address && port && api_key) {
            checkNodeStatus()
        }
    }, [debouncedValues])

    // Start/stop polling when editing a node
    useEffect(() => {
        if (editingNode && isDialogOpen && editingNodeId) {
            // Start polling immediately
            checkNodeStatus()
        }
    }, [editingNode, isDialogOpen, editingNodeId])

    // Initialize form with node data when editing
    useEffect(() => {
        if (editingNode && editingNodeId) {
            const fetchNodeData = async () => {
                try {
                    const nodeData = await getNode(editingNodeId)

                    // Set form values with the fetched node data
                    form.reset({
                        name: nodeData.name,
                        address: nodeData.address,
                        port: nodeData.port,
                        usage_coefficient: nodeData.usage_coefficient,
                        connection_type: nodeData.connection_type,
                        server_ca: nodeData.server_ca,
                        keep_alive: nodeData.keep_alive,
                        max_logs: nodeData.max_logs,
                        api_key: (nodeData.api_key as string) || '',
                        core_config_id: nodeData.core_config_id || cores?.cores?.[0]?.id,
                        gather_logs: nodeData.gather_logs ?? true,
                    })
                } catch (error) {
                    console.error('Error fetching node data:', error)
                    toast.error(t('nodes.fetchFailed'))
                }
            }

            fetchNodeData()
        } else {
            // For new nodes, set default values
            form.reset({
                name: '',
                address: '',
                port: 62050,
                usage_coefficient: 1,
                connection_type: NodeConnectionType.grpc,
                server_ca: '',
                keep_alive: 60,
                keep_alive_unit: 'seconds',
                max_logs: 1000,
                api_key: '',
                core_config_id: cores?.cores?.[0]?.id,
                gather_logs: true,
            })
        }
    }, [editingNode, editingNodeId, isDialogOpen])

    const checkNodeStatus = async () => {
        // Get current form values
        const values = form.getValues()

        // Validate required fields before checking
        if (!values.name || !values.address || !values.port) {
            return
        }

        setStatusChecking(true)
        setConnectionStatus('checking')
        setErrorDetails(null)

        try {
            if (editingNode && editingNodeId) {
                // For editing mode, use the node's endpoint directly
                const node = await getNode(editingNodeId)
                if (!node) {
                    throw new Error('No node data received')
                }

                if (node.status === 'connected') {
                    setConnectionStatus('success')
                } else if (node.status === 'error') {
                    setConnectionStatus('error')
                    setErrorDetails(node.message || 'Node has an error')
                } else {
                    setConnectionStatus('idle')
                    setErrorDetails(null)
                }
            } else {
                // For new nodes, we can't check status before creation
                setConnectionStatus('idle')
                setErrorDetails(t('nodeModal.statusMessages.checkUnavailableForNew'))
            }
        } catch (error: any) {
            console.error('Node status check failed:', error)
            setConnectionStatus('error')
            setErrorDetails(error?.message || 'Failed to connect to node. Please check your connection settings.')
        } finally {
            setStatusChecking(false)
        }
    }


    const onSubmit = async (values: NodeFormValues) => {
        try {
            // Convert keep_alive to seconds based on unit
            const keepAliveInSeconds = values.keep_alive_unit === 'minutes' ? values.keep_alive * 60 : values.keep_alive_unit === 'hours' ? values.keep_alive * 3600 : values.keep_alive

            const nodeData = {
                ...values,
                keep_alive: keepAliveInSeconds,
                // Remove the unit since backend doesn't need it
                keep_alive_unit: undefined,
            }

            let nodeId: number | undefined

            if (editingNode && editingNodeId) {
                await modifyNodeMutation.mutateAsync({
                    nodeId: editingNodeId,
                    data: nodeData,
                })
                nodeId = editingNodeId
                toast.success(
                    t('nodes.editSuccess', {
                        name: values.name,
                        defaultValue: 'Node «{name}» has been updated successfully',
                    }),
                )
            } else {
                const result = await addNodeMutation.mutateAsync({
                    data: nodeData,
                })
                nodeId = result?.id
                toast.success(
                    t('nodes.createSuccess', {
                        name: values.name,
                        defaultValue: 'Node «{name}» has been created successfully',
                    }),
                )
            }

            // Check status after successful creation/editing
            if (nodeId) {
                setStatusChecking(true)
                try {
                    const node = await getNode(nodeId)
                    if (node && node.status === 'connected') {
                        setConnectionStatus('success')
                    } else if (node && node.status === 'error') {
                        setConnectionStatus('error')
                        setErrorDetails(node?.message || 'Node has an error')
                    } else {
                        setConnectionStatus('idle')
                        setErrorDetails(null)
                    }
                } catch (error: any) {
                    setConnectionStatus('error')
                    setErrorDetails(error?.message || 'Failed to check node status')
                } finally {
                    setStatusChecking(false)
                }
            }

            // Invalidate nodes queries after successful operation
            queryClient.invalidateQueries({ queryKey: ['/api/nodes'] })
            onOpenChange(false)
            form.reset()
        } catch (error: any) {
            const fields = ['name', 'address', 'port', 'core_config_id', 'api_key', 'max_logs', 'keep_alive_unit', 'keep_alive', 'server_ca', 'connection_type', '']
            handleError({ error, fields, form, contextKey: "nodes" })

        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-full sm:max-w-[90vw] lg:max-w-[1000px] h-full lg:h-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle
                        className={cn('text-xl text-start font-semibold', dir === 'rtl' && 'sm:text-right')}>{editingNode ? t('editNode.title') : t('nodeModal.title')}</DialogTitle>
                    <p className={cn('text-sm text-muted-foreground text-start', dir === 'rtl' && 'sm:text-right')}>{editingNode ? t('nodes.prompt') : t('nodeModal.description')}</p>
                </DialogHeader>

                {/* Status Check Results - Positioned at the top of the modal */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-2 h-2 rounded-full ${connectionStatus === 'success'
                                        ? 'bg-green-500 dark:bg-green-400'
                                        : connectionStatus === 'error'
                                            ? 'bg-red-500 dark:bg-red-400'
                                            : connectionStatus === 'checking'
                                                ? 'bg-yellow-500 dark:bg-yellow-400'
                                                : 'bg-gray-500 dark:bg-gray-400'
                                        }`}
                                />
                                <span className="text-sm font-medium text-foreground">
                                    {connectionStatus === 'success'
                                        ? t('nodeModal.status.connected')
                                        : connectionStatus === 'error'
                                            ? t('nodeModal.status.error')
                                            : connectionStatus === 'checking'
                                                ? t('nodeModal.status.connecting')
                                                : t('nodeModal.status.disabled')}
                                </span>
                            </div>
                            {connectionStatus === 'error' && (
                                <Button variant="ghost" size="sm" onClick={() => setShowErrorDetails(!showErrorDetails)}
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                                    {showErrorDetails ? t('nodeModal.hideDetails') : t('nodeModal.showDetails')}
                                </Button>
                            )}
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {editingNode && (
                                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowOnlineStats(true)}
                                        disabled={syncing || reconnecting}
                                        className="h-7 px-2 text-xs flex-shrink-0"
                                    >
                                        <Activity className="!h-3 !w-3 sm:mr-1" />
                                        <span className="hidden sm:inline">{t('nodeModal.onlineStats.button')}</span>
                                        <span className="sm:hidden">{t('nodeModal.onlineStats.button')}</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            if (!editingNodeId) return
                                            setSyncing(true)
                                            try {
                                                await syncNodeMutation.mutateAsync({
                                                    nodeId: editingNodeId,
                                                    params: { flush_users: false }
                                                })
                                                toast.success(t('nodeModal.syncSuccess'))
                                                // Refresh node status after sync
                                                await checkNodeStatus()
                                                // Invalidate queries to refresh data
                                                queryClient.invalidateQueries({ queryKey: ['/api/nodes'] })
                                            } catch (error: any) {
                                                toast.error(t('nodeModal.syncFailed', { 
                                                    message: error?.message || 'Unknown error'
                                                }))
                                            } finally {
                                                setSyncing(false)
                                            }
                                        }}
                                        disabled={syncing || reconnecting}
                                        className="h-7 px-2 text-xs flex-shrink-0"
                                    >
                                        {syncing ? (
                                            <div className="flex items-center gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span className="hidden sm:inline">{t('nodeModal.syncing')}</span>
                                                <span className="sm:hidden">{t('nodeModal.syncing')}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <RotateCcw className="h-3 w-3" />
                                                <span className="hidden sm:inline">{t('nodeModal.sync')}</span>
                                                <span className="sm:hidden">{t('nodeModal.sync')}</span>
                                            </div>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            if (!editingNodeId) return
                                            setReconnecting(true)
                                            try {
                                                await reconnectNode(editingNodeId)
                                                await checkNodeStatus()
                                            } catch (error) {
                                            } finally {
                                                setReconnecting(false)
                                            }
                                        }}
                                        disabled={reconnecting || syncing}
                                        className="h-7 px-2 text-xs flex-shrink-0"
                                    >
                                        {reconnecting ? (
                                            <div className="flex items-center gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span className="hidden sm:inline">{t('nodeModal.reconnecting')}</span>
                                                <span className="sm:hidden">{t('nodeModal.reconnecting')}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <Wifi className="h-3 w-3" />
                                                <span className="hidden sm:inline">{t('nodeModal.reconnect')}</span>
                                                <span className="sm:hidden">{t('nodeModal.reconnect')}</span>
                                            </div>
                                        )}
                                    </Button>
                                </div>
                            )}
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={checkNodeStatus}
                                disabled={statusChecking || !form.formState.isValid || syncing || reconnecting} 
                                className="h-7 px-2 text-xs flex-shrink-0 w-full sm:w-auto"
                            >
                                {statusChecking ? (
                                    <div className="flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span className="hidden sm:inline">{t('nodeModal.statusChecking')}</span>
                                        <span className="sm:hidden">{t('nodeModal.statusChecking')}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <RefreshCw className="h-3 w-3" />
                                        <span className="hidden sm:inline">{t('nodeModal.statusCheck')}</span>
                                        <span className="sm:hidden">{t('nodeModal.statusCheck')}</span>
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>
                    {showErrorDetails && connectionStatus === 'error' && (
                        <div
                            className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded whitespace-pre-wrap break-words max-h-32 overflow-y-auto"
                            style={{ whiteSpace: 'pre-line' }}
                        >
                            {errorDetails}
                        </div>
                    )}
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
                        <div className="max-h-[49dvh] overflow-y-auto pr-2 -mr-2 sm:pr-4 sm:-mr-4 sm:max-h-[65dvh] px-1 sm:px-2">
                            <div className="flex h-full flex-col lg:flex-row items-start gap-4">
                                <div className="flex-1 space-y-4 w-full">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('nodeModal.name')}</FormLabel>
                                                <FormControl>
                                                    <Input isError={!!form.formState.errors.name}
                                                        placeholder={t('nodeModal.namePlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('nodeModal.address')}</FormLabel>
                                                    <FormControl>
                                                        <Input isError={!!form.formState.errors.address}
                                                            placeholder={t('nodeModal.addressPlaceholder')} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="port"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('nodeModal.port')}</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            isError={!!form.formState.errors.port}
                                                            type="number"
                                                            placeholder={t('nodeModal.portPlaceholder')}
                                                            {...field}
                                                            onChange={e => field.onChange(parseInt(e.target.value))}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="core_config_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('nodeModal.coreConfig')}</FormLabel>
                                                <Select onValueChange={value => field.onChange(parseInt(value))}
                                                    value={field.value?.toString()}
                                                    defaultValue={cores?.cores?.[0]?.id.toString()}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('nodeModal.selectCoreConfig')} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {cores?.cores?.map((core: CoreResponse) => (
                                                            <SelectItem key={core.id} value={core.id.toString()}>
                                                                {core.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="api_key"
                                        render={({ field }) => {
                                            const [uuidVersion, setUuidVersion] = useState<'v4' | 'v5' | 'v6' | 'v7'>('v4')

                                            const generateUUID = () => {
                                                switch (uuidVersion) {
                                                    case 'v4':
                                                        field.onChange(uuidv4())
                                                        break
                                                    case 'v5':
                                                        // Using a fixed namespace for v5 UUIDs
                                                        const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
                                                        field.onChange(uuidv5(field.value || 'default', namespace))
                                                        break
                                                    case 'v6':
                                                        field.onChange(uuidv6())
                                                        break
                                                    case 'v7':
                                                        field.onChange(uuidv7())
                                                        break
                                                }
                                            }

                                            return (
                                                <FormItem className={'min-h-[100px]'}>
                                                    <FormLabel>{t('nodeModal.apiKey')}</FormLabel>
                                                    <FormControl>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                isError={!!form.formState.errors.api_key}
                                                                type="text"
                                                                placeholder={t('nodeModal.apiKeyPlaceholder')}
                                                                autoComplete="off"
                                                                {...field}
                                                                onChange={e => field.onChange(e.target.value)}
                                                            />
                                                                                                        <div
                                                className={cn('flex items-center gap-0', dir === 'rtl' && 'flex-row-reverse')}>
                                                <Select value={uuidVersion}
                                                    onValueChange={(value: 'v4' | 'v5' | 'v6' | 'v7') => setUuidVersion(value)}>
                                                    <SelectTrigger
                                                        className="w-[60px] h-10 rounded-r-none border-r-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="v4">v4</SelectItem>
                                                        <SelectItem value="v5">v5</SelectItem>
                                                        <SelectItem value="v6">v6</SelectItem>
                                                        <SelectItem value="v7">v7</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button type="button" variant="outline"
                                                    onClick={generateUUID}
                                                    className="rounded-l-none h-10 px-3">
                                                    <RefreshCw className="h-3 w-3" />
                                                </Button>
                                            </div>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )
                                        }}
                                    />

                                    <Accordion type="single" collapsible className="w-full mb-4 mt-0 pb-4">
                                        <AccordionItem className="border px-4 rounded-sm [&_[data-state=open]]:no-underline [&_[data-state=closed]]:no-underline" value="advanced-settings">
                                            <AccordionTrigger>
                                                <div className="flex items-center gap-2">
                                                    <Settings className="h-4 w-4" />
                                                    <span>{t('settings.notifications.advanced.title')}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-2">
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="usage_coefficient"
                                                            render={({ field }) => (
                                                                <FormItem className="flex-1">
                                                                    <FormLabel>{t('nodeModal.usageRatio')}</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            isError={!!form.formState.errors.usage_coefficient}
                                                                            type="number"
                                                                            step="0.1"
                                                                            placeholder={t('nodeModal.usageRatioPlaceholder')}
                                                                            {...field}
                                                                            onChange={e => field.onChange(parseFloat(e.target.value))}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={form.control}
                                                            name="max_logs"
                                                            render={({ field }) => (
                                                                <FormItem className="flex-1">
                                                                    <FormLabel>{t('nodes.maxLogs')}</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            isError={!!form.formState.errors.max_logs}
                                                                            type="number"
                                                                            placeholder={t('nodes.maxLogsPlaceholder')}
                                                                            {...field}
                                                                            onChange={e => field.onChange(parseInt(e.target.value))}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    <FormField
                                                        control={form.control}
                                                        name="connection_type"
                                                        render={({ field }) => (
                                                            <FormItem className="w-full">
                                                                <FormLabel>{t('nodeModal.connectionType')}</FormLabel>
                                                                <Select onValueChange={field.onChange}
                                                                    defaultValue={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Rest" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem
                                                                            value={NodeConnectionType.grpc}>gRPC</SelectItem>
                                                                        <SelectItem
                                                                            value={NodeConnectionType.rest}>Rest</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="keep_alive"
                                                        render={({ field }) => {
                                                            const [displayValue, setDisplayValue] = useState<string>(field.value?.toString() || '')
                                                            const [unit, setUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds')

                                                            const convertToSeconds = (value: number, fromUnit: 'seconds' | 'minutes' | 'hours') => {
                                                                switch (fromUnit) {
                                                                    case 'minutes':
                                                                        return value * 60
                                                                    case 'hours':
                                                                        return value * 3600
                                                                    default:
                                                                        return value
                                                                }
                                                            }

                                                            const convertFromSeconds = (seconds: number, toUnit: 'seconds' | 'minutes' | 'hours') => {
                                                                switch (toUnit) {
                                                                    case 'minutes':
                                                                        return Math.floor(seconds / 60)
                                                                    case 'hours':
                                                                        return Math.floor(seconds / 3600)
                                                                    default:
                                                                        return seconds
                                                                }
                                                            }

                                                            return (
                                                                <FormItem>
                                                                    <FormLabel>{t('nodeModal.keepAlive')}</FormLabel>
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <p className="text-xs text-muted-foreground">{t('nodeModal.keepAliveDescription')}</p>
                                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                                            <FormControl>
                                                                                <Input
                                                                                    isError={!!form.formState.errors.keep_alive}
                                                                                    type="number"
                                                                                    value={displayValue}
                                                                                    onChange={e => {
                                                                                        const value = e.target.value
                                                                                        setDisplayValue(value)
                                                                                        const numValue = parseInt(value) || 0
                                                                                        field.onChange(convertToSeconds(numValue, unit))
                                                                                    }}
                                                                                />
                                                                            </FormControl>
                                                                            <Select
                                                                                value={unit}
                                                                                onValueChange={(value: 'seconds' | 'minutes' | 'hours') => {
                                                                                    setUnit(value)
                                                                                    const currentSeconds = field.value || 0
                                                                                    const newDisplayValue = convertFromSeconds(currentSeconds, value)
                                                                                    setDisplayValue(newDisplayValue.toString())
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="flex-1">
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem
                                                                                        value="seconds">{t('nodeModal.seconds')}</SelectItem>
                                                                                    <SelectItem
                                                                                        value="minutes">{t('nodeModal.minutes')}</SelectItem>
                                                                                    <SelectItem
                                                                                        value="hours">{t('nodeModal.hours')}</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )
                                                        }}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="gather_logs"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">
                                                                        {t('nodeModal.gatherLogs')}
                                                                    </FormLabel>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {t('nodeModal.gatherLogsDescription')}
                                                                    </p>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="server_ca"
                                    render={({ field }) => (
                                        <FormItem className="flex-1 w-full pb-4 lg:mb-0 h-full">
                                            <FormLabel>{t('nodeModal.certificate')}</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    dir="ltr"
                                                    placeholder={t('nodeModal.certificatePlaceholder')}
                                                    className={cn('font-mono text-xs h-[200px] lg:h-5/6', !!form.formState.errors.server_ca && 'border-destructive')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                            <Button 
                                variant="outline" 
                                onClick={() => onOpenChange(false)}
                                disabled={addNodeMutation.isPending || modifyNodeMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                {t('cancel')}
                            </Button>
                            <LoaderButton
                                type="submit"
                                disabled={addNodeMutation.isPending || modifyNodeMutation.isPending}
                                isLoading={addNodeMutation.isPending || modifyNodeMutation.isPending}
                                loadingText={editingNode ? t('modifying') : t('creating')}
                                className="w-full sm:w-auto"
                            >
                                {editingNode ? t('modify') : t('create')}
                            </LoaderButton>
                        </div>
                    </form>
                </Form>
            </DialogContent>

            {/* User Online Stats Dialog */}
            <UserOnlineStatsDialog
                isOpen={showOnlineStats}
                onOpenChange={setShowOnlineStats}
                nodeId={editingNodeId || null}
                nodeName={form.getValues('name')}
            />
        </Dialog>
    )
}
