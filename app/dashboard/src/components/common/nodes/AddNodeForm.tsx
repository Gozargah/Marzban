import { AccordionButton, AccordionItem, AccordionPanel, Text, chakra, useToast } from "@chakra-ui/react";
import { PlusIcon as HeroIconPlusIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { NodeSchema, NodeType } from "contexts/NodesContext";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { generateErrorMessage, generateSuccessMessage } from "utils/toastHandler";

import { getGetNodesQueryKey, useAddNode } from "services/api";
import { queryClient } from "utils/react-query";
import { NodeCertificate } from "./NodeCertificate";
import { NodeForm } from "./NodeForm";

interface Props {
  toggleAccordion: VoidFunction;
  resetAccordions: VoidFunction;
}

export function AddNodeForm({ toggleAccordion, resetAccordions }: Props) {
  const toast = useToast();
  const addNode = useAddNode();
  const { t } = useTranslation();
  const form = useForm<NodeType>({
    resolver: zodResolver(NodeSchema),
    defaultValues: {
      port: 62050,
      api_port: 62051,
      add_as_new_host: true,
    },
  });

  const onSubmit = async (data: NodeType) => {
    try {
      await addNode.mutateAsync({ data });
      generateSuccessMessage(t("nodes.addNodeSuccess", { name: form.getValues("name") }), toast);
      queryClient.invalidateQueries(getGetNodesQueryKey());
      form.reset();
      resetAccordions();
    } catch (e) {
      generateErrorMessage(e, toast, form);
    }
  };

  return (
    <AccordionItem
      p={1}
      w="full"
      borderRadius="4px"
      border="1px solid"
      _dark={{ borderColor: "gray.600" }}
      _light={{ borderColor: "gray.200" }}
    >
      <AccordionButton px={2} borderRadius="3px" onClick={toggleAccordion}>
        <Text
          as="span"
          fontWeight="medium"
          fontSize="sm"
          flex="1"
          textAlign="left"
          color="gray.700"
          _dark={{ color: "gray.300" }}
          display="flex"
          gap={1}
        >
          <PlusIcon display={"inline-block"} /> <span>{t("nodes.addNewMarzbanNode")}</span>
        </Text>
      </AccordionButton>
      <AccordionPanel px={2} py={4}>
        <NodeCertificate />
        <NodeForm
          addAsHost
          form={form}
          onSubmit={onSubmit}
          isLoading={addNode.isLoading}
          submitBtnText={t("nodes.addNode")}
          btnProps={{ variant: "solid" }}
        />
      </AccordionPanel>
    </AccordionItem>
  );
}

const PlusIcon = chakra(HeroIconPlusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    strokeWidth: 2,
  },
});
