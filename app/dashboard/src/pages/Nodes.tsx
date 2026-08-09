/**
 * Nodes screen.
 *
 * The stock panel showed nodes as a stack of accordions inside a narrow dialog,
 * so the state of the fleet was only visible one node at a time. Here every
 * node is a card with its status, version and endpoints on the face of it, and
 * editing happens in a dialog on top.
 */
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  ButtonProps,
  Checkbox,
  Collapse,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Skeleton,
  Switch,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  PlusIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeleteNodeModal } from "components/DeleteNodeModal";
import { EmptyState, Field, MetaItem, Panel, PageHeader, Section } from "components/ui";
import { useDashboard } from "contexts/DashboardContext";
import {
  FetchNodesQueryKey,
  getNodeDefaultValues,
  NodeSchema,
  NodeType,
  useNodes,
  useNodesQuery,
} from "contexts/NodesContext";
import { FC, ReactNode, useEffect, useState } from "react";
import { Controller, useForm, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { UseMutateFunction, useMutation, useQuery, useQueryClient } from "react-query";
import { fetch } from "service/http";
import { Status } from "types/User";
import { generateErrorMessage, generateSuccessMessage } from "utils/toastHandler";

const STATUS_TONE: Record<string, { scheme: string; dot: string }> = {
  connected: { scheme: "green", dot: "green.400" },
  connecting: { scheme: "orange", dot: "orange.400" },
  error: { scheme: "red", dot: "red.400" },
  disabled: { scheme: "gray", dot: "gray.400" },
};

const StatusPill: FC<{ status: Status }> = ({ status }) => {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status] ?? STATUS_TONE.error;
  return (
    <Badge colorScheme={tone.scheme} display="inline-flex" alignItems="center" gap="1.5">
      <Box w="6px" h="6px" borderRadius="full" bg={tone.dot} />
      {t(`nodeModal.status.${status}`)}
    </Badge>
  );
};

type NodeFormProps = {
  form: UseFormReturn<NodeType>;
  mutate: UseMutateFunction<unknown, unknown, any>;
  isLoading: boolean;
  submitBtnText: string;
  btnProps?: Partial<ButtonProps>;
  btnLeftAdornment?: ReactNode;
  addAsHost?: boolean;
};

const NodeForm: FC<NodeFormProps> = ({
  form,
  mutate,
  isLoading,
  submitBtnText,
  btnProps = {},
  btnLeftAdornment,
  addAsHost = false,
}) => {
  const { t } = useTranslation();
  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit((v) => mutate(v))}>
      <VStack align="stretch" spacing="4">
        <HStack align="flex-end" spacing="3">
          <Box flex="1">
            <Field label={t("nodes.nodeName")} error={errors.name?.message}>
              <Input placeholder="Marzban-S2" {...form.register("name")} />
            </Field>
          </Box>
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Tooltip
                key={String(field.value)}
                placement="top"
                label={
                  `${t("usersTable.status")}: ` +
                  (field.value !== "disabled" ? t("active") : t("disabled"))
                }
              >
                <Box pb="2.5">
                  <Switch
                    isChecked={field.value !== "disabled"}
                    onChange={(e) => field.onChange(e.target.checked ? "connecting" : "disabled")}
                  />
                </Box>
              </Tooltip>
            )}
          />
        </HStack>

        <Field label={t("nodes.nodeAddress")} error={errors.address?.message}>
          <Input placeholder="51.20.12.13" {...form.register("address")} />
        </Field>

        <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
          <Field label={t("nodes.nodePort")} error={errors.port?.message}>
            <Input placeholder="62050" {...form.register("port")} />
          </Field>
          <Field label={t("nodes.nodeAPIPort")} error={errors.api_port?.message}>
            <Input placeholder="62051" {...form.register("api_port")} />
          </Field>
          <Field
            label={t("nodes.usageCoefficient")}
            hint="Множитель трафика: 2 — каждый гигабайт списывается как два."
            error={errors.usage_coefficient?.message}
          >
            <Input placeholder="1" {...form.register("usage_coefficient")} />
          </Field>
        </SimpleGrid>

        {addAsHost && (
          <Checkbox {...form.register("add_as_new_host")}>
            <Text fontSize="sm">{t("nodes.addHostForEveryInbound")}</Text>
          </Checkbox>
        )}

        <HStack w="full" justify="space-between" pt="1">
          {btnLeftAdornment ?? <Box />}
          <Button type="submit" colorScheme="primary" isLoading={isLoading} px="6" {...btnProps}>
            {submitBtnText}
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};

