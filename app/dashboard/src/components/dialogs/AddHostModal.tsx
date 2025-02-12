import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState } from "react"
import { Button } from "../ui/button"
import { HostFormValues } from "../hosts/Hosts"

interface AddHostModalProps {
    isDialogOpen: boolean;
    onOpenChange: (open: boolean) => void;
    form: any;
    onSubmit: (data: HostFormValues) => void;
    editingHost?: boolean;
}

const AddHostModal: React.FC<AddHostModalProps> = ({
    isDialogOpen,
    onOpenChange,
    form,
    onSubmit,
    editingHost,
}) => {
    const [openSection, setOpenSection] = useState<string | undefined>(undefined);
    const handleAccordionChange = (value: string) => {

        setOpenSection((prevSection) => (prevSection === value ? undefined : value));
    };
    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingHost ? "Edit Host" : "Add Host"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="remark"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Remark</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="inbound_tag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Inbound Tag</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Inbound Tag" />
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
                                            name="port"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Port</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            {...field}
                                                            onChange={(e) =>
                                                                field.onChange(e.target.value ? Number.parseInt(e.target.value, 10) : null)
                                                            }
                                                            value={field.value ?? ""}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="sni"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>SNI</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} value={field.value ?? ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="host"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Host</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} value={field.value ?? ""} />
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
                                                        <Input {...field} value={field.value ?? ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="security">
                                <AccordionTrigger>Security Settings</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="security"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Security</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Security" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="none">None</SelectItem>
                                                            <SelectItem value="tls">TLS</SelectItem>
                                                            <SelectItem value="reality">Reality</SelectItem>
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
                                                        <FormLabel className="text-base">Allow Insecure</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="advanced">
                                <AccordionTrigger>Advanced Settings</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="mux_enable"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base">Enable Mux</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="random_user_agent"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base">Random User Agent</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default AddHostModal;