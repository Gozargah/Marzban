import { useEffect, useId, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, Resolver, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, Eye, EyeOff, Network, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { DirectionProvider } from "@base-ui/react/direction-provider";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { FormInput } from "./form-input";
import { DeleteNodeModal } from "./delete-node-modal";
import { NodeModalStatusBadge } from "./node-modal-status-badge";
import { cn } from "@/lib/utils";

const nodeWriteKey = ["dashboard-node-write"];
const nodeFormSchema = NodeSchema.extend({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  port: z.number().int().min(1).max(65535),
  api_port: z.number().int().min(1).max(65535),
  usage_coefficient: z.number().min(0),
});

function NodeForm({ node, onSaved, onCancel, onDelete, onDirtyChange }: {
  node?: NodeType;
  onSaved: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const saving = useRef(false);
  const addNode = useNodes((state) => state.addNode);
  const updateNode = useNodes((state) => state.updateNode);
  const queryClient = useQueryClient();
  const form = useForm<NodeType>({
    defaultValues: node ?? { ...getNodeDefaultValues(), add_as_new_host: false },
    resolver: zodResolver(nodeFormSchema) as Resolver<NodeType>,
  });
  const { isDirty } = form.formState;
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  const [error, setError] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string>();
  const settingsQuery = useQuery({
    queryKey: ["node-settings"],
    queryFn: ({ signal }) => fetch<{ certificate: string; min_node_version: string }>("/node/settings", { signal }),
    enabled: !node,
  });
  const settings = settingsQuery.data;
  useEffect(() => {
    if (!settings?.certificate) return;
    const url = URL.createObjectURL(new Blob([settings.certificate], { type: "text/plain" }));
    setCertificateUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [settings?.certificate]);
  const { mutate, isPending } = useMutation({
    mutationKey: nodeWriteKey,
    mutationFn: node ? updateNode : addNode,
    onSuccess: () => {
      toast.success(node
        ? t("nodes.updateSuccess", { defaultValue: "Node updated." })
        : t("nodes.addNodeSuccess", { name: form.getValues("name") }));
      queryClient.invalidateQueries({ queryKey: [FetchNodesQueryKey] });
      form.reset(form.getValues());
      onDirtyChange(false);
      onSaved();
    },
    onError: (error: any) => {
      const detail = error?.response?._data?.detail;
      if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        Object.entries(detail).forEach(([key, message]) =>
          form.setError(key as keyof NodeType, { message: String(message) }));
      }
      setError(typeof detail === "string" ? detail
        : t("nodes.saveError", { defaultValue: "Could not save the node. Please try again." }));
    },
    onSettled: () => { saving.current = false; },
  });

  return (
    <form className="flex min-h-0 flex-1 flex-col" aria-busy={isPending}
      onSubmit={form.handleSubmit((values) => {
        if (saving.current) return;
        saving.current = true;
        setError(null);
        mutate(values);
      })}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        <fieldset disabled={isPending} className="min-w-0 space-y-6">
          <FieldSet className="gap-5">
            <FieldLegend>{t("nodes.connectionDetails", { defaultValue: "Connection details" })}</FieldLegend>
            <FormInput autoFocus label={t("nodes.nodeName")} placeholder="Marzban-S2" autoComplete="off"
              {...form.register("name")} error={form.formState.errors.name?.message} />
            <Controller name="status" control={form.control} render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-1">
                  <FieldLabel htmlFor={`${id}-enabled`}>{t("nodes.enabled", { defaultValue: "Enable node" })}</FieldLabel>
                  <FieldDescription id={`${id}-enabled-description`}>
                    {t("nodes.enabledHint", { defaultValue: "Allow this node to connect and handle user traffic." })}
                  </FieldDescription>
                </div>
                <Switch id={`${id}-enabled`} name={field.name} ref={field.ref} onBlur={field.onBlur}
                  disabled={isPending} checked={field.value !== "disabled"}
                  aria-describedby={`${id}-enabled-description`}
                  onCheckedChange={(checked) => field.onChange(checked ? "connecting" : "disabled")} />
              </div>
            )} />
            <FormInput label={t("nodes.nodeAddress")} placeholder="node.example.com" dir="ltr" autoComplete="off" autoCapitalize="none" spellCheck={false}
              description={t("nodes.addressHint", { defaultValue: "Enter the node’s IP address or hostname." })}
              {...form.register("address")} error={form.formState.errors.address?.message} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput label={t("nodes.nodePort")} type="number" min={1} max={65535} step={1} dir="ltr"
                {...form.register("port", { valueAsNumber: true })} error={form.formState.errors.port?.message} />
              <FormInput label={t("nodes.nodeAPIPort")} type="number" min={1} max={65535} step={1} dir="ltr"
                {...form.register("api_port", { valueAsNumber: true })} error={form.formState.errors.api_port?.message} />
            </div>
          </FieldSet>
          <FieldSet className="gap-4 border-t pt-6">
            <FieldLegend>{t("nodes.trafficSettings", { defaultValue: "Traffic accounting" })}</FieldLegend>
            <FormInput label={t("nodes.usageCoefficient")} type="number" min={0} step="any" dir="ltr"
              description={t("nodes.coefficientHint", { defaultValue: "A multiplier for recorded usage. Use 1 to count traffic normally." })}
              {...form.register("usage_coefficient", { valueAsNumber: true })} error={form.formState.errors.usage_coefficient?.message} />
            {!node && <Controller name="add_as_new_host" control={form.control} render={({ field }) => (
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Checkbox id={`${id}-add-host`} name={field.name} ref={field.ref} onBlur={field.onBlur}
                  disabled={isPending} checked={!!field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor={`${id}-add-host`} className="leading-relaxed">{t("nodes.addHostForEveryInbound")}</FieldLabel>
              </div>
            )} />}
          </FieldSet>
          {!node && (
            <FieldSet className="gap-3 border-t pt-6">
              <FieldLegend>{t("nodes.setupCertificate", { defaultValue: "Connection certificate" })}</FieldLegend>
              {settingsQuery.isLoading && <div role="status" className="flex items-center gap-2 text-muted-foreground"><Spinner />{t("loading", { defaultValue: "Loading…" })}</div>}
              {settingsQuery.isError && <Alert variant="destructive"><AlertDescription>
                <p>{t("nodes.settingsError", { defaultValue: "Could not load the connection certificate." })}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => settingsQuery.refetch()}>{t("nodes.retry", { defaultValue: "Retry" })}</Button>
              </AlertDescription></Alert>}
              {settings?.certificate && <>
                <FieldDescription>{t("nodes.connection-hint")}</FieldDescription>
                {settings.min_node_version && <p className="text-xs text-muted-foreground">{t("nodes.minimumVersion", { defaultValue: "Requires node version {{version}} or newer.", version: settings.min_node_version })}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {certificateUrl && <a href={certificateUrl} download="ssl_client_cert.pem" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <Download aria-hidden="true" />{t("nodes.download-certificate")}
                  </a>}
                  <Button type="button" variant="ghost" size="sm" aria-expanded={showCertificate} aria-controls={`${id}-certificate`}
                    onClick={() => setShowCertificate((value) => !value)}>
                    {showCertificate ? <EyeOff /> : <Eye />}
                    {showCertificate ? t("nodes.hide-certificate") : t("nodes.show-certificate")}
                  </Button>
                </div>
                {showCertificate && <pre id={`${id}-certificate`} className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs" dir="ltr">{settings.certificate}</pre>}
              </>}
            </FieldSet>
          )}
          {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
        </fieldset>
      </div>
      <SheetFooter className="shrink-0 border-t bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {onDelete ? <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isPending} onClick={onDelete}>
            <Trash2 aria-hidden="true" />{t("delete")}
          </Button> : <span />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>{t("cancel", { defaultValue: "Cancel" })}</Button>
            <Button type="submit" disabled={isPending} className="min-w-28">{isPending && <Spinner />}
              {node ? t("nodes.saveChanges", { defaultValue: "Save changes" }) : t("nodes.addNode")}
            </Button>
          </div>
        </div>
      </SheetFooter>
    </form>
  );
}

function NodeCard({ node, onEdit, disabled }: { node: NodeType; onEdit: () => void; disabled: boolean }) {
  const reconnectNode = useNodes((state) => state.reconnectNode);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutate: reconnect, isPending } = useMutation({
    mutationKey: nodeWriteKey,
    mutationFn: () => reconnectNode(node),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [FetchNodesQueryKey] }),
    onError: () => toast.error(t("nodes.reconnectError", { defaultValue: "Could not reconnect the node." })),
  });
  const status = isPending ? "connecting" : (node.status ?? "error");
  return (
    <li className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="break-words text-sm font-semibold">{node.name}</h3>
          <p className="break-all font-mono text-xs text-muted-foreground" dir="ltr">{node.address}:{node.port}</p>
        </div>
        <NodeModalStatusBadge status={status} compact />
      </div>
      {status === "error" && node.message && <Alert variant="destructive"><AlertDescription className="break-words">{node.message}</AlertDescription></Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {node.xray_version ? <Badge variant="secondary">Xray {node.xray_version}</Badge> : <span />}
        <div className="flex items-center gap-2">
          {status === "error" && <Button type="button" variant="outline" size="sm" disabled={disabled || isPending} onClick={() => reconnect()}>
            {isPending ? <Spinner /> : <RefreshCw aria-hidden="true" />}{t("nodes.reconnect")}
          </Button>}
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onEdit} aria-label={t("nodes.editNamedNode", { defaultValue: "Edit {{name}}", name: node.name })}>
            <Pencil aria-hidden="true" />{t("nodes.edit", { defaultValue: "Edit" })}
          </Button>
        </div>
      </div>
    </li>
  );
}