/** The client certificate every node needs before it will accept the panel. */
const CertificateSection: FC = () => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const { data } = useQuery({
    queryKey: "node-settings",
    queryFn: () => fetch<{ min_node_version: string; certificate: string }>("/node/settings"),
  });

  if (!data?.certificate) return null;

  const selectAll = (el: HTMLElement) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  return (
    <Section
      icon={ShieldCheckIcon}
      title={t("nodes.connection-hint")}
      actions={
        <HStack spacing="2">
          <Button
            as="a"
            size="sm"
            variant="outline"
            leftIcon={<ArrowDownTrayIcon width="16" />}
            download="ssl_client_cert.pem"
            href={URL.createObjectURL(new Blob([data.certificate], { type: "text/plain" }))}
          >
            {t("nodes.download-certificate")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShow((v) => !v)}>
            {show ? <EyeSlashIcon width="16" /> : <EyeIcon width="16" />}
          </Button>
        </HStack>
      }
      bodyProps={{ p: show ? undefined : "0" }}
    >
      <Collapse in={show} animateOpacity>
        <Text
          bg="ui.surfaceMuted"
          borderRadius="lg"
          p="3"
          lineHeight="1.35"
          fontSize="10px"
          fontFamily="mono"
          whiteSpace="pre"
          overflow="auto"
          onClick={(e) => selectAll(e.target as HTMLElement)}
        >
          {data.certificate}
        </Text>
      </Collapse>
    </Section>
  );
};

const NodeCard: FC<{ node: NodeType; onEdit: () => void }> = ({ node, onEdit }) => {
  const { reconnectNode, setDeletingNode } = useNodes();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { isLoading: isReconnecting, mutate: reconnect } = useMutation(
    reconnectNode.bind(null, node),
    { onSuccess: () => queryClient.invalidateQueries(FetchNodesQueryKey) }
  );

  const status: Status = isReconnecting ? "connecting" : node.status ?? "error";

  return (
    <Panel p="4" display="flex" flexDirection="column" gap="3">
      <HStack justify="space-between" align="flex-start" gap="2">
        <Box minW="0">
          <Text fontWeight="600" noOfLines={1}>
            {node.name}
          </Text>
          <Text fontSize="xs" color="ui.textMuted" noOfLines={1}>
            {node.address}
          </Text>
        </Box>
        <VStack align="flex-end" spacing="1" flexShrink={0}>
          <StatusPill status={status} />
          {node.xray_version && <Badge colorScheme="gray">Xray {node.xray_version}</Badge>}
        </VStack>
      </HStack>

      <SimpleGrid columns={3} gap="2">
        <MetaItem label={t("nodes.nodePort")} value={node.port} />
        <MetaItem label="API" value={node.api_port} />
        <MetaItem label="×" value={node.usage_coefficient} />
      </SimpleGrid>

      {status === "error" && node.message && (
        <Alert status="error" fontSize="xs" alignItems="flex-start">
          <AlertIcon boxSize="4" />
          <Text noOfLines={3}>{node.message}</Text>
        </Alert>
      )}

      <HStack spacing="1" justify="flex-end" mt="auto" pt="1">
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<ArrowPathIcon width="16" />}
          onClick={() => reconnect()}
          isLoading={isReconnecting}
        >
          {t("nodes.reconnect")}
        </Button>
        <Tooltip label={t("nodes.editNode")} placement="top">
          <IconButton
            aria-label="edit node"
            size="sm"
            variant="ghost"
            icon={<PencilSquareIcon width="18" />}
            onClick={onEdit}
          />
        </Tooltip>
        <Tooltip label={t("delete")} placement="top">
          <IconButton
            aria-label="delete node"
            size="sm"
            variant="ghost"
            colorScheme="red"
            icon={<TrashIcon width="18" />}
            onClick={() => setDeletingNode(node)}
          />
        </Tooltip>
      </HStack>
    </Panel>
  );
};

