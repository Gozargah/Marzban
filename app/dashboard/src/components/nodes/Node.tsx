import {useState} from "react";
import {Card, CardDescription, CardTitle} from "../ui/card";
import FlagFromIP from "@/utils/flagFromIP";
import {NodeStatusBadge} from "./NodeStatusBadge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {Button} from "../ui/button";
import {EllipsisVertical, Pen, Trash2} from "lucide-react";
import {useTranslation} from "react-i18next";
import useDirDetection from "@/hooks/use-dir-detection";
import {NodeType} from "@/contexts/NodesContext";
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
import EditNodeModal from "@/components/dialogs/EditNodeModal.tsx";
import {NodeSettings} from "@/service/api";

const DeleteAlertDialog = ({
                               node,
                               isOpen,
                               onClose,
                               onConfirm,
                           }: {
    node: NodeType;
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
                        <AlertDialogTitle>{t("deleteNode.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span dir={dir}
                                  dangerouslySetInnerHTML={{__html: t("deleteNode.prompt", {name: node.name})}}/>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className={cn(dir === "rtl" && "sm:gap-x-2 sm:flex-row-reverse")}>
                        <AlertDialogCancel onClick={onClose}>{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={onConfirm}>
                            {t("delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const Node = ({node, nodeSetting}: { node: NodeType, nodeSetting: NodeSettings | undefined }) => {
    const {t} = useTranslation();
    const dir = useDirDetection();
    const {toast} = useToast()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isEditNodeModalOpen, setIsEditNodeModalOpen] = useState(false)

    const handleDeleteClick = () => {
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    const handleConfirmDelete = () => {
        toast({
            dir,
            description: t("deleteNode.deleteSuccess", {name: node.name}),
        })
        setDeleteDialogOpen(false);
    };

    return (
        <div>
            <Card className="px-5 py-6 rounded-lg">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                        <div className="mr-1.5">
                            <NodeStatusBadge status={node.status}/>
                        </div>
                        <FlagFromIP ip={node.address}/>
                        <span>{node.name}</span>
                    </div>
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <EllipsisVertical/>
                                <span className="sr-only">Nodes Actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={dir === "rtl" ? "end" : "start"}>
                            <DropdownMenuItem dir={dir} className="flex items-center"
                                              onClick={() => setIsEditNodeModalOpen(true)}>
                                <Pen className="h-4 w-4"/>
                                <span>{t("edit")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                dir={dir}
                                className="flex items-center !text-red-500"
                                onClick={handleDeleteClick}
                            >
                                <Trash2 className="h-4 w-4 text-red-500"/>
                                <span>{t("delete")}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardTitle>
                <CardDescription>
                    <div className="flex flex-col gap-y-1 mt-2">
                        <p>
                            {t("ip")}: <span>{node.address}</span>
                        </p>
                        <p>
                            {t("nodes.nodePort")}: <span>{node.port}</span>
                        </p>
                        <p>
                            {t("nodes.nodeAPIPort")}: <span>{node.api_port}</span>
                        </p>
                    </div>
                </CardDescription>

                {/* Include the Delete AlertDialog component */}
                <div>
                    <DeleteAlertDialog
                        node={node}
                        isOpen={isDeleteDialogOpen}
                        onClose={handleCloseDeleteDialog}
                        onConfirm={handleConfirmDelete}
                    />
                </div>
            </Card>
            <EditNodeModal nodeSetting={nodeSetting} node={node} isOpen={isEditNodeModalOpen} onCloseModal={() => setIsEditNodeModalOpen(false)}/>
        </div>
    );
};

export default Node;