export function NodesDialog() {
  const isEditingNodes = useDashboard((state) => state.isEditingNodes);
  const onEditingNodes = useDashboard((state) => state.onEditingNodes);
  const { data: nodes, isLoading, isError, refetch } = useNodesQuery();
  const { t, i18n } = useTranslation();
  // Keep an editing snapshot so polling does not overwrite unsaved form values.
  const [selected, setSelected] = useState<NodeType | "new" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const discardAction = useRef<(() => void) | null>(null);
  const cancelDiscardRef = useRef<HTMLButtonElement>(null);
  const setDeletingNode = useNodes((state) => state.setDeletingNode);
  const pending = useIsMutating({ mutationKey: nodeWriteKey }) > 0;
  const requestLeave = (action: () => void) => {
    if (pending) return;
    if (dirty) {
      discardAction.current = action;
      setDiscardOpen(true);
    } else action();
  };
  const showOverview = () => { setDirty(false); setSelected(null); };
  const close = () => requestLeave(() => onEditingNodes(false));
  const editingNode = selected && selected !== "new" ? selected : undefined;

  return (
    <DirectionProvider direction={i18n.dir() === "rtl" ? "rtl" : "ltr"}>
      <Sheet open={isEditingNodes} onOpenChange={(open) => { if (!open) close(); }}
        onOpenChangeComplete={(open) => { if (!open) showOverview(); }}>
        <SheetContent side={i18n.dir() === "rtl" ? "left" : "right"}
          className="w-full! sm:max-w-xl! gap-0 overflow-hidden" dir={i18n.dir()} showCloseButton={!pending}>
          <SheetHeader className="shrink-0 border-b px-6 py-5 pe-14">
            {selected && <Button type="button" variant="ghost" size="sm" className="mb-2 w-fit -ms-2" disabled={pending} onClick={() => requestLeave(showOverview)}>
              <ArrowLeft aria-hidden="true" className={cn("size-4", i18n.dir() === "rtl" && "rotate-180")} />{t("nodes.backToNodes", { defaultValue: "All nodes" })}
            </Button>}
            <SheetTitle className="flex items-center gap-2 text-lg">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Network aria-hidden="true" className="size-5" /></span>
              <span className="min-w-0 break-words">
                {selected === "new" ? t("nodes.addNewMarzbanNode") : editingNode ? t("nodes.editNamedNode", { defaultValue: "Edit {{name}}", name: editingNode.name }) : t("header.nodeSettings")}
              </span>
            </SheetTitle>
            <SheetDescription>{selected
              ? t("nodes.formDescription", { defaultValue: "Configure how this node connects and accounts for traffic." })
              : t("nodes.overviewDescription", { defaultValue: "Manage your nodes, check their connection status, and add new servers." })}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <NodeForm key={editingNode?.id ?? "new"} node={editingNode} onDirtyChange={setDirty}
              onSaved={showOverview} onCancel={() => requestLeave(showOverview)}
              onDelete={editingNode ? () => setDeletingNode(editingNode) : undefined} />
          ) : <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium">{t("nodes.yourNodes", { defaultValue: "Your nodes" })}{nodes && <span className="ms-2 text-muted-foreground">({nodes.length})</span>}</h2>
                <Button type="button" size="sm" disabled={pending} onClick={() => setSelected("new")}><Plus aria-hidden="true" />{t("nodes.addNode")}</Button>
              </div>
              {isLoading && <div role="status" className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Spinner />{t("loading", { defaultValue: "Loading…" })}</div>}
              {isError && <Alert variant="destructive"><AlertDescription className="space-y-3">
                <p>{t("nodes.loadError", { defaultValue: "Could not load nodes." })}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>{t("nodes.retry", { defaultValue: "Retry" })}</Button>
              </AlertDescription></Alert>}
              {!isLoading && !isError && nodes?.length === 0 && <div className="rounded-xl border border-dashed px-5 py-12 text-center">
                <Network aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">{t("nodes.emptyTitle", { defaultValue: "No nodes yet" })}</h3>
                <p className="mt-1 text-muted-foreground">{t("nodes.emptyDescription", { defaultValue: "Add your first node to connect another server." })}</p>
              </div>}
              {!!nodes?.length && <ul className="space-y-3">{nodes.map((node) => <NodeCard key={node.id} node={node} disabled={pending} onEdit={() => setSelected(node)} />)}</ul>}
            </div>
            <SheetFooter className="shrink-0 border-t bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button type="button" variant="outline" className="self-end" disabled={pending} onClick={close}>{t("nodes.close", { defaultValue: "Close" })}</Button>
            </SheetFooter>
          </>}
        </SheetContent>
      </Sheet>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent initialFocus={cancelDiscardRef} dir={i18n.dir()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("nodes.unsavedTitle", { defaultValue: "Discard unsaved changes?" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("nodes.unsavedDescription", { defaultValue: "Your node settings have not been saved. Keep editing or discard them to continue." })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button ref={cancelDiscardRef} variant="outline" onClick={() => setDiscardOpen(false)}>{t("nodes.keepEditing", { defaultValue: "Keep editing" })}</Button>
            <Button variant="destructive" onClick={() => { setDiscardOpen(false); setDirty(false); discardAction.current?.(); discardAction.current = null; }}>{t("nodes.discardChanges", { defaultValue: "Discard changes" })}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DeleteNodeModal deleteCallback={showOverview} />
    </DirectionProvider>
  );
}
