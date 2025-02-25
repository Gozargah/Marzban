import useDirDetection from "@/hooks/use-dir-detection.tsx";
import {useTranslation} from "react-i18next";
import {Copy, Download} from "lucide-react";
import {NodeSettings} from "@/service/api";
import {Button} from "@/components/ui/button.tsx";

const NodesCertificate = ({certificate}: { certificate: NodeSettings | undefined }) => {
    const dir = useDirDetection();
    const {t} = useTranslation();

    const copyCertificate = () => {
        if (certificate) {
            //method}
        }
    }
    const downloadCertificate = () => {
        //method
    }

    return (
        <div dir={dir}
             className="w-full mx-auto py-4 md:pt-6 gap-4 flex items-start justify-between flex-wrap px-4 align-middle">
            <div className="flex flex-col gap-y-1 sm:max-w-[80%] max-w-[60%] ">
                <h1 className="font-[600] text-lg sm:text-2xl">{t('nodes.certificate')}</h1>
                <span
                    className="text-muted-foreground text-sm font-normal leading-5 text-ellipsis whitespace-nowrap overflow-hidden sm:whitespace-pre-wrap sm:overflow-visible">{t("nodes.connection-hint")}</span>
            </div>
            <div className="flex flex-row sm:gap-4 gap-2">
                <Button size={"icon"} variant={"ghost"} onClick={() => copyCertificate()}>
                    <Copy />
                </Button>
                <Button size={"icon"} onClick={() => downloadCertificate()}>
                    <Download className="text-foreground"/>
                </Button>
            </div>
        </div>
    );
};


export default NodesCertificate;
