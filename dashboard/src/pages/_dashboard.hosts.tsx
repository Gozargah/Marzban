import PageHeader from '@/components/page-header'
import { Plus } from 'lucide-react'
import MainSection from '@/components/hosts/Hosts'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getHosts, createHost, modifyHost, CreateHost, ProxyHostALPN, ProxyHostFingerprint, MultiplexProtocol, Xudp } from '@/service/api'
import { HostFormValues } from '@/components/hosts/Hosts'

export default function HostsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: ["getGetHostsQueryKey"],
        queryFn: () => getHosts(),
    });

    const handleDialogOpen = (open: boolean) => {
        setIsDialogOpen(open);
    };

    const handleCreateClick = () => {
        setIsDialogOpen(true);
    };

    const onAddHost = async (open: boolean) => {
        setIsDialogOpen(open);
    };

    const handleSubmit = async (formData: HostFormValues) => {
        try {
            // Check if all protocols are set to none
            const allProtocolsNone = formData.mux_settings && 
                (!formData.mux_settings.sing_box?.protocol || formData.mux_settings.sing_box.protocol === 'none') &&
                (!formData.mux_settings.clash?.protocol || formData.mux_settings.clash.protocol === 'none') &&
                (!formData.mux_settings.xray?.concurrency);

            // Convert HostFormValues to CreateHost type
            const hostData: CreateHost = {
                ...formData,
                alpn: formData.alpn as ProxyHostALPN | undefined,
                fingerprint: formData.fingerprint as ProxyHostFingerprint | undefined,
                mux_settings: allProtocolsNone ? undefined : (formData.mux_settings ? {
                    ...formData.mux_settings,
                    sing_box: formData.mux_settings.sing_box ? {
                        protocol: formData.mux_settings.sing_box.protocol === 'none' ? undefined : formData.mux_settings.sing_box.protocol as MultiplexProtocol,
                        max_connections: formData.mux_settings.sing_box.max_connections || undefined,
                        max_streams: formData.mux_settings.sing_box.max_streams || undefined,
                        min_streams: formData.mux_settings.sing_box.min_streams || undefined,
                        padding: formData.mux_settings.sing_box.padding || undefined,
                        brutal: formData.mux_settings.sing_box.brutal || undefined
                    } : undefined,
                    clash: formData.mux_settings.clash ? {
                        protocol: formData.mux_settings.clash.protocol === 'none' ? undefined : formData.mux_settings.clash.protocol as MultiplexProtocol,
                        max_connections: formData.mux_settings.clash.max_connections || undefined,
                        max_streams: formData.mux_settings.clash.max_streams || undefined,
                        min_streams: formData.mux_settings.clash.min_streams || undefined,
                        padding: formData.mux_settings.clash.padding || undefined,
                        brutal: formData.mux_settings.clash.brutal || undefined,
                        statistic: formData.mux_settings.clash.statistic || undefined,
                        only_tcp: formData.mux_settings.clash.only_tcp || undefined
                    } : undefined,
                    xray: formData.mux_settings.xray ? {
                        concurrency: formData.mux_settings.xray.concurrency || undefined,
                        xudp_concurrency: formData.mux_settings.xray.xudp_concurrency || undefined,
                        xudp_proxy_443: formData.mux_settings.xray.xudp_proxy_443 === 'none' ? undefined : formData.mux_settings.xray.xudp_proxy_443 as Xudp
                    } : undefined
                } : undefined),
                fragment_settings: formData.fragment_settings ? {
                    xray: formData.fragment_settings.xray ? {
                        packets: formData.fragment_settings.xray.packets || '',
                        length: formData.fragment_settings.xray.length || '',
                        interval: formData.fragment_settings.xray.interval || ''
                    } : undefined
                } : undefined
            };
            
            // Check if this host already exists by comparing address and port
            const existingHost = data?.find(host => 
                host.address === formData.address && 
                host.port === formData.port
            );
            
            if (existingHost?.id) {
                // This is an edit operation
                const response = await modifyHost(existingHost.id, hostData);
                return { status: 200 };
            } else {
                // This is a new host
                const response = await createHost(hostData);
                return { status: 200 };
            }
        } catch (error) {
            console.error("Error submitting host:", error);
            return { status: 500 };
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="pb-8">
            <PageHeader
                title='hosts'
                description='manageHosts'
                buttonIcon={Plus}
                buttonText='hostsDialog.addHost'
                onButtonClick={handleCreateClick}
            />
            <div>
                <MainSection 
                    data={data || []} 
                    isDialogOpen={isDialogOpen} 
                    onDialogOpenChange={handleDialogOpen}
                    onAddHost={onAddHost}
                    onSubmit={handleSubmit}
                />
            </div>
        </div>
    );
}
