import { UseFormReturn } from "react-hook-form"
import { HostFormValues } from "../hosts/Hosts"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { getInbounds, UserStatus, getHosts } from "@/service/api"
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
    const [isTransportOpen, setIsTransportOpen] = useState(false);
    const { t } = useTranslation();
    const dir = useDirDetection();

    const cleanPayload = (data: any): any => {
        // Helper function to check if an object has any non-empty values
        const hasNonEmptyValues = (obj: any): boolean => {
            if (!obj || typeof obj !== 'object') return false;
            return Object.values(obj).some(value => {
                if (value === null || value === undefined || value === '') return false;
                if (typeof value === 'object') return hasNonEmptyValues(value);
                return true;
            });
        };

        // Helper function to clean nested objects
        const cleanObject = (obj: any, path: string[] = []): any => {
            const result: any = {};
            Object.entries(obj).forEach(([key, value]) => {
                const currentPath = [...path, key];
                if (value === null || value === undefined || value === '') return;

                if (typeof value === 'object' && !Array.isArray(value)) {
                    const cleanedNested = cleanObject(value, currentPath);
                    if (hasNonEmptyValues(cleanedNested)) {
                        result[key] = cleanedNested;
                    }
                } else if (Array.isArray(value)) {
                    if (value.length > 0) {
                        result[key] = value;
                    }
                } else {
                    result[key] = value;
                }
            });
            return result;
        };

        return cleanObject(data);
    };

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

    const { data: hosts = [] } = useQuery({
        queryKey: ["getHostsQueryKey"],
        queryFn: () => getHosts(),
        enabled: isTransportOpen,
        select: (data) => data.filter((host) => host.id != null), // Filter out hosts with null IDs
    });

    const handleAccordionChange = (value: string) => {
        if (value === "transport") {
            setIsTransportOpen(true);
        }
        setOpenSection((prevSection) => (prevSection === value ? undefined : value));
    };

    const handleSubmit = async (data: HostFormValues) => {
        try {
            // Clean the payload before sending
            const cleanedData = cleanPayload(data);

            const response = await onSubmit(cleanedData);
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
            <DialogContent className="w-full h-full max-w-2xl md:max-h-[90dvh] sm:overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className={cn(dir === "rtl" ? "text-right" : "text-left")}>{editingHost ? t("editHost.title") : t("hostsDialog.addHost")}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div
                            className="max-h-[80dvh] sm:max-h-[75dvh] overflow-y-auto pr-4 -mr-4 px-2 space-y-4">
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
                                                    <Input placeholder="example.com" {...field} />
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
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            field.onChange(val === "" ? "" : Number.parseInt(val, 10));
                                                        }}
                                                        value={field.value === undefined ? "" : field.value}
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
                                <AccordionItem className="border px-4 rounded-sm [&_[data-state=open]]:no-underline [&_[data-state=closed]]:no-underline" value="network">
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-2">
                                            <GlobeLock className="h-4 w-4" />
                                            <span>{t("hostsDialog.networkSettings")}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-2">
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="host"
                                                    render={({ field }) => (
                                                        <FormItem>
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
                                                        <FormItem>
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

                                            <FormField
                                                control={form.control}
                                                name="random_user_agent"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                        <div className="space-y-0.5">
                                                            <FormLabel className="text-base">
                                                                {t("hostsDialog.randomUserAgent")}
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

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-medium">{t("hostsDialog.httpHeaders")}</h4>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => {
                                                            const currentHeaders = form.getValues("http_headers") || {};
                                                            const newKey = `header_${Object.keys(currentHeaders).length}`;
                                                            form.setValue("http_headers", {
                                                                ...currentHeaders,
                                                                [newKey]: ""
                                                            }, {
                                                                shouldDirty: true,
                                                                shouldTouch: true
                                                            });
                                                        }}
                                                        title={t("hostsDialog.addHeader")}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    {Object.entries(form.watch("http_headers") || {}).map(([key, value]) => (
                                                        <div key={key} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                                                            <Input
                                                                placeholder={t("hostsDialog.headersName")}
                                                                defaultValue={key}
                                                                onBlur={(e) => {
                                                                    if (e.target.value !== key) {
                                                                        const currentHeaders = { ...form.getValues("http_headers") };
                                                                        const oldValue = currentHeaders[key];
                                                                        delete currentHeaders[key];
                                                                        currentHeaders[e.target.value] = oldValue;
                                                                        form.setValue("http_headers", currentHeaders, {
                                                                            shouldDirty: true,
                                                                            shouldTouch: true
                                                                        });
                                                                    }
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

                                <AccordionItem className="border px-4 rounded-sm [&_[data-state=open]]:no-underline [&_[data-state=closed]]:no-underline" value="security">
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-2">
                                            <Lock className="h-4 w-4" />
                                            <span>{t("hostsDialog.securitySettings")}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-2">
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="alpn"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("hostsDialog.alpn")}</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={t("hostsDialog.alpn")} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="default">{t("default")}</SelectItem>
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
                                                            <Select onValueChange={(value) => field.onChange(value === "default" ? "" : value)} value={field.value || "default"}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={t("hostsDialog.fingerprint")} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="default">{t("default")}</SelectItem>
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
                                            </div>

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

                                            <FormField
                                                control={form.control}
                                                name="use_sni_as_host"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                        <div className="space-y-0.5">
                                                            <FormLabel className="text-base">
                                                                {t("hostsDialog.useSniAsHost")}
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

                                <AccordionItem className="border px-4 rounded-sm [&_[data-state=open]]:no-underline [&_[data-state=closed]]:no-underline" value="camouflag">
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
                                                                <Input
                                                                    placeholder={t("hostsDialog.noise.packetPlaceholder")}
                                                                    value={form.watch(`noise_settings.xray.${index}.packet`) || ""}
                                                                    onChange={(e) => {
                                                                        form.setValue(`noise_settings.xray.${index}.packet`, e.target.value, {
                                                                            shouldDirty: true,
                                                                            shouldTouch: true
                                                                        });
                                                                    }}
                                                                />
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

                                <AccordionItem className="border px-4 rounded-sm [&_[data-state=open]]:no-underline [&_[data-state=closed]]:no-underline" value="transport">
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-2">
                                            <Network className="h-4 w-4" />
                                            <span>{t("hostsDialog.transportSettingsAccordion")}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            <Tabs defaultValue="xhttp" className="w-full">
                                                <TabsList className="grid grid-cols-5 mb-4 gap-4 px-1 min-w-full overflow-x-auto">
                                                    <TabsTrigger className="px-2" value="xhttp">XHTTP</TabsTrigger>
                                                    <TabsTrigger className="px-2" value="grpc">gRPC</TabsTrigger>
                                                    <TabsTrigger className="px-2" value="kcp">KCP</TabsTrigger>
                                                    <TabsTrigger className="px-2" value="tcp">TCP</TabsTrigger>
                                                    <TabsTrigger className="px-2" value="websocket">WebSocket</TabsTrigger>
                                                </TabsList>

                                                {/* XHTTP Settings */}
                                                <TabsContent dir={dir} value="xhttp" className="space-y-4 p-2">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-medium">{t("hostsDialog.xhttp.xmux")}</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <FormField
                                                                control={form.control}
                                                                name="transport_settings.xhttp_settings.xmux.max_concurrency"
                                                                render={({ field }) => (
                                                                    <FormItem className="col-span-2 md:col-span-1">
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
                                                                    <FormItem className="col-span-2 md:col-span-1">
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
                                                                    <FormItem className="col-span-2 md:col-span-1">
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
                                                                    <FormItem className="col-span-2 md:col-span-1">
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
                                                                    <FormItem className="col-span-2 md:col-span-1">
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
                                                                    <FormItem className="col-span-2 md:col-span-1">
                                                                        <FormLabel>{t("hostsDialog.xhttp.hKeepAlivePeriod")}</FormLabel>
                                                                        <FormControl>
                                                                            <Input {...field} />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="transport_settings.xhttp_settings.download_settings"
                                                                render={({ field }) => (
                                                                    <FormItem className="w-full col-span-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <FormLabel>{t("hostsDialog.xhttp.downloadSettings")}</FormLabel>
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
                                                                                    <p className="text-[11px] text-muted-foreground">
                                                                                        {t("hostsDialog.xhttp.downloadSettingsInfo")}
                                                                                    </p>
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                        </div>
                                                                        <Select
                                                                            onValueChange={(value) => field.onChange(value ? parseInt(value) : 0)}
                                                                            value={field.value?.toString() ?? "0"}
                                                                        >
                                                                            <FormControl>
                                                                                <SelectTrigger className="w-full">
                                                                                    <SelectValue placeholder={t("hostsDialog.xhttp.selectDownloadSettings")} />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent className="w-full">
                                                                                <SelectItem value="0">{t("none")}</SelectItem>
                                                                                {hosts.map((host) => (
                                                                                    <SelectItem key={host.id} value={host.id?.toString() ?? ""}>
                                                                                        {host.remark}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>

                                                </TabsContent>

                                                {/* gRPC Settings */}
                                                <TabsContent dir={dir} value="grpc" className="space-y-4 p-2">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                    </div>
                                                </TabsContent>

                                                {/* KCP Settings */}
                                                <TabsContent dir={dir} value="kcp" className="space-y-4 p-2">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                    </div>
                                                </TabsContent>

                                                {/* TCP Settings */}
                                                <TabsContent dir={dir} value="tcp" className="space-y-4 p-2">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="transport_settings.tcp_settings.header"
                                                            render={({ field }) => (
                                                                <FormItem className="col-span-2">
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
                                                    </div>

                                                    {form.watch("transport_settings.tcp_settings.header") === "http" && (
                                                        <>
                                                            <div className="space-y-4 p-2">
                                                                <h4 className="text-sm font-medium">{t("hostsDialog.tcp.request.title")}</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <FormField
                                                                        control={form.control}
                                                                        name="transport_settings.tcp_settings.request.version"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>{t("hostsDialog.tcp.request.version")}</FormLabel>
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl>
                                                                                        <SelectTrigger>
                                                                                            <SelectValue />
                                                                                        </SelectTrigger>
                                                                                    </FormControl>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="1.0">HTTP/1.0</SelectItem>
                                                                                        <SelectItem value="1.1">HTTP/1.1</SelectItem>
                                                                                        <SelectItem value="2.0">HTTP/2.0</SelectItem>
                                                                                        <SelectItem value="3.0">HTTP/3.0</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />

                                                                    <FormField
                                                                        control={form.control}
                                                                        name="transport_settings.tcp_settings.request.method"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>{t("hostsDialog.tcp.request.method")}</FormLabel>
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
                                                                                        <SelectItem value="HEAD">HEAD</SelectItem>
                                                                                        <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                                                                                        <SelectItem value="PATCH">PATCH</SelectItem>
                                                                                        <SelectItem value="TRACE">TRACE</SelectItem>
                                                                                        <SelectItem value="CONNECT">CONNECT</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>

                                                                {/* Request Headers */}
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-medium">{t("hostsDialog.tcp.requestHeaders")}</h4>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-6 w-6"
                                                                            onClick={() => {
                                                                                const currentHeaders = form.getValues("transport_settings.tcp_settings.request.headers") || {};
                                                                                const newKey = `header_${Object.keys(currentHeaders).length}`;
                                                                                form.setValue("transport_settings.tcp_settings.request.headers", {
                                                                                    ...currentHeaders,
                                                                                    [newKey]: [""]
                                                                                }, {
                                                                                    shouldDirty: true,
                                                                                    shouldTouch: true
                                                                                });
                                                                            }}
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>

                                                                    {/* Render request headers */}
                                                                    {Object.entries(form.watch("transport_settings.tcp_settings.request.headers") || {}).map(([key, values]) => (
                                                                        <div key={key} className="grid grid-cols-[1fr,2fr,auto] gap-2">
                                                                            <Input
                                                                                placeholder={t("hostsDialog.tcp.headerName")}
                                                                                defaultValue={key}
                                                                                onBlur={(e) => {
                                                                                    if (e.target.value !== key) {
                                                                                        const currentHeaders = { ...form.getValues("transport_settings.tcp_settings.request.headers") };
                                                                                        const oldValues = currentHeaders[key];
                                                                                        delete currentHeaders[key];
                                                                                        currentHeaders[e.target.value] = oldValues;
                                                                                        form.setValue("transport_settings.tcp_settings.request.headers", currentHeaders, {
                                                                                            shouldDirty: true,
                                                                                            shouldTouch: true
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <Input
                                                                                placeholder={t("hostsDialog.tcp.headerValue")}
                                                                                value={values.join(", ")}
                                                                                onChange={(e) => {
                                                                                    const currentHeaders = { ...form.getValues("transport_settings.tcp_settings.request.headers") };
                                                                                    currentHeaders[key] = e.target.value.split(",").map(v => v.trim());
                                                                                    form.setValue("transport_settings.tcp_settings.request.headers", currentHeaders, {
                                                                                        shouldDirty: true,
                                                                                        shouldTouch: true
                                                                                    });
                                                                                }}
                                                                            />
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => {
                                                                                    const currentHeaders = { ...form.getValues("transport_settings.tcp_settings.request.headers") };
                                                                                    delete currentHeaders[key];
                                                                                    form.setValue("transport_settings.tcp_settings.request.headers", currentHeaders, {
                                                                                        shouldDirty: true,
                                                                                        shouldTouch: true
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-4 p-2">
                                                                <h4 className="text-sm font-medium">{t("hostsDialog.tcp.response.title")}</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <FormField
                                                                        control={form.control}
                                                                        name="transport_settings.tcp_settings.response.version"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>{t("hostsDialog.tcp.response.version")}</FormLabel>
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl>
                                                                                        <SelectTrigger>
                                                                                            <SelectValue />
                                                                                        </SelectTrigger>
                                                                                    </FormControl>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="1.0">HTTP/1.0</SelectItem>
                                                                                        <SelectItem value="1.1">HTTP/1.1</SelectItem>
                                                                                        <SelectItem value="2.0">HTTP/2.0</SelectItem>
                                                                                        <SelectItem value="3.0">HTTP/3.0</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />

                                                                    <FormField
                                                                        control={form.control}
                                                                        name="transport_settings.tcp_settings.response.status"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>{t("hostsDialog.tcp.response.status")}</FormLabel>
                                                                                <FormControl>
                                                                                    <Input
                                                                                        {...field}
                                                                                        placeholder="200"
                                                                                        pattern="[1-5]\d{2}"
                                                                                    />
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
                                                                                <FormLabel>{t("hostsDialog.tcp.response.reason")}</FormLabel>
                                                                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                                    <FormControl>
                                                                                        <SelectTrigger>
                                                                                            <SelectValue placeholder={t("hostsDialog.selectReason")} />
                                                                                        </SelectTrigger>
                                                                                    </FormControl>
                                                                                    <SelectContent>
                                                                                        {/* 1xx Information responses */}
                                                                                        <SelectGroup>
                                                                                            <SelectLabel>1xx Information</SelectLabel>
                                                                                            <SelectItem value="Continue">{t("hostsDialog.httpReasons.100")}</SelectItem>
                                                                                            <SelectItem value="Switching Protocols">{t("hostsDialog.httpReasons.101")}</SelectItem>
                                                                                        </SelectGroup>

                                                                                        {/* 2xx Success responses */}
                                                                                        <SelectGroup>
                                                                                            <SelectLabel>2xx Success</SelectLabel>
                                                                                            <SelectItem value="OK">{t("hostsDialog.httpReasons.200")}</SelectItem>
                                                                                            <SelectItem value="Created">{t("hostsDialog.httpReasons.201")}</SelectItem>
                                                                                            <SelectItem value="Accepted">{t("hostsDialog.httpReasons.202")}</SelectItem>
                                                                                            <SelectItem value="Non-Authoritative Information">{t("hostsDialog.httpReasons.203")}</SelectItem>
                                                                                            <SelectItem value="No Content">{t("hostsDialog.httpReasons.204")}</SelectItem>
                                                                                            <SelectItem value="Reset Content">{t("hostsDialog.httpReasons.205")}</SelectItem>
                                                                                            <SelectItem value="Partial Content">{t("hostsDialog.httpReasons.206")}</SelectItem>
                                                                                        </SelectGroup>

                                                                                        {/* 3xx Redirection responses */}
                                                                                        <SelectGroup>
                                                                                            <SelectLabel>3xx Redirection</SelectLabel>
                                                                                            <SelectItem value="Multiple Choices">{t("hostsDialog.httpReasons.300")}</SelectItem>
                                                                                            <SelectItem value="Moved Permanently">{t("hostsDialog.httpReasons.301")}</SelectItem>
                                                                                            <SelectItem value="Found">{t("hostsDialog.httpReasons.302")}</SelectItem>
                                                                                            <SelectItem value="See Other">{t("hostsDialog.httpReasons.303")}</SelectItem>
                                                                                            <SelectItem value="Not Modified">{t("hostsDialog.httpReasons.304")}</SelectItem>
                                                                                            <SelectItem value="Use Proxy">{t("hostsDialog.httpReasons.305")}</SelectItem>
                                                                                            <SelectItem value="Temporary Redirect">{t("hostsDialog.httpReasons.307")}</SelectItem>
                                                                                            <SelectItem value="Permanent Redirect">{t("hostsDialog.httpReasons.308")}</SelectItem>
                                                                                        </SelectGroup>

                                                                                        {/* 4xx Client Error responses */}
                                                                                        <SelectGroup>
                                                                                            <SelectLabel>4xx Client Error</SelectLabel>
                                                                                            <SelectItem value="Bad Request">{t("hostsDialog.httpReasons.400")}</SelectItem>
                                                                                            <SelectItem value="Unauthorized">{t("hostsDialog.httpReasons.401")}</SelectItem>
                                                                                            <SelectItem value="Payment Required">{t("hostsDialog.httpReasons.402")}</SelectItem>
                                                                                            <SelectItem value="Forbidden">{t("hostsDialog.httpReasons.403")}</SelectItem>
                                                                                            <SelectItem value="Not Found">{t("hostsDialog.httpReasons.404")}</SelectItem>
                                                                                            <SelectItem value="Method Not Allowed">{t("hostsDialog.httpReasons.405")}</SelectItem>
                                                                                            <SelectItem value="Not Acceptable">{t("hostsDialog.httpReasons.406")}</SelectItem>
                                                                                            <SelectItem value="Proxy Authentication Required">{t("hostsDialog.httpReasons.407")}</SelectItem>
                                                                                            <SelectItem value="Request Timeout">{t("hostsDialog.httpReasons.408")}</SelectItem>
                                                                                            <SelectItem value="Conflict">{t("hostsDialog.httpReasons.409")}</SelectItem>
                                                                                            <SelectItem value="Gone">{t("hostsDialog.httpReasons.410")}</SelectItem>
                                                                                            <SelectItem value="Length Required">{t("hostsDialog.httpReasons.411")}</SelectItem>
                                                                                            <SelectItem value="Precondition Failed">{t("hostsDialog.httpReasons.412")}</SelectItem>
                                                                                            <SelectItem value="Payload Too Large">{t("hostsDialog.httpReasons.413")}</SelectItem>
                                                                                            <SelectItem value="URI Too Long">{t("hostsDialog.httpReasons.414")}</SelectItem>
                                                                                            <SelectItem value="Unsupported Media Type">{t("hostsDialog.httpReasons.415")}</SelectItem>
                                                                                            <SelectItem value="Range Not Satisfiable">{t("hostsDialog.httpReasons.416")}</SelectItem>
                                                                                            <SelectItem value="Expectation Failed">{t("hostsDialog.httpReasons.417")}</SelectItem>
                                                                                            <SelectItem value="I'm a teapot">{t("hostsDialog.httpReasons.418")}</SelectItem>
                                                                                            <SelectItem value="Misdirected Request">{t("hostsDialog.httpReasons.421")}</SelectItem>
                                                                                            <SelectItem value="Unprocessable Entity">{t("hostsDialog.httpReasons.422")}</SelectItem>
                                                                                            <SelectItem value="Locked">{t("hostsDialog.httpReasons.423")}</SelectItem>
                                                                                            <SelectItem value="Failed Dependency">{t("hostsDialog.httpReasons.424")}</SelectItem>
                                                                                            <SelectItem value="Too Early">{t("hostsDialog.httpReasons.425")}</SelectItem>
                                                                                            <SelectItem value="Upgrade Required">{t("hostsDialog.httpReasons.426")}</SelectItem>
                                                                                            <SelectItem value="Precondition Required">{t("hostsDialog.httpReasons.428")}</SelectItem>
                                                                                            <SelectItem value="Too Many Requests">{t("hostsDialog.httpReasons.429")}</SelectItem>
                                                                                            <SelectItem value="Request Header Fields Too Large">{t("hostsDialog.httpReasons.431")}</SelectItem>
                                                                                            <SelectItem value="Unavailable For Legal Reasons">{t("hostsDialog.httpReasons.451")}</SelectItem>
                                                                                        </SelectGroup>

                                                                                        {/* 5xx Server Error responses */}
                                                                                        <SelectGroup>
                                                                                            <SelectLabel>5xx Server Error</SelectLabel>
                                                                                            <SelectItem value="Internal Server Error">{t("hostsDialog.httpReasons.500")}</SelectItem>
                                                                                            <SelectItem value="Not Implemented">{t("hostsDialog.httpReasons.501")}</SelectItem>
                                                                                            <SelectItem value="Bad Gateway">{t("hostsDialog.httpReasons.502")}</SelectItem>
                                                                                            <SelectItem value="Service Unavailable">{t("hostsDialog.httpReasons.503")}</SelectItem>
                                                                                            <SelectItem value="Gateway Timeout">{t("hostsDialog.httpReasons.504")}</SelectItem>
                                                                                            <SelectItem value="HTTP Version Not Supported">{t("hostsDialog.httpReasons.505")}</SelectItem>
                                                                                        </SelectGroup>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>

                                                                {/* Response Headers */}
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-medium">{t("hostsDialog.tcp.responseHeaders")}</h4>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-6 w-6"
                                                                            onClick={() => {
                                                                                const currentHeaders = form.getValues("transport_settings.tcp_settings.response.headers") || {};
                                                                                const newKey = `header_${Object.keys(currentHeaders).length}`;
                                                                                form.setValue("transport_settings.tcp_settings.response.headers", {
                                                                                    ...currentHeaders,
                                                                                    [newKey]: [""]
                                                                                }, {
                                                                                    shouldDirty: true,
                                                                                    shouldTouch: true
                                                                                });
                                                                            }}
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>

                                                                    {/* Render response headers */}
                                                                    {Object.entries(form.watch("transport_settings.tcp_settings.response.headers") || {}).map(([key, values]) => (
                                                                        <div key={key} className="grid grid-cols-[1fr,2fr,auto] gap-2">
                                                                            <Input
                                                                                placeholder={t("hostsDialog.tcp.headerName")}
                                                                                defaultValue={key}
                                                                                onBlur={(e) => {
                                                                                    if (e.target.value !== key) {
                                                                                        const currentHeaders = { ...form.getValues("transport_settings.tcp_settings.response.headers") };
                                                                                        const oldValues = currentHeaders[key];
                                                                                        delete currentHeaders[key];
                                                                                        currentHeaders[e.target.value] = oldValues;
                                                                                        form.setValue("transport_settings.tcp_settings.response.headers", currentHeaders, {
                                                                                            shouldDirty: true,
                                                                                            shouldTouch: true
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <Input
                                                                                placeholder={t("hostsDialog.tcp.headerValue")}
                                                                                value={values.join(", ")}
                                                                                onChange={(e) => {
                                                                                    const currentHeaders = { ...form.getValues("transport_settings.tcp_settings.response.headers") };
                                                                                    currentHeaders[key] = e.target.value.split(",").map(v => v.trim());
                                                                                    form.setValue("transport_settings.tcp_settings.response.headers", currentHeaders, {
                                                                                        shouldDirty: true,
                                                                                        shouldTouch: true
                                                                                    });
                                                                                }}
                                                                            />
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => {
                                                                                    const currentHeaders = { ...form.getValues("transport_settings.tcp_settings.response.headers") };
                                                                                    delete currentHeaders[key];
                                                                                    form.setValue("transport_settings.tcp_settings.response.headers", currentHeaders, {
                                                                                        shouldDirty: true,
                                                                                        shouldTouch: true
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </TabsContent>

                                                {/* WebSocket Settings */}
                                                <TabsContent dir={dir} value="websocket" className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem className="border px-4 rounded-sm [&_[data-state=open]]:no-underline [&_[data-state=closed]]:no-underline" value="mux">
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
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                                render={() => (
                                                                    <FormItem>
                                                                        <FormLabel>{t("hostsDialog.xudpProxy443")}</FormLabel>
                                                                        <Select
                                                                            value={form.watch("mux_settings.xray.xudp_proxy_443") ?? "reject"}
                                                                            onValueChange={(value) => {
                                                                                form.setValue("mux_settings.xray.xudp_proxy_443", value);
                                                                            }}
                                                                        >
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder={t("host.xudp_proxy_443")} />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="reject">{t("host.reject")}</SelectItem>
                                                                                <SelectItem value="allow">{t("host.allow")}</SelectItem>
                                                                                <SelectItem value="skip">{t("host.skip")}</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                </TabsContent>

                                                {/* Sing-box Settings */}
                                                <TabsContent dir={dir} value="sing_box">
                                                    <div className="space-y-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="mux_settings.sing_box.protocol"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t("hostsDialog.protocol")}</FormLabel>
                                                                    <Select
                                                                        onValueChange={(value) => field.onChange(value === "null" ? undefined : value)}
                                                                        value={field.value ?? "null"}
                                                                    >
                                                                        <FormControl>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder={t("hostsDialog.selectProtocol")} />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">{t("none")}</SelectItem>
                                                                            <SelectItem value="h2mux">h2mux</SelectItem>
                                                                            <SelectItem value="smux">smux</SelectItem>
                                                                            <SelectItem value="yamux">yamux</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                        </div>

                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-medium">{t("hostsDialog.brutal.title")}</h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <FormField
                                                                    control={form.control}
                                                                    name="mux_settings.sing_box.brutal.up_mbps"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>{t("hostsDialog.brutal.upMbps")}</FormLabel>
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
                                                                    name="mux_settings.sing_box.brutal.down_mbps"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>{t("hostsDialog.brutal.downMbps")}</FormLabel>
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
                                                            </div>
                                                        </div>

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
                                                    <div className="space-y-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="mux_settings.clash.protocol"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t("hostsDialog.protocol")}</FormLabel>
                                                                    <Select
                                                                        onValueChange={(value) => field.onChange(value === "null" ? undefined : value)}
                                                                        value={field.value ?? "null"}
                                                                    >
                                                                        <FormControl>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder={t("hostsDialog.selectProtocol")} />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">{t("none")}</SelectItem>
                                                                            <SelectItem value="smux">smux</SelectItem>
                                                                            <SelectItem value="yamux">yamux</SelectItem>
                                                                            <SelectItem value="h2mux">h2mux</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                        </div>

                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-medium">{t("hostsDialog.brutal.title")}</h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <FormField
                                                                    control={form.control}
                                                                    name="mux_settings.clash.brutal.up_mbps"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>{t("hostsDialog.brutal.upMbps")}</FormLabel>
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
                                                                    name="mux_settings.clash.brutal.down_mbps"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>{t("hostsDialog.brutal.downMbps")}</FormLabel>
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
                                                            </div>
                                                        </div>

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


                        </div>
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