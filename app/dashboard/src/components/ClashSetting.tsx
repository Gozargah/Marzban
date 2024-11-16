import {
  Button,
  chakra,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useColorMode,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { StreamLanguage } from "@codemirror/language";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { PencilIcon } from "@heroicons/react/24/outline";
import CodeMirror from "@uiw/react-codemirror";
import { useClash } from "contexts/ClashContext";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import { Icon } from "./Icon";

const EditIcon = chakra(PencilIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export const ClashSetting: FC = () => {
  const { loading, editingSetting, onEditingSetting, editSetting } = useClash();
  const isOpen = editingSetting !== null;
  const { colorMode } = useColorMode();
  const { t } = useTranslation();
  const toast = useToast();

  const [value, setValue] = useState(editingSetting?.content || "");

  const onClose = () => {
    onEditingSetting(null);
  };

  const save = () => {
    editSetting({ name: editingSetting!.name, content: value }).then(() => {
      toast({
        title: t("clash.setting.savedSuccess"),
        status: "success",
        isClosable: true,
        position: "top",
        duration: 3000,
      });
    });
  };

  useEffect(() => {
    if (editingSetting) {
      setValue(editingSetting.content);
    }
  }, [editingSetting]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3">
        <ModalHeader pt={6}>
          <HStack gap={2}>
            <Icon color="primary">
              <EditIcon color="white" />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {t("clash.setting.edit")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          <VStack w="full">
            <CodeMirror
              value={value}
              height="500px"
              theme={colorMode}
              extensions={[StreamLanguage.define(yaml)]}
              onChange={(v) => setValue(v)}
            />
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack w="full" justifyContent="flex-end">
            <Button
              colorScheme="primary"
              size="sm"
              minW={40}
              isDisabled={loading || value == editingSetting?.content}
              onClick={save}
              px={5}
            >
              {t("clash.save")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
