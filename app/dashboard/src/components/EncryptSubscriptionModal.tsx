import {
  Alert,
  AlertIcon,
  Button,
  chakra,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Text,
  Textarea,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboard } from "contexts/DashboardContext";
import { encryptText, generatePassphrase } from "utils/crypt";
import { Icon } from "./Icon";
import { Input } from "./Input";

const ModalIcon = chakra(LockClosedIcon, { baseStyle: { w: 5, h: 5 } });
const RegenerateIcon = chakra(ArrowPathIcon, { baseStyle: { w: 4, h: 4 } });
const CopyBtnIcon = chakra(ClipboardIcon, { baseStyle: { w: 4, h: 4 } });
const CopiedBtnIcon = chakra(CheckIcon, { baseStyle: { w: 4, h: 4 } });

export const EncryptSubscriptionModal: FC = () => {
  const { encryptSubUser, setEncryptSubUser } = useDashboard();
  const { t } = useTranslation();
  const isOpen = !!encryptSubUser;

  const [passphrase, setPassphrase] = useState("");
  const [encrypted, setEncrypted] = useState("");
  const [copied, setCopied] = useState<"text" | "pass" | null>(null);
  const [error, setError] = useState("");

  const subLink = encryptSubUser
    ? encryptSubUser.subscription_url.startsWith("/")
      ? window.location.origin + encryptSubUser.subscription_url
      : encryptSubUser.subscription_url
    : "";

  const decryptUrl =
    window.location.origin + window.location.pathname + "#/decrypt/";

  const regenerate = () => {
    setPassphrase(generatePassphrase());
  };

  useEffect(() => {
    if (isOpen) {
      setEncrypted("");
      setError("");
      setCopied(null);
      regenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !passphrase) return;
    setError("");
    encryptText(subLink, passphrase)
      .then(setEncrypted)
      .catch(() => setError(t("encryptSubModal.error")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passphrase, isOpen]);

  const onClose = () => setEncryptSubUser(null);

  const copy = (value: string, which: "text" | "pass") => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <Modal isCentered isOpen={isOpen} onClose={onClose} size="lg">
      <ModalCloseButton mt={3} />
      <ModalContent mx="3">
        <ModalHeader pt={6}>
          <Icon color="blue">
            <ModalIcon />
          </Icon>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          <Text fontWeight="semibold" fontSize="lg">
            {t("encryptSubModal.title")}
          </Text>
          <Text
            mt={1}
            fontSize="sm"
            _dark={{ color: "gray.400" }}
            color="gray.600"
          >
            {t("encryptSubModal.description")}
          </Text>

          <VStack mt={4} spacing={3} alignItems="stretch">
            <FormControl>
              <FormLabel fontSize="sm">
                {t("encryptSubModal.passphrase")}
              </FormLabel>
              <HStack>
                <Input
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
                <Tooltip label={t("encryptSubModal.generate")}>
                  <IconButton
                    aria-label="generate passphrase"
                    size="sm"
                    onClick={regenerate}
                  >
                    <RegenerateIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  label={
                    copied === "pass"
                      ? t("usersTable.copied")
                      : t("encryptSubModal.copyPassphrase")
                  }
                >
                  <IconButton
                    aria-label="copy passphrase"
                    size="sm"
                    onClick={() => copy(passphrase, "pass")}
                  >
                    {copied === "pass" ? <CopiedBtnIcon /> : <CopyBtnIcon />}
                  </IconButton>
                </Tooltip>
              </HStack>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">
                {t("encryptSubModal.encryptedText")}
              </FormLabel>
              <Textarea
                value={encrypted}
                isReadOnly
                fontFamily="mono"
                fontSize="xs"
                rows={4}
                resize="none"
              />
            </FormControl>

            {error && (
              <Alert status="error" rounded="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <Alert status="warning" rounded="md" fontSize="sm">
              <AlertIcon />
              {t("encryptSubModal.shareWarning")}
            </Alert>

            <Text fontSize="xs" _dark={{ color: "gray.400" }} color="gray.600">
              {t("encryptSubModal.decryptHint", { url: decryptUrl })}
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter display="flex">
          <Button size="sm" onClick={onClose} mr={3} w="full" variant="outline">
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            w="full"
            colorScheme="blue"
            isDisabled={!encrypted}
            onClick={() => copy(encrypted, "text")}
            leftIcon={copied === "text" ? <CopiedBtnIcon /> : <CopyBtnIcon />}
          >
            {copied === "text"
              ? t("usersTable.copied")
              : t("encryptSubModal.copyEncrypted")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
