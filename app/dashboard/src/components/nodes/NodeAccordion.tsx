import {
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  HStack,
  IconButton,
  Text,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { NodeSchema, NodeType } from "contexts/NodesContext";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Status } from "types/User";
import { generateErrorMessage, generateSuccessMessage } from "utils/toastHandler";
import { useDashboard } from "../../contexts/DashboardContext";
import { DeleteIcon } from "../DeleteUserModal";
import { StatusBadge } from "../StatusBadge";

import { getGetNodesQueryKey, useModifyNode } from "service/api";
import { NodeErrorStatus } from "./NodeErrorStatus";
import { NodeForm } from "./NodeForm";
import { queryClient } from "utils/react-query";
import { DeleteNodeModal } from "./DeleteNodeModal";
import { useState } from "react";

interface Props {
  node: NodeType;
  toggleAccordion: () => void;
}

export function NodeAccordion({ toggleAccordion, node }: Props) {
  const toast = useToast();
  const { t } = useTranslation();
  const modifyNode = useModifyNode();
  const [isDeleteModalOpen, setOpenDeleteModal] = useState(false);
  const form = useForm<NodeType>({
    defaultValues: node,
    resolver: zodResolver(NodeSchema),
  });

  const onSubmit = async (data: NodeType) => {
    try {
      modifyNode.mutateAsync({ data, nodeId: data.id! });
      generateSuccessMessage("Node updated successfully", toast);
      queryClient.invalidateQueries(getGetNodesQueryKey());
    } catch (e) {
      generateErrorMessage(e, toast, form);
    }
  };

  const nodeStatus: Status = node.status ? node.status : "error";

  return (
    <AccordionItem
      p={1}
      w="full"
      border="1px solid"
      borderRadius="4px"
      _dark={{ borderColor: "gray.600" }}
      _light={{ borderColor: "gray.200" }}
    >
      <AccordionButton px={2} borderRadius="3px" onClick={toggleAccordion}>
        <HStack w="full" justifyContent="space-between" pr={2}>
          <Text
            flex="1"
            as="span"
            fontSize="sm"
            textAlign="left"
            color="gray.700"
            fontWeight="medium"
            _dark={{ color: "gray.300" }}
          >
            {node.name}
          </Text>
          <HStack>
            {node.xray_version && (
              <Badge colorScheme="blue" rounded="full" display="inline-flex" px={3} py={1}>
                <Text fontSize="0.7rem" fontWeight="medium" letterSpacing="tighter" textTransform="capitalize">
                  Xray {node.xray_version}
                </Text>
              </Badge>
            )}
            {node.status && <StatusBadge status={nodeStatus} compact />}
          </HStack>
        </HStack>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel px={2} pb={2}>
        <NodeErrorStatus node={node} />
        <DeleteNodeModal node={node} isOpen={isDeleteModalOpen} onClose={() => setOpenDeleteModal(false)} />
        <NodeForm
          form={form}
          onSubmit={onSubmit}
          isLoading={modifyNode.isLoading}
          submitBtnText={t("nodes.editNode")}
          btnLeftAdornment={
            <Tooltip label={t("delete")} placement="top">
              <IconButton
                colorScheme="red"
                variant="ghost"
                size="sm"
                aria-label="delete node"
                onClick={() => setOpenDeleteModal(true)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          }
        />
      </AccordionPanel>
    </AccordionItem>
  );
}