const EditNodeModal: FC<{ node: NodeType | null; onClose: () => void }> = ({ node, onClose }) => {
  const { updateNode } = useNodes();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<NodeType>({ resolver: zodResolver(NodeSchema) });

  useEffect(() => {
    if (node) form.reset(node);
  }, [node]);

  const { isLoading, mutate } = useMutation(updateNode, {
    onSuccess: () => {
      generateSuccessMessage("Node updated successfully", toast);
      queryClient.invalidateQueries(FetchNodesQueryKey);
      onClose();
    },
    onError: (e) => {
      generateErrorMessage(e, toast, form);
    },
  });

  return (
    <Modal isOpen={!!node} onClose={onClose} isCentered size="lg">
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(6px)" />
      <ModalContent mx="3">
        <ModalHeader>{node?.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="6">
          <NodeForm
            form={form}
            mutate={mutate}
            isLoading={isLoading}
            submitBtnText={t("nodes.editNode")}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const AddNodeModal: FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { addNode } = useNodes();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<NodeType>({
    resolver: zodResolver(NodeSchema),
    defaultValues: { ...getNodeDefaultValues(), add_as_new_host: false },
  });

  const { isLoading, mutate } = useMutation(addNode, {
    onSuccess: () => {
      generateSuccessMessage(t("nodes.addNodeSuccess", { name: form.getValues("name") }), toast);
      queryClient.invalidateQueries(FetchNodesQueryKey);
      form.reset();
      onClose();
    },
    onError: (e) => {
      generateErrorMessage(e, toast, form);
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(6px)" />
      <ModalContent mx="3">
        <ModalHeader>{t("nodes.addNewMarzbanNode")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="6">
          <NodeForm
            form={form}
            mutate={mutate}
            isLoading={isLoading}
            submitBtnText={t("nodes.addNode")}
            addAsHost
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export const Nodes: FC = () => {
  const { t } = useTranslation();
  const { onEditingNodes } = useDashboard();
  const { data: nodes, isLoading } = useNodesQuery();
  const addModal = useDisclosure();
  const [editing, setEditing] = useState<NodeType | null>(null);

  // the query polls every few seconds only while this flag is on
  useEffect(() => {
    onEditingNodes(true);
    return () => onEditingNodes(false);
  }, []);

  return (
    <Box w="full">
      <PageHeader
        title={t("header.nodeSettings")}
        description={t("nodes.title")}
        icon={ServerStackIcon}
        actions={
          <Button
            size="sm"
            colorScheme="primary"
            leftIcon={<PlusIcon width="16" />}
            onClick={addModal.onOpen}
          >
            {t("nodes.addNode")}
          </Button>
        }
      />

      <VStack align="stretch" spacing="4">
        <CertificateSection />

        {isLoading ? (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height="170px" borderRadius="xl" />
            ))}
          </SimpleGrid>
        ) : nodes && nodes.length > 0 ? (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
            {nodes.map((node) => (
              <NodeCard key={node.id ?? node.name} node={node} onEdit={() => setEditing(node)} />
            ))}
          </SimpleGrid>
        ) : (
          <Panel>
            <EmptyState
              icon={ServerStackIcon}
              title="Нод пока нет"
              description="Панель раздаёт трафик сама. Добавь ноду, чтобы вынести трафик на отдельный сервер."
              action={
                <Button
                  size="sm"
                  colorScheme="primary"
                  leftIcon={<PlusIcon width="16" />}
                  onClick={addModal.onOpen}
                >
                  {t("nodes.addNode")}
                </Button>
              }
            />
          </Panel>
        )}
      </VStack>

      <AddNodeModal isOpen={addModal.isOpen} onClose={addModal.onClose} />
      <EditNodeModal node={editing} onClose={() => setEditing(null)} />
      <DeleteNodeModal deleteCallback={() => setEditing(null)} />
    </Box>
  );
};

export default Nodes;
