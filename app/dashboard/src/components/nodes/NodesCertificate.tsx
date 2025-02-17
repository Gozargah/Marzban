import useDirDetection from "@/hooks/use-dir-detection.tsx";
import {useTranslation} from "react-i18next";
import {Badge} from "@/components/ui/badge.tsx";
import {Copy, Download} from "lucide-react";

const NodesCertificate = () => {
    const dir = useDirDetection();
    const {t} = useTranslation();

    const copyCertificate = () => {
        //method
    }
    const downloadCertificate = () => {
        //method
    }

    return (
        <div dir={dir}
             className="w-full mx-auto py-4 md:pt-6 gap-4 flex items-start justify-between flex-wrap px-4 align-middle">
            <div className="flex flex-col gap-y-1 sm:max-w-[80%] max-w-[60%] ">
                <h1 className="font-medium text-lg sm:text-xl">{t('nodes.certificate')}</h1>
                <span
                    className="text-muted-foreground text-xl sm:text-sm text-ellipsis whitespace-nowrap overflow-hidden sm:whitespace-pre-wrap sm:overflow-visible">{t("nodes.connection-hint")}</span>
            </div>
            <div className="flex flex-row ">
                <Badge className="px-2 py-2 mx-3 bg-border" onClick={() => copyCertificate()}>
                    <Copy className="text-foreground h-4 w-4"/>
                </Badge>
                <Badge className="px-2 py-2 bg-secondary" onClick={() => downloadCertificate()}>
                    <Download className="text-foreground h-4 w-4"/>
                </Badge>
            </div>
        </div>
    );
};

export default NodesCertificate;
