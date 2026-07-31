import {
  Alert,
  AlertIcon,
  Box,
  Button,
  chakra,
  FormControl,
  FormLabel,
  HStack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  LockOpenIcon,
} from "@heroicons/react/24/outline";
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Footer } from "components/Footer";
import { Input } from "components/Input";
import { Language } from "components/Language";
import { decryptText } from "utils/crypt";
import { ReactComponent as Logo } from "assets/logo.svg";

export const LogoIcon = chakra(Logo, {
  baseStyle: {
    strokeWidth: "10px",
    w: 12,
    h: 12,
  },
});

const DecryptIcon = chakra(LockOpenIcon, {
  baseStyle: { w: 5, h: 5, strokeWidth: "2px" },
});
const OpenIcon = chakra(ArrowTopRightOnSquareIcon, {
  baseStyle: { w: 4, h: 4 },
});
const CopyIcon = chakra(ClipboardIcon, { baseStyle: { w: 4, h: 4 } });

export const DecryptPage: FC = () => {
  const { t } = useTranslation();
  const [encrypted, setEncrypted] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const decrypt = () => {
    setError("");
    setResult("");
    decryptText(encrypted, passphrase)
      .then(setResult)
      .catch(() => setError(t("decryptPage.error")));
  };

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <VStack justifyContent="space-between" minH="100vh" p="6" w="full">
      <Box w="full">
        <HStack justifyContent="end" w="full">
          <Language />
        </HStack>
        <HStack w="full" justifyContent="center" alignItems="center">
          <Box w="full" maxW="420px" mt="6">
            <VStack alignItems="center" w="full">
              <LogoIcon />
              <Text fontSize="2xl" fontWeight="semibold">
                {t("decryptPage.title")}
              </Text>
              <Text
                color="gray.600"
                _dark={{ color: "gray.400" }}
                textAlign="center"
                fontSize="sm"
              >
                {t("decryptPage.description")}
              </Text>
            </VStack>
            <VStack mt={6} rowGap={3} alignItems="stretch">
              <FormControl>
                <FormLabel fontSize="sm">
                  {t("decryptPage.encryptedText")}
                </FormLabel>
                <Textarea
                  value={encrypted}
                  onChange={(e) => setEncrypted(e.target.value)}
                  fontFamily="mono"
                  fontSize="xs"
                  rows={4}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">
                  {t("decryptPage.passphrase")}
                </FormLabel>
                <Input
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </FormControl>
              <Button
                colorScheme="primary"
                isDisabled={!encrypted || !passphrase}
                onClick={decrypt}
                leftIcon={<DecryptIcon />}
              >
                {t("decryptPage.decrypt")}
              </Button>

              {error && (
                <Alert status="error" rounded="md" fontSize="sm">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              {result && (
                <FormControl>
                  <FormLabel fontSize="sm">
                    {t("decryptPage.result")}
                  </FormLabel>
                  <Textarea value={result} isReadOnly fontSize="xs" rows={3} />
                  <HStack mt={2}>
                    <Button
                      size="sm"
                      w="full"
                      onClick={copy}
                      leftIcon={<CopyIcon />}
                    >
                      {copied ? t("usersTable.copied") : t("decryptPage.copy")}
                    </Button>
                    <Button
                      as="a"
                      href={result}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      w="full"
                      leftIcon={<OpenIcon />}
                    >
                      {t("decryptPage.open")}
                    </Button>
                  </HStack>
                </FormControl>
              )}
            </VStack>
          </Box>
        </HStack>
      </Box>
      <Footer />
    </VStack>
  );
};

export default DecryptPage;
