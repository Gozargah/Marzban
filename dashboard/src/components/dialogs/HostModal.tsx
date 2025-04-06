import { UseFormReturn } from "react-hook-form"
import { HostFormValues } from "../hosts/Hosts"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { getInbounds, UserStatus } from "@/service/api"
import { Cable, ChevronsLeftRightEllipsis, GlobeLock, Lock, Plus, Trash2, Network, Info } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import useDirDetection from "@/hooks/use-dir-detection"
import { queryClient } from "@/utils/query-client"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface HostModalProps {
    isDialogOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: HostFormValues) => Promise<{ status: number }>;
    editingHost?: boolean;
    form: UseFormReturn<HostFormValues>;
}

// Update status options constant
const statusOptions = [
    { value: UserStatus.active, label: 'hostsDialog.status.active' },
    { value: UserStatus.disabled, label: 'hostsDialog.status.disabled' },
    { value: UserStatus.limited, label: 'hostsDialog.status.limited' },
    { value: UserStatus.expired, label: 'hostsDialog.status.expired' },
    { value: UserStatus.on_hold, label: 'hostsDialog.status.onHold' },
] as const;

const HostModal: React.FC<HostModalProps> = ({
    isDialogOpen,
    onOpenChange,
    onSubmit,
    editingHost,
    form
}) => {
    const [openSection, setOpenSection] = useState<string | undefined>(undefined);
    const { t } = useTranslation();
    const dir = useDirDetection();

    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            // Let the parent component handle the form reset
            setOpenSection(undefined);
        }
        onOpenChange(open);
    };

    const { data: inbounds = [] } = useQuery({
        queryKey: ["getInboundsQueryKey"],
        queryFn: () => getInbounds(),
    });

    const handleAccordionChange = (value: string) => {
        setOpenSection((prevSection) => (prevSection === value ? undefined : value));
    };

    const handleSubmit = async (data: HostFormValues) => {
        try {
            const response = await onSubmit(data);
            if (response.status >= 400) {
                throw new Error(`Operation failed with status: ${response.status}`);
            }
            // Only show success toast and close modal if the operation was successful
            toast({
                dir,
                description: t(editingHost
                    ? "hostsDialog.editSuccess"
                    : "hostsDialog.createSuccess",
                    { name: data.remark }
                ),
            });
            // Close the modal
            handleModalOpenChange(false);
            // The form reset is handled by the parent component
            // Invalidate hosts query to refresh the list
            queryClient.invalidateQueries({
                queryKey: ["getGetHostsQueryKey"],
            });
        } catch (error) {
            // Show error toast if the operation failed
            toast({
                dir,
                variant: "destructive",
                description: t(editingHost
                    ? "hostsDialog.editFailed"
                    : "hostsDialog.createFailed",
                    { name: data.remark }
                ),
            });
            // Don't close the modal or reset the form on error
        }
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={handleModalOpenChange}>
            <DialogContent className="w-full h-full max-w-2xl md:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className={cn(dir === "rtl" ? "text-right" : "text-left")}>{editingHost ? t("editHost.title") : t("hostsDialog.addHost")}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="inbound_tag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("inbound")}</FormLabel>
                                    <Select dir={dir} onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="py-5">
                                                <SelectValue placeholder={t("hostsDialog.selectInbound")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent dir="ltr">
                                            {inbounds.map((tag) => (
                                                <SelectItem className="px-4 cursor-pointer" value={tag} key={tag}>{tag}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("hostsDialog.status.label")}</FormLabel>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap gap-1">
                                            {field.value && field.value.length > 0 ? (
                                                field.value.map((status) => {
                                                    const option = statusOptions.find(opt => opt.value === status);
                                                    if (!option) return null;
                                                    return (
                                                        <span key={status} className="bg-muted/80 px-2 py-1 rounded-md text-sm flex items-center gap-2">
                                                            {t(option.label)}
                                                            <button
                                                                type="button"
                                                                className="hover:text-destructive"
                                                                onClick={() => {
                                                                    field.onChange(field.value.filter(s => s !== status));
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-muted-foreground text-sm">{t("hostsDialog.noStatus")}</span>
                                            )}
                                        </div>
                                        <Select
                                            value=""
                                            onValueChange={(value: UserStatus) => {
                                                if (!value) return;
                                                const currentValue = field.value || [];
                                                if (!currentValue.includes(value)) {
                                                    field.onChange([...currentValue, value]);
                                                }
                                            }}
                                        >
                                            <FormControl>
                                                <SelectTrigger dir={dir} className="w-full py-5">
                                                    <SelectValue placeholder={t("hostsDialog.selectStatus")} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent dir={dir} className="bg-background">
                                                {statusOptions.map((option) => (
                                                    <SelectItem
                                                        key={option.value}
                                                        value={option.value}
                                                        className="flex items-center gap-2 py-2 px-4 cursor-pointer focus:bg-accent"
                                                        disabled={field.value?.includes(option.value)}
                                                    >
                                                        <div className="flex items-center gap-3 w-full">
                                                            <Checkbox
                                                                checked={field.value?.includes(option.value)}
                                                                className="h-4 w-4"
                                                            />
                                                            <span className="font-normal text-sm">{t(option.label)}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
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
                                                {t("hostsDialog.clearAllStatuses")}
                                            </Button>
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="remark"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-2">
                                        <FormLabel>{t("remark")}</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 p-0 hover:bg-transparent"
                                                >
                                                    <Info className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                className="w-[320px] p-3"
                                                side="right"
                                                align="start"
                                                sideOffset={5}
                                            >
                                                <div className="space-y-1.5">
                                                    <h4 className="font-medium text-[12px] mb-2">{t("hostsDialog.variables.title")}</h4>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{SERVER_IP}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.server_ip")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{SERVER_IPV6}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.server_ipv6")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{USERNAME}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.username")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DATA_USAGE}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.data_usage")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DATA_LEFT}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.data_left")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DATA_LIMIT}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.data_limit")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DAYS_LEFT}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.days_left")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{EXPIRE_DATE}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.expire_date")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{JALALI_EXPIRE_DATE}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.jalali_expire_date")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{TIME_LEFT}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.time_left")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{STATUS_TEXT}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.status_text")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{STATUS_EMOJI}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.status_emoji")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{PROTOCOL}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.protocol")}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{TRANSPORT}"}</code>
                                                            <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.transport")}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <FormControl>
                                        <Input placeholder="Remark (e.g. Marzban-Host)" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex items-center gap-4 justify-between">
                            <div className="flex-[2]">
                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center gap-2">

                                                <FormLabel>{t("hostsDialog.address")}</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-4 w-4 p-0 hover:bg-transparent"
                                                        >
                                                            <Info className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-[320px] p-3"
                                                        side="right"
                                                        align="start"
                                                        sideOffset={5}
                                                    >
                                                        <div className="space-y-1.5">
                                                            <h4 className="font-medium text-[12px] mb-2">{t("hostsDialog.variables.title")}</h4>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{SERVER_IP}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.server_ip")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{SERVER_IPV6}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.server_ipv6")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{USERNAME}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.username")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DATA_USAGE}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.data_usage")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DATA_LEFT}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.data_left")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DATA_LIMIT}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.data_limit")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{DAYS_LEFT}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.days_left")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{EXPIRE_DATE}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.expire_date")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{JALALI_EXPIRE_DATE}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.jalali_expire_date")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{TIME_LEFT}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.time_left")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{STATUS_TEXT}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.status_text")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{STATUS_EMOJI}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.status_emoji")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{PROTOCOL}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.protocol")}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded-sm">{"{TRANSPORT}"}</code>
                                                                    <span className="text-[11px] text-muted-foreground">{t("hostsDialog.variables.transport")}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <FormControl>
                                                <Input placeholder="" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex-1">
                                <FormField
                                    control={form.control}
                                    name="port"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center gap-2">
                                                <FormLabel>{t("hostsDialog.port")}</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-4 w-4 p-0 hover:bg-transparent"
                                                        >
                                                            <Info className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[320px] p-3" side="right" align="start" sideOffset={5}>
                                                        <p className="text-[11px] text-muted-foreground">{t("hostsDialog.port.info")}</p>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <FormControl>
                                                <Input
                                                    placeholder="443"
                                                    type="number"
                                                    {...field}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value ? Number.parseInt(e.target.value, 10) : undefined)
                                                    }
                                                    value={field.value ?? ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <Accordion
                            type="single"
                            collapsible
                            value={openSection}
                            onValueChange={handleAccordionChange}
                            className="w-full flex flex-col gap-y-6 mb-6 pt-6"
                        >
                            <AccordionItem className="border px-4 rounded-sm" value="network">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <GlobeLock className="h-4 w-4" />
                                        <span>{t("hostsDialog.networkSettings")}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-2">
                                    <div className="w-full space-y-4">
                                        <div className="flex items-center gap-4 w-full">
                                            <FormField
                                                control={form.control}
                                                name="host"
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <FormLabel>{t("hostsDialog.host")}</FormLabel>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-4 w-4 p-0 hover:bg-transparent"
                                                                    >
                                                                        <Info className="h-4 w-4 text-muted-foreground" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[320px] p-3" side="right" align="start" sideOffset={5}>
                                                                    <div className="space-y-1.5">
                                                                        <p className="text-[11px] text-muted-foreground">{t("hostsDialog.host.info")}</p>
                                                                        <p className="text-[11px] text-muted-foreground">{t("hostsDialog.host.multiHost")}</p>
                                                                        <p className="text-[11px] text-muted-foreground">{t("hostsDialog.host.wildcard")}</p>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                        <FormControl>
                                                            <Input placeholder="Host (e.g. example.com)" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="path"
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <FormLabel>{t("hostsDialog.path")}</FormLabel>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-4 w-4 p-0 hover:bg-transparent"
                                                                    >
                                                                        <Info className="h-4 w-4 text-muted-foreground" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[320px] p-3" side="right" align="start" sideOffset={5}>
                                                                    <p className="text-[11px] text-muted-foreground">{t("hostsDialog.path.info")}</p>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                        <FormControl>
                                                            <Input placeholder="Path (e.g. /xray)" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium">{t("hostsDialog.httpHeaders")}</h4>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => {
                                                            const currentHeaders = form.getValues("http_headers") || {};
                                                            const newHeaders = { ...currentHeaders };
                                                            const newKey = `header_${Object.keys(currentHeaders).length}`;
                                                            newHeaders[newKey] = "";
                                                            form.setValue("http_headers", newHeaders, {
                                                                shouldDirty: true,
                                                                shouldTouch: true
                                                            });
                                                        }}
                                                        title={t("hostsDialog.addHeader")}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {Object.entries(form.watch("http_headers") || {}).map(([key, value], index) => (
                                                    <div key={`${key}_${index}`} className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                placeholder={t("hostsDialog.headersName")}
                                                                value={key}
                                                                onChange={(e) => {
                                                                    const currentHeaders = { ...form.getValues("http_headers") };
                                                                    const oldValue = currentHeaders[key];
                                                                    delete currentHeaders[key];
                                                                    currentHeaders[e.target.value] = oldValue;
                                                                    form.setValue("http_headers", currentHeaders, {
                                                                        shouldDirty: true,
                                                                        shouldTouch: true
                                                                    });
                                                                }}
                                                            />
                                                            <Input
                                                                placeholder={t("hostsDialog.headersValue")}
                                                                value={value}
                                                                onChange={(e) => {
                                                                    const currentHeaders = { ...form.getValues("http_headers") };
                                                                    currentHeaders[key] = e.target.value;
                                                                    form.setValue("http_headers", currentHeaders, {
                                                                        shouldDirty: true,
                                                                        shouldTouch: true
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 border-red-500"
                                                            onClick={() => {
                                                                const currentHeaders = { ...form.getValues("http_headers") };
                                                                delete currentHeaders[key];
                                                                form.setValue("http_headers", currentHeaders, {
                                                                    shouldDirty: true,
                                                                    shouldTouch: true
                                                                });
                                                            }}
                                                            title={t("hostsDialog.removeHeader")}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem className="border px-4 rounded-sm" value="security">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Lock className="h-4 w-4" />
                                        <span>{t("hostsDialog.securitySettings")}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-2">
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="security"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center gap-2">
                                                        <FormLabel>{t("hostsDialog.security")}</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 p-0 hover:bg-transparent"
                                                                >
                                                                    <Info className="h-4 w-4 text-muted-foreground" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[320px] p-3" side="right" align="start" sideOffset={5}>
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.security.info")}</p>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="none">None</SelectItem>
                                                            <SelectItem value="tls">TLS</SelectItem>
                                                            <SelectItem value="inbound_default">Inbound's default</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="sni"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center gap-2">
                                                        <FormLabel>{t("hostsDialog.sni")}</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 p-0 hover:bg-transparent"
                                                                >
                                                                    <Info className="h-4 w-4 text-muted-foreground" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[320px] p-3" side="right" align="start" sideOffset={5}>
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.sni.info")}</p>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <FormControl>
                                                        <Input placeholder={t("hostsDialog.sniPlaceholder")} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="alpn"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("hostsDialog.alpn")}</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={t("hostsDialog.selectALPN")} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="">{t("default")}</SelectItem>
                                                            <SelectItem value="h3">h3</SelectItem>
                                                            <SelectItem value="h2">h2</SelectItem>
                                                            <SelectItem value="http/1.1">http/1.1</SelectItem>
                                                            <SelectItem value="h3,h2,http/1.1">h3,h2,http/1.1</SelectItem>
                                                            <SelectItem value="h3,h2">h3,h2</SelectItem>
                                                            <SelectItem value="h2,http/1.1">h2,http/1.1</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="fingerprint"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("hostsDialog.fingerprint")}</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={t("hostsDialog.selectFingerprint")} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="">{t("default")}</SelectItem>
                                                            <SelectItem value="chrome">{t("chrome")}</SelectItem>
                                                            <SelectItem value="firefox">{t("firefox")}</SelectItem>
                                                            <SelectItem value="safari">{t("safari")}</SelectItem>
                                                            <SelectItem value="ios">{t("ios")}</SelectItem>
                                                            <SelectItem value="android">{t("android")}</SelectItem>
                                                            <SelectItem value="edge">{t("edge")}</SelectItem>
                                                            <SelectItem value="360">{t("360")}</SelectItem>
                                                            <SelectItem value="qq">{t("qq")}</SelectItem>
                                                            <SelectItem value="random">{t("random")}</SelectItem>
                                                            <SelectItem value="randomized">{t("randomized")}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="allowinsecure"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base">
                                                            {t("hostsDialog.allowInsecure")}
                                                        </FormLabel>
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

                            <AccordionItem className="border px-4 rounded-sm" value="camouflag">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <ChevronsLeftRightEllipsis className="h-4 w-4" />
                                        <span>{t("hostsDialog.camouflagSettings")}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-2">
                                    <div className="space-y-6">
                                        {/* Fragment Settings */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium flex items-center gap-2">
                                                    {t("hostsDialog.fragment.title")}
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4 p-0 hover:bg-transparent"
                                                            >
                                                                <Info className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[320px] p-3" side="right" align="start" sideOffset={5}>
                                                            <div className="space-y-1.5">
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.fragment.info")}</p>
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.fragment.info.attention")}</p>
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.fragment.info.examples")}</p>
                                                                <p className="text-[11px] overflow-hidden text-muted-foreground">
                                                                    100-200,10-20,tlshello
                                                                    100-200,10-20,1-3
                                                                </p>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </h4>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="fragment_settings.xray.packets"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.fragment.packets")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder={t("hostsDialog.fragment.packetsPlaceholder")}
                                                                    {...field}
                                                                    value={field.value || ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="fragment_settings.xray.length"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.fragment.length")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder={t("hostsDialog.fragment.lengthPlaceholder")}
                                                                    {...field}
                                                                    value={field.value || ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="fragment_settings.xray.interval"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.fragment.interval")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder={t("hostsDialog.fragment.intervalPlaceholder")}
                                                                    {...field}
                                                                    value={field.value || ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        {/* Noise Settings */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-medium">{t("hostsDialog.noise.title")}</h4>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4 p-0 hover:bg-transparent"
                                                            >
                                                                <Info className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[320px] p-3" side="right" align="start" sideOffset={5}>
                                                            <div className="space-y-1.5">
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.noise.info")}</p>
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.noise.info.attention")}</p>
                                                                <p className="text-[11px] text-muted-foreground">{t("hostsDialog.noise.info.examples")}</p>
                                                                <p className="text-[11px] overflow-hidden text-muted-foreground">
                                                                    rand:10-20,10-20
                                                                    rand:10-20,10-20
                                                                    &base64:7nQBAAABAAAAAAAABnQtcmluZwZtc2VkZ2UDbmV0AAABAAE=,10-25</p>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => {
                                                        const currentNoiseSettings = form.getValues("noise_settings.xray") || [];
                                                        form.setValue("noise_settings.xray", [...currentNoiseSettings, { type: "", packet: "", delay: "" }], {
                                                            shouldDirty: true,
                                                            shouldTouch: true
                                                        });
                                                    }}
                                                    title={t("hostsDialog.noise.addNoise")}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                {(form.watch("noise_settings.xray") || []).map((_, index) => (
                                                    <div key={index} className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Select
                                                                value={form.watch(`noise_settings.xray.${index}.type`) || ""}
                                                                onValueChange={(value) => {
                                                                    form.setValue(`noise_settings.xray.${index}.type`, value, {
                                                                        shouldDirty: true,
                                                                        shouldTouch: true
                                                                    });
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-[120px]">
                                                                    <SelectValue placeholder="Type" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="rand">rand</SelectItem>
                                                                    <SelectItem value="str">str</SelectItem>
                                                                    <SelectItem value="base64">base64</SelectItem>
                                                                    <SelectItem value="hex">hex</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Select
                                                                value={form.watch(`noise_settings.xray.${index}.packet`) || ""}
                                                                onValueChange={(value) => {
                                                                    form.setValue(`noise_settings.xray.${index}.packet`, value, {
                                                                        shouldDirty: true,
                                                                        shouldTouch: true
                                                                    });
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-[180px]">
                                                                    <SelectValue placeholder={t("hostsDialog.noise.packetPlaceholder")} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="rand">{t("hostsDialog.noise.rand")}</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Input
                                                                placeholder={t("hostsDialog.noise.delayPlaceholder")}
                                                                value={form.watch(`noise_settings.xray.${index}.delay`) || ""}
                                                                onChange={(e) => {
                                                                    form.setValue(`noise_settings.xray.${index}.delay`, e.target.value, {
                                                                        shouldDirty: true,
                                                                        shouldTouch: true
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 border-red-500"
                                                            onClick={() => {
                                                                const currentNoiseSettings = [...(form.getValues("noise_settings.xray") || [])];
                                                                currentNoiseSettings.splice(index, 1);
                                                                form.setValue("noise_settings.xray", currentNoiseSettings, {
                                                                    shouldDirty: true,
                                                                    shouldTouch: true
                                                                });
                                                            }}
                                                            title={t("hostsDialog.noise.removeNoise")}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem className="border px-4 rounded-sm" value="transport">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Network className="h-4 w-4" />
                                        <span>{t("hostsDialog.transportSettingsAccordion")}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        <Tabs defaultValue="xhttp" className="w-full">
                                            <TabsList className="grid grid-cols-5 mb-4">
                                                <TabsTrigger value="xhttp">XHTTP</TabsTrigger>
                                                <TabsTrigger value="grpc">gRPC</TabsTrigger>
                                                <TabsTrigger value="kcp">KCP</TabsTrigger>
                                                <TabsTrigger value="tcp">TCP</TabsTrigger>
                                                <TabsTrigger value="websocket">WebSocket</TabsTrigger>
                                            </TabsList>

                                            {/* XHTTP Settings */}
                                            <TabsContent dir={dir} value="xhttp" className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.xhttp_settings.mode"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.xhttp.mode")}</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="auto">Auto</SelectItem>
                                                                    <SelectItem value="packet-up">Packet Up</SelectItem>
                                                                    <SelectItem value="stream-up">Stream Up</SelectItem>
                                                                    <SelectItem value="stream-one">Stream One</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.xhttp_settings.no_grpc_header"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-base">{t("hostsDialog.xhttp.noGrpcHeader")}</FormLabel>
                                                            </div>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.xhttp_settings.x_padding_bytes"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.xhttp.xPaddingBytes")}</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.xhttp_settings.sc_max_each_post_bytes"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.xhttp.scMaxEachPostBytes")}</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.xhttp_settings.sc_min_posts_interval_ms"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.xhttp.scMinPostsIntervalMs")}</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.xhttp_settings.sc_max_buffered_posts"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.xhttp.scMaxBufferedPosts")}</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.xhttp_settings.sc_stream_up_server_secs"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.xhttp.scStreamUpServerSecs")}</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className="space-y-4 border p-4 rounded-md">
                                                    <h4 className="text-sm font-medium">{t("hostsDialog.xhttp.xmux")}</h4>

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.xhttp_settings.xmux.max_concurrency"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xhttp.maxConcurrency")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.xhttp_settings.xmux.max_connections"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xhttp.maxConnections")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.xhttp_settings.xmux.c_max_reuse_times"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xhttp.cMaxReuseTimes")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.xhttp_settings.xmux.c_max_lifetime"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xhttp.cMaxLifetime")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.xhttp_settings.xmux.h_max_request_times"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xhttp.hMaxRequestTimes")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.xhttp_settings.xmux.h_keep_alive_period"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xhttp.hKeepAlivePeriod")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </TabsContent>

                                            {/* gRPC Settings */}
                                            <TabsContent dir={dir} value="grpc" className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.grpc_settings.multi_mode"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-base">{t("hostsDialog.grpc.multiMode")}</FormLabel>
                                                            </div>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.grpc_settings.idle_timeout"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.grpc.idleTimeout")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.grpc_settings.health_check_timeout"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.grpc.healthCheckTimeout")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.grpc_settings.permit_without_stream"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.grpc.permitWithoutStream")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.grpc_settings.initial_windows_size"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.grpc.initialWindowsSize")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TabsContent>

                                            {/* KCP Settings */}
                                            <TabsContent dir={dir} value="kcp" className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.header"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.header")}</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="none">None</SelectItem>
                                                                    <SelectItem value="srtp">SRTP</SelectItem>
                                                                    <SelectItem value="utp">uTP</SelectItem>
                                                                    <SelectItem value="wechat-video">WeChat Video</SelectItem>
                                                                    <SelectItem value="dtls">DTLS</SelectItem>
                                                                    <SelectItem value="wireguard">WireGuard</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.mtu"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.mtu")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.tti"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.tti")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.uplink_capacity"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.uplinkCapacity")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.downlink_capacity"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.downlinkCapacity")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.congestion"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.congestion")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.read_buffer_size"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.readBufferSize")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.kcp_settings.write_buffer_size"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.kcp.writeBufferSize")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TabsContent>

                                            {/* TCP Settings */}
                                            <TabsContent dir={dir} value="tcp" className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.tcp_settings.header"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.tcp.header")}</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="none">None</SelectItem>
                                                                    <SelectItem value="http">HTTP</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className="space-y-4 border p-4 rounded-md">
                                                    <h4 className="text-sm font-medium">{t("hostsDialog.tcp.request")}</h4>

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.tcp_settings.request.version"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.tcp.version")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.tcp_settings.request.method"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.tcp.method")}</FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="GET">GET</SelectItem>
                                                                        <SelectItem value="POST">POST</SelectItem>
                                                                        <SelectItem value="PUT">PUT</SelectItem>
                                                                        <SelectItem value="DELETE">DELETE</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <div className="space-y-4 border p-4 rounded-md">
                                                    <h4 className="text-sm font-medium">{t("hostsDialog.tcp.response")}</h4>

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.tcp_settings.response.version"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.tcp.version")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.tcp_settings.response.status"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.tcp.status")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="transport_settings.tcp_settings.response.reason"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.tcp.reason")}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </TabsContent>

                                            {/* WebSocket Settings */}
                                            <TabsContent dir={dir} value="websocket" className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="transport_settings.websocket_settings.heartbeatPeriod"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.websocket.heartbeatPeriod")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                                                    value={field.value}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem className="border px-4 rounded-sm" value="mux">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Cable className="h-4 w-4" />
                                        <span>{t("hostsDialog.muxSettings")}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-2">
                                    <div className="space-y-4">
                                        <Tabs defaultValue="xray" className="w-full">
                                            <TabsList className="grid grid-cols-3 mb-4">
                                                <TabsTrigger value="xray">Xray</TabsTrigger>
                                                <TabsTrigger value="sing_box">Sing-box</TabsTrigger>
                                                <TabsTrigger value="clash">Clash</TabsTrigger>
                                            </TabsList>

                                            {/* Xray Settings */}
                                            <TabsContent dir={dir} value="xray">
                                                <div className="border p-4 rounded-md space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.xray.concurrency"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.concurrency")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.xray.xudp_concurrency"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xudpConcurrency")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.xray.xudp_proxy_443"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.xudpProxy443")}</FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value ?? ""}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder={t("hostsDialog.selectXudpProxy443")} />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="reject">Reject</SelectItem>
                                                                        <SelectItem value="accept">Accept</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </TabsContent>

                                            {/* Sing-box Settings */}
                                            <TabsContent dir={dir} value="sing_box">
                                                <div className="border p-4 rounded-md space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.sing_box.protocol"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.protocol")}</FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value ?? "null"}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder={t("hostsDialog.selectProtocol")} />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="null">{t("none")}</SelectItem>
                                                                        <SelectItem value="h2mux">h2mux</SelectItem>
                                                                        <SelectItem value="smux">smux</SelectItem>
                                                                        <SelectItem value="yamux">yamux</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.sing_box.max_connections"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.maxConnections")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value || ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.sing_box.min_streams"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.minStreams")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value || ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.sing_box.max_streams"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.maxStreams")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value || ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.sing_box.padding"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">{t("hostsDialog.padding")}</FormLabel>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </TabsContent>

                                            {/* Clash Settings */}
                                            <TabsContent dir={dir} value="clash">
                                                <div className="border p-4 rounded-md space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.clash.protocol"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.protocol")}</FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value ?? "null"}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder={t("hostsDialog.selectProtocol")} />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="null">{t("none")}</SelectItem>
                                                                        <SelectItem value="h2">h2</SelectItem>
                                                                        <SelectItem value="smux">smux</SelectItem>
                                                                        <SelectItem value="yamux">yamux</SelectItem>
                                                                        <SelectItem value="h2mux">h2mux</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.clash.max_connections"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.maxConnections")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.clash.max_streams"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.maxStreams")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.clash.min_streams"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t("hostsDialog.minStreams")}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.clash.padding"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">{t("hostsDialog.padding")}</FormLabel>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch
                                                                        checked={field.value ?? false}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.clash.statistic"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">{t("hostsDialog.statistic")}</FormLabel>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch
                                                                        checked={field.value ?? false}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="mux_settings.clash.only_tcp"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">{t("hostsDialog.onlyTcp")}</FormLabel>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch
                                                                        checked={field.value ?? false}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => handleModalOpenChange(false)}>
                                {t("cancel")}
                            </Button>
                            <Button type="submit">
                                {editingHost ? t("edit") : t("create")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default HostModal;