import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import useDirDetection from "@/hooks/use-dir-detection";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState } from "react";
import { Label } from "../ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert } from "../ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useNodes } from "@/contexts/NodesContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface AddNodeModalProps {
    isOpen: boolean;
    onCloseModal: () => void;
}

const AddNodeModal = ({ isOpen, onCloseModal }: AddNodeModalProps) => {
    const { addNode } = useNodes();
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const { t } = useTranslation();
    const dir = useDirDetection();
    const { toast } = useToast();

    // Zod schema
    const schema = z.object({
        name: z.string().min(1, t("login.fieldRequired")),
        address: z.string().min(1, t("login.fieldRequired")),
        port: z.number().min(1, t("login.fieldRequired")),
        api_port: z.number().min(1, t("login.fieldRequired")),
        usage_coefficient: z.number().min(1, t("login.fieldRequired")),
    });


    type FormData = z.infer<typeof schema>;

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting, isValid },
        reset,
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        mode: "onChange",
        defaultValues: {
            name: "",
            address: "",
            port: 62050,
            usage_coefficient: 1,
        },
    });

    const handleAddNode = async (
        values: { name: string; address: string; port: number; usage_coefficient: number; api_port: number },
        actions: any
    ) => {
        setError("");
        setLoading(true);
        try {
            const node = await addNode({
                name: values.name,
                address: values.address,
                port: values.port,
                usage_coefficient: values.usage_coefficient,
                api_port: 8080, // Default value or get it from user input
            });
            toast({
                description: t("nodes.addNodeSuccess", { name: values.name }),
            });
            setLoading(false);
            actions.setSubmitting(false);
            onCloseModal();
        } catch (error) {
            // Narrow the error type
            if (error instanceof Error) {
                setError(error.message); // Access the error message safely
            } else {
                setError(t("nodes.addNodeError")); // Fallback message
            }
            setLoading(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onCloseModal}>
            <DialogContent className="h-full flex flex-col py-10 md:h-[90%]" dir={dir}>
                <DialogTitle dir={dir}>{t("nodes.addNode")}</DialogTitle>
                <DialogDescription className="mb-4">{t("nodes.prompt")}</DialogDescription>
                <form onSubmit={handleSubmit(handleAddNode)} className="h-full pb-8">
                    <div className="form-control flex flex-col gap-y-4 h-full">
                        <Label>{t("nodes.nodeName")}</Label>
                        <div dir="ltr" className="mb-2">
                            <Input
                                {...register("name")}
                                className="py-5 px-4"
                                placeholder="Remark (e.g. Marzban-Node)"
                            />
                            {errors.name && (
                                <div
                                    dir={dir}
                                    className={`text-red-500 text-xs mt-1 font-bold ${dir === "rtl" && "text-right"}`}
                                >
                                    {errors.name.message}
                                </div>
                            )}
                        </div>
                        <Label>{t("nodes.nodeAddress")}</Label>
                        <div dir="ltr" className="mb-2">
                            <Input
                                {...register("address")}
                                className="py-5 px-4"
                                placeholder="Address (e.g. 10.11.12.13)"
                            />
                            {errors.address && (
                                <div
                                    dir={dir}
                                    className={`text-red-500 text-xs mt-1 font-bold ${dir === "rtl" && "text-right"}`}
                                >
                                    {errors.address.message}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <div>
                                <Label>{t("nodes.nodePort")}</Label>
                                <div dir="ltr" className="mt-2">
                                    <Input
                                        type="number"
                                        {...register("port", { valueAsNumber: true })}
                                        className="py-5 px-4"
                                        placeholder="Port (e.g. 62050)"
                                    />
                                    {errors.port && (
                                        <div
                                            className={`text-red-500 text-xs mt-1 font-bold ${dir === "rtl" && "text-right"}`}
                                        >
                                            {errors.port.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label>{t("nodes.usageCoefficient")}</Label>
                                <div dir="ltr" className="mt-2">
                                    <Input
                                        type="number"
                                        {...register("usage_coefficient", { valueAsNumber: true })}
                                        className="py-5 px-4"
                                        placeholder="Ratio (e.g. 2)"
                                    />
                                    {errors.usage_coefficient && (
                                        <div
                                            className={`text-red-500 text-xs mt-1 font-bold ${dir === "rtl" && "text-right"}`}
                                        >
                                            {errors.usage_coefficient.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    {error && (
                        <Alert
                            variant="destructive"
                            className="p-4 rounded-lg flex items-center bg-[#a32929d4] border-none text-red-700 justify-between"
                        >
                            <AlertCircle className="h-6 w-6 fill-red-300" />
                            <span className="text-white ml-1 font-semibold">{error}</span>
                        </Alert>
                    )}
                    <div dir={dir} className="flex-1 flex items-center gap-x-4">
                        <Button onClick={onCloseModal} variant="outline" className="w-full py-5">
                            <span>{t("cancel")}</span>
                        </Button>
                        <Button
                            disabled={loading || isSubmitting || !isValid}
                            type="submit"
                            className="w-full py-5"
                            color="primary"
                        >
                            <div className="flex items-center gap-x-2">
                                {loading || isSubmitting ? (
                                    <Loader2 className="animate-spin h-6 w-6" />
                                ) : (
                                    <span>{t("nodes.addNode")}</span>
                                )}
                            </div>
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddNodeModal;
