import { Alert, AlertDescription, Button, HStack, IconButton, Tooltip } from "@chakra-ui/react";
import ClipboardIcon from "@heroicons/react/24/outline/ClipboardIcon";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGetNodeSettings } from "services/api";
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
    <Alert
      status="info"
      alignItems="start"
      mb="3"
      border="1px solid"
      bg="blackAlpha.50"
      borderColor="blackAlpha.100"
      _dark={{
        bg: "rgba(255, 255, 255, 0.04)",
        borderColor: "rgba(255, 255, 255, 0.06)",
      }}
    >
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
          <Tooltip
            placement="top"
            onClick={copyToClipboard}
            label={isCopied ? t("nodes.certificate-copied") : t("nodes.copy-certificate")}
          >
            <IconButton size="xs" aria-label={t("nodes.certificate-copied")}>
              <ClipboardIcon width="18" />
            </IconButton>
          </Tooltip>
        </HStack>
      </AlertDescription>
    </Alert>
  );
}
