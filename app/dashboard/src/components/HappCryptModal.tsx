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
} from "@chakra-ui/react";
import {
  CheckIcon,
  ClipboardIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { Icon } from "./Icon";
import { Input } from "./Input";

const ModalIcon = chakra(ShieldCheckIcon, { baseStyle: { w: 5, h: 5 } });
const CopyBtnIcon = chakra(ClipboardIcon, { baseStyle: { w: 4, h: 4 } });
const CopiedBtnIcon = chakra(CheckIcon, { baseStyle: { w: 4, h: 4 } });

export const HappCryptModal: FC = () => {
  const { isHappCryptOpen, onHappCryptOpen } = useDashboard();
  const { t } = useTranslation();

  const [subLink, setSubLink] = useState("");
  const [happLink, setHappLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isHappCryptOpen) {
      setSubLink("");
      setHappLink("");
      setError("");
      setCopied(false);
    }
  }, [isHappCryptOpen]);

  const onClose = () => onHappCryptOpen(false);

  const generate = () => {
    if (!subLink.trim()) return;
    setLoading(true);
    setError("");
    setHappLink("");
    fetch("/utils/happ-crypt", { method: "POST", body: { url: subLink.trim() } })
      .then((data: { link: string }) => {
        setHappLink(data.link);
      })
      .catch((err) => {
        setError(err?.response?._data?.detail || t("happCrypt.error"));
      })
      .finally(() => setLoading(false));
  };

  const copy = () => {
    navigator.clipboard.writeText(happLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Modal isCentered isOpen={isHappCryptOpen} onClose={onClose} size="lg">
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
            {t("happCrypt.title")}
          </Text>
          <Text mt={1} fontSize="sm" _dark={{ color: "gray.400" }} color="gray.600">
            {t("happCrypt.description")}
          </Text>

          <FormControl mt={4}>
            <FormLabel fontSize="sm">{t("happCrypt.inputLabel")}</FormLabel>
            <Textarea
              value={subLink}
              onChange={(e) => setSubLink(e.target.value)}
              placeholder="https://..."
              fontFamily="mono"
              fontSize="xs"
              rows={3}
              resize="none"
            />
          </FormControl>

          <Button
            mt={3}
            w="full"
            size="sm"
            colorScheme="blue"
            isDisabled={!subLink.trim()}
            isLoading={loading}
            onClick={generate}
          >
            {t("happCrypt.generate")}
          </Button>

          {error && (
            <Alert status="error" rounded="md" fontSize="sm" mt={3}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          {happLink && (
            <FormControl mt={3}>
              <FormLabel fontSize="sm">{t("happCrypt.outputLabel")}</FormLabel>
              <HStack>
                <Input value={happLink} isReadOnly fontFamily="mono" fontSize="xs" />
                <Tooltip
                  label={copied ? t("usersTable.copied") : t("happCrypt.copy")}
                >
                  <IconButton aria-label="copy happ link" size="sm" onClick={copy}>
                    {copied ? <CopiedBtnIcon /> : <CopyBtnIcon />}
                  </IconButton>
                </Tooltip>
              </HStack>
            </FormControl>
          )}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" onClick={onClose} w="full" variant="outline">
            {t("cancel")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
