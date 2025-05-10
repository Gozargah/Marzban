import {useState} from "react";
import {Card, CardDescription, CardTitle} from "../ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {Button} from "../ui/button";
import {Copy, EllipsisVertical, Infinity, Pen, Trash2} from "lucide-react";
import {useTranslation} from "react-i18next";
import useDirDetection from "@/hooks/use-dir-detection";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {cn} from "@/lib/utils";
import {useToast} from "@/hooks/use-toast";
import {formatBytes} from "@/utils/formatByte";
import {createUserTemplate, useRemoveUserTemplate, UserTemplateCreate, UserTemplateResponse} from "@/service/api";
import {queryClient} from "@/utils/query-client.ts";

const DeleteAlertDialog = ({
                               userTemplate,
                               isOpen,
                               onClose,
                               onConfirm,
                           }: {
    userTemplate: UserTemplateResponse;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) => {
    const {t} = useTranslation();
    const dir = useDirDetection();

    return (
        <div>
            <AlertDialog open={isOpen} onOpenChange={onClose}>
                <AlertDialogContent>
                    <AlertDialogHeader className={cn(dir === "rtl" && "sm:text-right")}>
                        <AlertDialogTitle>{t("templates.deleteUserTemplateTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span dir={dir}
                                  dangerouslySetInnerHTML={{__html: t("templates.deleteUserTemplatePrompt", {name: userTemplate.name})}}/>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className={cn(dir === "rtl" && "sm:gap-x-2 sm:flex-row-reverse")}>
                        <AlertDialogCancel onClick={onClose}>{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={onConfirm}>
                            {t("remove")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const UserTemplate = ({template, onEdit}: {
    template: UserTemplateResponse,
    onEdit: (userTemplate: UserTemplateResponse) => void
}) => {
    const {t} = useTranslation();
    const dir = useDirDetection();
    const {toast} = useToast();
    const removeUserTemplateMutation = useRemoveUserTemplate()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDeleteClick = () => {
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };


    const handleConfirmDelete = async () => {
        try {
            await removeUserTemplateMutation.mutateAsync({
                templateId: template.id
            });
            toast({
                title: t("success", {defaultValue: "Success"}),
                description: t("templates.deleteSuccess", {
                    name: template.name,
                    defaultValue: "Template «{name}» has been deleted successfully"
                })
            });
            setDeleteDialogOpen(false);
            // Invalidate nodes queries
            queryClient.invalidateQueries({queryKey: ['/api/user_template']});
        } catch (error) {
            toast({
                title: t("error", {defaultValue: "Error"}),
                description: t("templates.deleteFailed", {
                    name: template.name,
                    defaultValue: "Failed to delete template «{name}»"
                }),
                variant: "destructive"
            });
        }
    };

    const handleDuplicate = async () => {
        try {
            const newTemplate: UserTemplateCreate = {
                ...template,
                name: `${template.name} (copy)`,
            }
            await createUserTemplate(newTemplate)
            toast({
                title: t("success", {defaultValue: "Success"}),
                description: t("templates.duplicateSuccess", {
                    name: template.name,
                    defaultValue: "Template «{name}» has been duplicated successfully"
                })
            });
            queryClient.invalidateQueries({queryKey: ['/api/user_template']});

        } catch (error) {
            toast({
                title: t("error", {defaultValue: "Error"}),
                description: t("templates.duplicateFailed", {
                    name: template.name,
                    defaultValue: "Failed to duplicate template «{name}»"
                }),
                variant: "destructive"
            });
        }
    }

    return (
        <Card className="px-5 py-6 rounded-lg">
            <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-x-2">
                    <span>{template.name}</span>
                </div>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <EllipsisVertical/>
                            <span className="sr-only">Template Actions</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={dir === "rtl" ? "end" : "start"}>
                        <DropdownMenuItem dir={dir} className="flex items-center" onSelect={() => onEdit(template)}>
                            <Pen className="h-4 w-4"/>
                            <span>{t("modify")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem dir={dir} className="flex items-center" onClick={handleDuplicate}>
                            <Copy className="h-4 w-4"/>
                            <span>{t("duplicate")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            dir={dir}
                            className="flex items-center !text-red-500"
                            onClick={handleDeleteClick}
                        >
                            <Trash2 className="h-4 w-4 text-red-500"/>
                            <span>{t("remove")}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardTitle>
            <CardDescription>
                <div className="flex flex-col gap-y-1 mt-2">
                    <p className={"flex items-center gap-x-1"}>
                        {t("userDialog.dataLimit")}: <span>{(!template.data_limit || template.data_limit === 0) ?
                        <Infinity
                            className="w-4 h-4"></Infinity> : formatBytes(template.data_limit ? template.data_limit : 0)}</span>
                    </p>
                    <p className={"flex items-center gap-x-1"}>
                        {t("Expire")}: <span>{(!template.expire_duration || template.expire_duration === 0 ?
                        <Infinity className="w-4 h-4"></Infinity> : template.expire_duration)}</span>
                    </p>
                </div>
            </CardDescription>

            <div>
                <DeleteAlertDialog
                    userTemplate={template}
                    isOpen={isDeleteDialogOpen}
                    onClose={handleCloseDeleteDialog}
                    onConfirm={handleConfirmDelete}
                />
            </div>
        </Card>
    );
};

export default UserTemplate;
