"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "react-query"

const hostFormSchema = z.object({
    inbound_tag: z.string().min(1, "Inbound is required"),
    remark: z.string().min(1, "Remark is required"),
    address: z.string().ip("Invalid IP address"),
    port: z
        .string()
        .regex(/^\d+$/, "Port must be a number")
        .transform(Number)
        .refine((n) => n >= 1 && n <= 65535, "Port must be between 1 and 65535")
        .optional(),
    sni: z.string().optional(),
    host: z.string().optional(),
    path: z.string().optional(),
    security: z.string().optional(),
    alpn: z.string().optional(),
    fingerprint: z.string().optional(),
    allowinsecure: z.boolean().optional(),
    is_disabled: z.boolean().optional(),
    mux_enable: z.boolean().optional(),
    fragment_setting: z.string().optional(),
    random_user_agent: z.boolean().optional(),
    noise_setting: z.string().optional(),
    use_sni_as_host: z.boolean().optional(),
})

type HostFormValues = z.infer<typeof hostFormSchema>

interface HostFormProps {
    host?: HostFormValues
}

export function HostForm({ host }: HostFormProps) {
    const [openSection, setOpenSection] = useState<string | undefined>(undefined)
    const { t } = useTranslation()
    const queryClient = useQueryClient()

    const form = useForm<HostFormValues>({
        resolver: zodResolver(hostFormSchema),
        defaultValues: host || {
            inbound_tag: "",
            remark: "",
            address: "",
            port: undefined, // Since port is a number, use `undefined` instead of an empty string
            sni: "",
            host: "",
            path: "",
            security: "",
            alpn: "",
            fingerprint: "",
            allowinsecure: false,
            is_disabled: false,
            mux_enable: false,
            fragment_setting: "",
            random_user_agent: false,
            noise_setting: "",
            use_sni_as_host: false,
        },
    })

    const handleAccordionChange = (value: string) => {
        setOpenSection((prevSection) => (prevSection === value ? undefined : value))
    }

    const onSubmit = async (data: HostFormValues) => {
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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="inbound_tag"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Inbound</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Inbound" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="inbound1">Inbound 1</SelectItem>
                                        <SelectItem value="inbound2">Inbound 2</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="remark"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Remark</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Marzban-Node" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address</FormLabel>
                                    <FormControl>
                                        <Input placeholder="10.10.10.10" {...field} />
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
                                    <FormLabel>Port</FormLabel>
                                    <FormControl>
                                        <Input placeholder="443" {...field} />
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
                    className="w-full"
                >
                    <AccordionItem value="network">
                        <AccordionTrigger>Network Settings</AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="sni"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>SNI</FormLabel>
                                            <FormControl>
                                                <Input placeholder="SNI (e.g. example.com)" {...field} />
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
                                            <FormLabel>Request Host</FormLabel>
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
                                            <FormLabel>Path</FormLabel>
                                            <FormControl>
                                                <Input placeholder="path (e.g. /vless)" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="transport">
                        <AccordionTrigger>Transport Settings</AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4">{/* Add transport settings fields */}</div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="security">
                        <AccordionTrigger>Security Settings</AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4">{/* Add security settings fields */}</div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="camouflage">
                        <AccordionTrigger>Camouflage Settings</AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4">{/* Add camouflage settings fields */}</div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="mux">
                        <AccordionTrigger>Mux Settings</AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4">{/* Add mux settings fields */}</div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" type="button" onClick={() => form.reset()}>
                        Cancel
                    </Button>
                    <Button type="submit">Save</Button>
                </div>
            </form>
        </Form>
    )
}

