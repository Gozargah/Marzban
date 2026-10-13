import { useEffect, useId, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, Resolver, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Network, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  FetchNodesQueryKey,
  getNodeDefaultValues,
  NodeSchema,
  NodeType,
  useNodes,
  useNodesQuery,
} from "@/contexts/nodes-context";
import { useDashboard } from "@/contexts/dashboard-context";
import { fetch } from "service/http";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { FormInput } from "./form-input";
import { DeleteNodeModal } from "./delete-node-modal";
import { NodeModalStatusBadge } from "./node-modal-status-badge";

function NodeForm({ node, onSaved, onDelete }: { node?: NodeType; onSaved: () => void; onDelete?: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const addNode = useNodes((state) => state.addNode);
  const updateNode = useNodes((state) => state.updateNode);
  const queryClient = useQueryClient();
  const form = useForm<NodeType>({
    defaultValues: node ?? { ...getNodeDefaultValues(), add_as_new_host: false },
    resolver: zodResolver(NodeSchema) as Resolver<NodeType>,
  });
  const [error, setError] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string>();
  const { data: settings } = useQuery({
    queryKey: ["node-settings"],
    queryFn: () => fetch<{ certificate: string; min_node_version: string }>("/node/settings"),
    enabled: !node,
  });
  useEffect(() => {
    if (!settings?.certificate) return;
    const url = URL.createObjectURL(new Blob([settings.certificate], { type: "text/plain" }));
    setCertificateUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [settings?.certificate]);
  const { mutate, isPending } = useMutation({
    mutationKey: ["dashboard-node-write"],
    mutationFn: node ? updateNode : addNode,
    onSuccess: () => {
      toast.success(
        node
          ? t("nodes.editNode", { defaultValue: "Node updated" })
          : t("nodes.addNodeSuccess", { name: form.getValues("name") }),
      );
      queryClient.invalidateQueries({ queryKey: [FetchNodesQueryKey] });
      if (!node) form.reset();
      onSaved();
    },
    onError: (error: any) => {
      const detail = error?.response?._data?.detail;
      if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        Object.entries(detail).forEach(([key, message]) =>
          form.setError(key as keyof NodeType, { message: String(message) }),
        );
      }
      setError(
        typeof detail === "string"
          ? detail
          : t("nodes.saveError", { defaultValue: "Could not save the node. Please try again." }),
      );
    },
  });
  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        setError(null);
        mutate(values);
      })}
      aria-busy={isPending}
    >
      <fieldset disabled={isPending} className="min-w-0 space-y-4">
        {!node && settings?.certificate && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>{t("nodes.connection-hint")}</p>
              <div className="flex justify-end gap-2">
                {certificateUrl && (
                  <a
                    href={certificateUrl}
                    download="ssl_client_cert.pem"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t("nodes.download-certificate")}
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("nodes.show-certificate")}
                  aria-expanded={showCertificate}
                  onClick={() => setShowCertificate((value) => !value)}
                >
                  {showCertificate ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              {showCertificate && (
                <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs" dir="ltr">
                  {settings.certificate}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-end gap-3">
          <FormInput
            label={t("nodes.nodeName")}
            placeholder="Marzban-S2"
            {...form.register("name")}
            error={form.formState.errors.name?.message}
          />
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Switch
                className="mb-2"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                disabled={isPending}
                checked={field.value !== "disabled"}
                onCheckedChange={(checked) => field.onChange(checked ? "connecting" : "disabled")}
                aria-label={t("usersTable.status")}
              />
            )}
          />
        </div>
        <FormInput
          label={t("nodes.nodeAddress")}
          placeholder="51.20.12.13"
          {...form.register("address")}
          error={form.formState.errors.address?.message}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormInput
            label={t("nodes.nodePort")}
            type="number"
            min={1}
            max={65535}
            {...form.register("port", { valueAsNumber: true })}
            error={form.formState.errors.port?.message}
          />
          <FormInput
            label={t("nodes.nodeAPIPort")}
            type="number"
            min={1}
            max={65535}
            {...form.register("api_port", { valueAsNumber: true })}
            error={form.formState.errors.api_port?.message}
          />
          <FormInput
            label={t("nodes.usageCoefficient")}
            type="number"
            min={0}
            step="any"
            {...form.register("usage_coefficient", { valueAsNumber: true })}
            error={form.formState.errors.usage_coefficient?.message}
          />
        </div>
        {!node && (
          <Controller
            name="add_as_new_host"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-add-host`}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  disabled={isPending}
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel htmlFor={`${id}-add-host`}>{t("nodes.addHostForEveryInbound")}</FieldLabel>
              </div>
            )}
          />
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              disabled={isPending}
              aria-label={t("delete")}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending && <Spinner />}
            {t(node ? "nodes.editNode" : "nodes.addNode")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function NodeItem({ node }: { node: NodeType }) {
  const reconnectNode = useNodes((state) => state.reconnectNode);
  const setDeletingNode = useNodes((state) => state.setDeletingNode);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutate: reconnect, isPending } = useMutation({
    mutationFn: () => reconnectNode(node),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [FetchNodesQueryKey] }),
    onError: () => toast.error(t("nodes.reconnectError", { defaultValue: "Could not reconnect the node." })),
  });
  const status = isPending ? "connecting" : (node.status ?? "error");
  return (
    <AccordionItem value={String(node.id)}>
      <AccordionTrigger>
        <span className="min-w-0 flex-1 break-all">{node.name}</span>
        <span className="flex flex-wrap items-center gap-2">
          {node.xray_version && <Badge variant="secondary">Xray {node.xray_version}</Badge>}
          <NodeModalStatusBadge status={status} compact />
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {status === "error" && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              <p>{node.message}</p>
              <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => reconnect()}>
                <RefreshCw />
                {t("nodes.reconnect")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <NodeForm node={node} onSaved={() => { }} onDelete={() => setDeletingNode(node)} />
      </AccordionContent>
    </AccordionItem>
  );
}
export function NodesDialog() {
  const isEditingNodes = useDashboard((state) => state.isEditingNodes);
  const onEditingNodes = useDashboard((state) => state.onEditingNodes);
  const { data: nodes, isLoading, isError } = useNodesQuery();
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState<string[]>([]);
  const pending = useIsMutating({ mutationKey: ["dashboard-node-write"] }) > 0;
  const close = () => {
    if (pending) return;
    setExpanded([]);
    onEditingNodes(false);
  };
  return (
    <>
      <Dialog
        open={isEditingNodes}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
          dir={i18n.dir()}
          showCloseButton={!pending}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Network className="size-5 text-primary-text" />
              {t("header.nodeSettings")}
            </DialogTitle>
            <DialogDescription>{t("nodes.title")}</DialogDescription>
          </DialogHeader>
          {isLoading && <Spinner />}
          {isError && (
            <Alert variant="destructive">
              <AlertDescription>{t("nodes.loadError", { defaultValue: "Could not load nodes." })}</AlertDescription>
            </Alert>
          )}
          <Accordion multiple value={expanded} onValueChange={setExpanded} className="space-y-3">
            {nodes?.map((node) => (
              <NodeItem key={node.id} node={node} />
            ))}
            <AccordionItem value="new">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <Plus className="size-4" />
                  {t("nodes.addNewMarzbanNode")}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <NodeForm onSaved={() => setExpanded([])} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </DialogContent>
      </Dialog>
      <DeleteNodeModal deleteCallback={() => setExpanded([])} />
    </>
  );
}
