import { Alert, AlertDescription, Button, HStack } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGetNodeSettings } from "service/api";

export function NodeCertificate() {
  const { t } = useTranslation();
  const { data } = useGetNodeSettings();
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(data?.certificate || "");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  return (
    <Alert status="info" alignItems="start" mb="3">
      <AlertDescription display="flex" alignItems="center" justifyContent="space-between" w="full">
        <span>{t("nodes.connection-hint")}</span>
        <HStack>
          <Button
            as="a"
            size="xs"
            colorScheme="primary"
            download="ssl_client_cert.pem"
            href={URL.createObjectURL(new Blob([data?.certificate || ""], { type: "text/plain" }))}
          >
            {t("nodes.download-certificate")}
          </Button>
          <Button size="xs" colorScheme="green" onClick={copyToClipboard}>
            {isCopied ? t("nodes.certificate-copied") : t("nodes.copy-certificate")}
          </Button>
        </HStack>
      </AlertDescription>
    </Alert>
  );
}
