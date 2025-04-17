import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Copy } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { Separator } from '@/components/ui/separator'
import Node from '@/components/nodes/Node'
import { useGetNodes, useModifyNode, NodeResponse, NodeConnectionType, useGetNodeSettings } from '@/service/api'
import { toast } from '@/hooks/use-toast'
import { queryClient } from '@/utils/query-client'
import NodeModal from '@/components/dialogs/NodeModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { nodeFormSchema, NodeFormValues } from '@/components/dialogs/NodeModal'
import { Button } from '@/components/ui/button'

const initialDefaultValues: Partial<NodeFormValues> = {
    name: '',
    address: '',
    port: 62050,
    usage_coefficient: 1,
    connection_type: NodeConnectionType.grpc,
    server_ca: '',
    keep_alive: 20000,
    max_logs: 100,
}

export default function Nodes() {
    const { t } = useTranslation()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingNode, setEditingNode] = useState<NodeResponse | null>(null)
    const modifyNodeMutation = useModifyNode()

    const { data: nodesData, isLoading } = useGetNodes(
        undefined,
        {
            query: {
                refetchInterval: 5000,
                refetchIntervalInBackground: true,
            }
        }   
    )
    const { data: nodeSettings } = useGetNodeSettings()

    const form = useForm<NodeFormValues>({
        resolver: zodResolver(nodeFormSchema),
        defaultValues: initialDefaultValues
    })

    const handleEdit = (node: NodeResponse) => {
        setEditingNode(node)
        form.reset({
            name: node.name,
            address: node.address,
            port: node.port || 62050,
            usage_coefficient: node.usage_coefficient || 1,
            connection_type: node.connection_type,
            server_ca: node.server_ca,
            keep_alive: node.keep_alive,
            max_logs: node.max_logs,
        })
        setIsDialogOpen(true)
    }

    const handleToggleStatus = async (node: NodeResponse) => {
        try {
            await modifyNodeMutation.mutateAsync({
                nodeId: node.id,
                data: {
                    name: node.name,
                    address: node.address,
                    port: node.port,
                    usage_coefficient: node.usage_coefficient,
                    connection_type: node.connection_type,
                    server_ca: node.server_ca,
                    keep_alive: node.keep_alive,
                    max_logs: node.max_logs,
                    status: node.status === "connected" ? "disabled" : "connected"
                }
            })

            toast({
                title: t('success', { defaultValue: 'Success' }),
                description: t(node.status === "connected" ? 'nodes.disableSuccess' : 'nodes.enableSuccess', {
                    name: node.name,
                    defaultValue: `Node "{name}" has been ${node.status === "connected" ? 'disabled' : 'enabled'} successfully`
                })
            })

            // Invalidate nodes queries
            queryClient.invalidateQueries({
                queryKey: ["/api/nodes"],
            })
        } catch (error) {
            toast({
                title: t('error', { defaultValue: 'Error' }),
                description: t(node.status === "connected" ? 'nodes.disableFailed' : 'nodes.enableFailed', {
                    name: node.name,
                    defaultValue: `Failed to ${node.status === "connected" ? 'disable' : 'enable'} node "{name}"`
                }),
                variant: "destructive"
            })
        }
    }

    return (
        <div className="flex flex-col gap-2 w-full items-start">
            <PageHeader
                title="nodes.title"
                description="manageNodes"
                buttonIcon={Plus}
                buttonText="nodes.addNode"
                onButtonClick={() => setIsDialogOpen(true)}
            />
            <Separator />
            <div className="flex-1 space-y-4 p-4 pt-6 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                    {nodesData?.map((node) => (
                        <Node
                            key={node.id}
                            node={node}
                            onEdit={handleEdit}
                            onToggleStatus={handleToggleStatus}
                        />
                    ))}
                </div>

                <NodeModal
                    isDialogOpen={isDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditingNode(null)
                            form.reset(initialDefaultValues)
                        }
                        setIsDialogOpen(open)
                    }}
                    form={form}
                    editingNode={!!editingNode}
                    editingNodeId={editingNode?.id}
                />
            </div>
        </div>
    )
} 