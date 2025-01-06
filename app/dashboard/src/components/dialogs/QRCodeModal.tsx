import { FC, useState, useEffect, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";
import { ScanQrCode } from "lucide-react";

interface QRCodeModalProps {
  QRcodeLinks: string[] | null;
  subscribeUrl: string | null;
  onCloseModal: () => void;
}

const QRCodeModal: FC<QRCodeModalProps> = memo(
  ({ QRcodeLinks, subscribeUrl, onCloseModal }) => {
    const isOpen = QRcodeLinks !== null;
    const [index, setIndex] = useState(0);
    const [api, setApi] = useState<CarouselApi>();

    const { t } = useTranslation();

    const subscribeQrLink = String(subscribeUrl).startsWith("/")
      ? window.location.origin + subscribeUrl
      : String(subscribeUrl);

    useEffect(() => {
      if (!api) return;

      const updateIndex = () => setIndex(api.selectedScrollSnap() + 1);
      updateIndex();

      api.on("select", updateIndex);
      return () => {
        api.off("select", updateIndex);
      };
    }, [api]);

    return (
      <Dialog open={isOpen} onOpenChange={onCloseModal}>
        <DialogContent className="max-w-[425px] md:max-w-[750px] py-28 md:py-6 overflow-y-auto max-h-screen md:pt-10">
          <DialogHeader>
            <DialogTitle>
              <div className="px-2">

              <ScanQrCode className="h-8 w-8" />
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col md:flex-row md:gap-x-8">
            <div className="flex justify-center py-4">
              <div className="flex flex-col justify-center items-center py-4 gap-y-4 m-2">
                <QRCodeCanvas
                  value={subscribeQrLink}
                  size={300}
                  className="bg-white p-2 rounded-md"
                />
                <span>{t("qrcodeDialog.sublink")}</span>
              </div>
            </div>
            <div className="flex flex-col justify-center items-center py-4 gap-y-4">
              <Carousel
                opts={{
                  loop: true,
                }}
                setApi={setApi}
                className="w-full max-w-xs pt-2"
              >
                <CarouselContent>
                  {QRcodeLinks?.map((_, index) => (
                    <CarouselItem key={index}>
                      <QRCodeCanvas
                        value={QRcodeLinks[index]}
                        size={300}
                        className="bg-white p-2 rounded-md"
                        level={"L"}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="ml-6" />
                <CarouselNext className="mr-6" />
              </Carousel>
              <span>
                {index} / {QRcodeLinks?.length}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

export default QRCodeModal;
