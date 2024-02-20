import {
  Accordion,
  chakra,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from "@chakra-ui/react";
import { SquaresPlusIcon } from "@heroicons/react/24/outline";
import { useNodesQuery } from "contexts/NodesContext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import { useDashboard } from "../../../contexts/DashboardContext";
import { Icon } from "../../tools/Icon";

import { AddNodeForm } from "./AddNodeForm";
import { NodeAccordion } from "./NodeAccordion";

export function NodesDialog() {
  const { t } = useTranslation();
  const { data: nodes, isLoading } = useNodesQuery();
  const { isEditingNodes, onEditingNodes } = useDashboard();
  const [openAccordions, setOpenAccordions] = useState<any>({});

  const onClose = () => {
    setOpenAccordions({});
    onEditingNodes(false);
  };

  const toggleAccordion = (index: number | string) => {
    if (openAccordions[String(index)]) {
      delete openAccordions[String(index)];
    } else openAccordions[String(index)] = {};
    setOpenAccordions({ ...openAccordions });
  };

  return (
    <>
      <Modal isOpen={isEditingNodes} onClose={onClose}>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent mx="3" maxW="450px">
          <ModalHeader pt={6} display="flex" gap="4" alignItems="center">
            <Icon color="primary">
              <ModalIcon color="white" />
            </Icon>
            <Text>Nodes</Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text mb={3} opacity={0.8} fontSize="sm">
              {t("nodes.title")}
            </Text>
            {isLoading && "loading..."}
            <Accordion w="full" allowToggle index={Object.keys(openAccordions).map((i) => parseInt(i))}>
              <VStack w="full">
                {nodes?.map((node, index) => (
                  <NodeAccordion toggleAccordion={() => toggleAccordion(index)} key={node.name} node={node} />
                ))}
                <AddNodeForm
                  toggleAccordion={() => toggleAccordion((nodes || []).length)}
                  resetAccordions={() => setOpenAccordions({})}
                />
              </VStack>
            </Accordion>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

const ModalIcon = chakra(SquaresPlusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});
