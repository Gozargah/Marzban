import { Alert, AlertIcon, Box, Button, HStack, Text } from "@chakra-ui/react";
import { ReloadIcon } from "components/common/user/Filters";
import { Status } from "core/types/User";

import { NodeType } from "contexts/NodesContext";
import { useTranslation } from "react-i18next";
import { getGetNodesQueryKey, useReconnectNode } from "services/api";
import { queryClient } from "utils/react-query";

interface Props {
  node: NodeType;
}

export function NodeErrorStatus({ node }: Props) {
  const { t } = useTranslation();
  const reconnectNode = useReconnectNode({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries(getGetNodesQueryKey()),
    },
  });

  const nodeStatus: Status = reconnectNode.isLoading ? "connecting" : node.status ? node.status : "error";

  if (nodeStatus !== "error") return null;

  return (
    <Alert status="error" size="xs">
      <Box w="full">
        <HStack w="full">
          <AlertIcon w={4} />
          <Text marginInlineEnd={0}>{node.message}</Text>
        </HStack>
        <HStack justifyContent="flex-end" w="full">
          <Button
            size="sm"
            aria-label="reconnect node"
            leftIcon={<ReloadIcon />}
            onClick={() =>
              reconnectNode.mutate({
                nodeId: node.id!,
              })
            }
            disabled={reconnectNode.isLoading}
          >
            {reconnectNode.isLoading ? t("nodes.reconnecting") : t("nodes.reconnect")}
          </Button>
        </HStack>
      </Box>
    </Alert>
  );
}
