"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { MoreVertical, Pencil, Copy, Trash2, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"

import { HostResponse, ProxyHostFingerprint } from "@/service/api"
import AddHostModal from "../dialogs/AddHostModal"

const hostFormSchema = z.object({
    remark: z.string().min(1, "Remark is required"),
    address: z.string().min(1, "Address is required"),
    inbound_tag: z.string().min(1, "Inbound tag is required"),
    port: z.number().nullable().optional(),
    sni: z.string().nullable(),
    host: z.string().nullable(),
    path: z.string().nullable().optional(),
    security: z.enum(["none", "tls", "inbound_default"]),
    alpn: z.enum([
        "",
        "h3",
        "h2",
        "http/1.1",
        "h3,h2,http/1.1",
        "h3,h2",
        "h2,http/1.1",
    ]),
    fingerprint: z.string(),
    allowinsecure: z.boolean(),
    is_disabled: z.boolean(),
    mux_enable: z.boolean(),
    fragment_setting: z
        .object({
            packets: z.string(),
            length: z.string(),
            interval: z.string(),
        })
        .nullable(),
    random_user_agent: z.boolean(),
    noise_setting: z
        .object({
            noise_pattern: z.string(),
            noise_payload: z.string(),
        })
        .nullable(),
    use_sni_as_host: z.boolean(),
});


export type HostFormValues = z.infer<typeof hostFormSchema>;

interface HostsProps {
    onAddHost: (open: boolean) => void
    isDialogOpen: boolean
}

export default function Hosts({ onAddHost, isDialogOpen }: HostsProps) {
    const [hosts, setHosts] = useState<HostResponse[]>([
        {
            inbound_tag: "inbound1",
            remark: "Main Node",
            address: "192.168.1.1",
            port: 443,
            sni: "example.com",
            host: "host.example.com",
            path: "/ws",
            security: "tls",
            alpn: "h2",
            fingerprint: "random",
            allowinsecure: false,
            is_disabled: false,
            mux_enable: true,
            fragment_setting: "default",
            random_user_agent: true,
            noise_setting: "enabled",
            use_sni_as_host: false,
            id: 1,
        },
        {
            inbound_tag: "inbound2",
            remark: "Backup Node",
            address: "10.10.10.10",
            port: 8080,
            sni: "backup.com",
            host: "backup.host.com",
            path: "/grpc",
            security: "none",
            alpn: "",
            fingerprint: "chrome",
            allowinsecure: true,
            is_disabled: false,
            mux_enable: false,
            fragment_setting: "optimized",
            random_user_agent: false,
            noise_setting: "disabled",
            use_sni_as_host: true,
            id: 2,
        },
    ]);
    const [editingHost, setEditingHost] = useState<HostResponse | null>(null);

    const form = useForm<HostFormValues>({
        resolver: zodResolver(hostFormSchema),
        defaultValues: {
            remark: "",
            address: "",
            inbound_tag: "",
            port: null,
            sni: null,
            host: null,
            path: null,
            security: "none",
            alpn: "h2",
            fingerprint: "",
            allowinsecure: false,
            is_disabled: false,
            mux_enable: false,
            fragment_setting: null,
            random_user_agent: false,
            noise_setting: null,
            use_sni_as_host: false,
        },
    });

    const handleDelete = (id: number) => {
        setHosts(hosts.filter((host) => host.id !== id));
    };

    const handleDuplicate = (host: HostResponse) => {
        const newHost = { ...host, id: Math.max(...hosts.map((h) => h.id), 0) + 1 };
        setHosts([...hosts, newHost]);
    };

    const toggleHostStatus = (id: number) => {
        setHosts(
            hosts.map((host) =>
                host.id === id ? { ...host, is_disabled: !host.is_disabled } : host
            )
        );
    };

    const onSubmit = (data: HostFormValues) => {
        const newHost: HostResponse = {
            ...data,
            id: Math.max(...hosts.map((h) => h.id), 0) + 1,
            fingerprint: data.fingerprint as ProxyHostFingerprint,
            fragment_setting: typeof data.fragment_setting === "string" ? data.fragment_setting : undefined,
            noise_setting: typeof data.noise_setting === "string" ? data.noise_setting : undefined,
            port: data.port ?? undefined,
        };

        if (editingHost) {
            const updatedHosts = hosts.map((host) =>
                host.id === editingHost.id ? { ...host, ...newHost } : host
            );
            setHosts(updatedHosts);
        } else {
            setHosts([...hosts, newHost]);
        }

        setEditingHost(null);
        form.reset();
    };


    return (
        <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {hosts.map((host) => (
                    <Card className="py-2" key={host.id}>
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${host.is_disabled ? "bg-gray-400" : "bg-green-500"}`} />
                                <div>
                                    <div className="font-medium">{host.remark}</div>
                                    <div className="text-sm text-muted-foreground">{host.address}</div>
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => toggleHostStatus(host.id)}>
                                        <Power className="h-4 w-4 mr-2" />
                                        {host.is_disabled ? "Enable" : "Disable"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleDuplicate(host)}>
                                        <Copy className="h-4 w-4 mr-2" />
                                        Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onSelect={() => handleDelete(host.id)}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Trash
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* add props */}
            <AddHostModal
                form={form}
                isDialogOpen={isDialogOpen}
                onSubmit={(data) => onSubmit(data)}
                onOpenChange={(open) => onAddHost(open)}
            />
        </div>
    )
}

