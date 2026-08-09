/**
 * Hosts screen.
 *
 * A host is one entry in the subscription. The stock dialog put ~15 controls in
 * a single flat column behind one "advanced options" toggle, so finding a
 * setting meant scrolling past every other one. Here each inbound is a section,
 * each host a collapsed row that shows what it actually is (address, port,
 * security, auto-select) and expands into grouped fields.
 */
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  HStack,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Skeleton,
  Switch,
  Text,
  Tooltip,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmptyState, Field, Panel, PageHeader, Section } from "components/ui";
import { proxyALPN, proxyFingerprint, proxyHostSecurity } from "constants/Proxies";
import { useDashboard } from "contexts/DashboardContext";
import { useHosts } from "contexts/HostsContext";
import { FC, ReactNode, useEffect, useState } from "react";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { z } from "zod";

export type AutoSelectGroup = { remark?: string };

/** Auto-select groups, so the picker can label them the way the settings do.
 *  Fetched once per page load and shared by every host row. */
let autoSelectGroupsCache: AutoSelectGroup[] | null = null;

const useAutoSelectGroups = (): AutoSelectGroup[] => {
  const [groups, setGroups] = useState<AutoSelectGroup[]>(autoSelectGroupsCache ?? []);
  useEffect(() => {
    if (autoSelectGroupsCache) return;
    fetch("/yuku/auto-select")
      .then((data: any) => {
        const list: AutoSelectGroup[] = Array.isArray(data?.groups) ? data.groups : [];
        autoSelectGroupsCache = list;
        setGroups(list);
      })
      .catch(() => {});
  }, []);
  return groups;
};

const hostsSchema = z.record(
  z.string().min(1),
  z.array(
    z.object({
      remark: z.string().min(1, "Remark is required"),
      address: z.string().min(1, "Address is required"),
      port: z
        .string()
        .or(z.number())
        .nullable()
        .transform((value) => {
          if (typeof value === "number") return value;
          if (value !== null && !isNaN(parseInt(value))) return Number(parseInt(value));
          return null;
        }),
      path: z.string().nullable(),
      sni: z.string().nullable(),
      host: z.string().nullable(),
      mux_enable: z.boolean().default(false),
      allowinsecure: z.boolean().nullable().default(false),
      is_disabled: z.boolean().default(true),
      fragment_setting: z.string().nullable(),
      noise_setting: z.string().nullable(),
      random_user_agent: z.boolean().default(false),
      security: z.string(),
      alpn: z.string(),
      fingerprint: z.string(),
      use_sni_as_host: z.boolean().default(false),
      auto_select: z
        .number()
        .or(z.string())
        .or(z.boolean())
        .nullable()
        .transform((value) => {
          // the column was a bool before groups existed; keep old data readable
          if (typeof value === "boolean") return value ? 1 : 0;
          if (typeof value === "number") return value;
          if (value !== null && !isNaN(parseInt(value))) return parseInt(value);
          return 0;
        }),
    })
  )
);

type HostsForm = z.infer<typeof hostsSchema>;

const EMPTY_HOST = {
  host: "",
  sni: "",
  port: null,
  path: null,
  address: "",
  remark: "",
  mux_enable: false,
  allowinsecure: false,
  is_disabled: false,
  fragment_setting: "",
  noise_setting: "",
  random_user_agent: false,
  security: "inbound_default",
  alpn: "",
  fingerprint: "",
  use_sni_as_host: false,
  auto_select: 0,
};

/** Body of the hint bubble on remark/address: both accept the same variables. */
const TemplateVarsHint: FC = () => {
  const { t } = useTranslation();
  const vars = [
    ["SERVER_IP", "currentServer"],
    ["SERVER_IPV6", "currentServerv6"],
    ["USERNAME", "username"],
    ["DATA_USAGE", "dataUsage"],
    ["DATA_LEFT", "remainingData"],
    ["DATA_LIMIT", "dataLimit"],
    ["DAYS_LEFT", "remainingDays"],
    ["EXPIRE_DATE", "expireDate"],
    ["JALALI_EXPIRE_DATE", "jalaliExpireDate"],
    ["TIME_LEFT", "remainingTime"],
    ["STATUS_TEXT", "statusText"],
    ["STATUS_EMOJI", "statusEmoji"],
    ["PROTOCOL", "proxyProtocol"],
    ["TRANSPORT", "proxyMethod"],
  ];
  return (
    <>
      <Text mb="2">{t("hostsDialog.desc")}</Text>
      <VStack align="stretch" spacing="1">
        {vars.map(([name, key]) => (
          <Text key={name}>
            <Badge>{`{${name}}`}</Badge> {t(`hostsDialog.${key}`)}
          </Text>
        ))}
      </VStack>
    </>
  );
};

type HostRowProps = {
  hostKey: string;
  index: number;
  total: number;
  inboundPort?: number | string;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: "up" | "down") => void;
};

const HostRow: FC<HostRowProps> = ({
  hostKey,
  index,
  total,
  inboundPort,
  onRemove,
  onDuplicate,
  onMove,
}) => {
  const { t } = useTranslation();
  const form = useFormContext<HostsForm>();
  const autoSelectGroups = useAutoSelectGroups();
  const [open, setOpen] = useState(false);

  const name = (field: string) => `${hostKey}.${index}.${field}`;
  const errors = (form.formState.errors as any)[hostKey]?.[index];
  const value = useWatch({ control: form.control, name: `${hostKey}.${index}` as any }) as any;

  // a row with a problem inside is useless while it's collapsed
  useEffect(() => {
    if (errors && !open) setOpen(true);
  }, [errors]);

  // the group picker is uncontrolled, so its <option>s have to exist before a
  // value can stick. form.reset() usually lands before the group list does, and
  // the browser quietly drops the assignment — the row then reads "none" while
  // the form still holds the real group. Re-apply it once the options render.
  useEffect(() => {
    if (!autoSelectGroups.length) return;
    const path = name("auto_select") as any;
    form.setValue(path, (Number(form.getValues(path)) || 0) as any);
  }, [autoSelectGroups.length]);

  const disabled = !!value?.is_disabled;
  const group = Number(value?.auto_select) || 0;

  return (
    <Box
      borderWidth="1px"
      borderColor={errors ? "red.400" : "ui.border"}
      borderRadius="lg"
      bg="ui.surface"
      overflow="hidden"
      opacity={disabled ? 0.65 : 1}
      transition="opacity .12s ease"
    >
      <HStack
        px="3"
        py="2.5"
        spacing="3"
        align="center"
        cursor="pointer"
        onClick={() => setOpen((v) => !v)}
        _hover={{ bg: "ui.surfaceHover" }}
      >
        <Box
          as={ChevronRightIcon}
          w="4"
          h="4"
          flexShrink={0}
          color="ui.textMuted"
          transform={open ? "rotate(90deg)" : undefined}
          transition="transform .15s ease"
        />

        <Box flex="1" minW="0">
          <Text fontSize="sm" fontWeight="500" noOfLines={1}>
            {value?.remark || t("hostsDialog.addHost")}
          </Text>
          <Text fontSize="xs" color="ui.textMuted" noOfLines={1}>
            {value?.address || "—"}
            {value?.port ? `:${value.port}` : ""}
            {value?.sni ? ` · ${value.sni}` : ""}
          </Text>
        </Box>

        <HStack spacing="1.5" flexShrink={0} display={{ base: "none", md: "flex" }}>
          {value?.security && value.security !== "inbound_default" && (
            <Badge colorScheme="gray">{value.security}</Badge>
          )}
          {group > 0 && <Badge colorScheme="purple">автовыбор {group}</Badge>}
        </HStack>

        <HStack spacing="0.5" flexShrink={0} onClick={(e) => e.stopPropagation()}>
          <Tooltip label={disabled ? t("disabled") : t("active")} placement="top">
            <Box px="1">
              <Switch
                size="sm"
                isChecked={!disabled}
                onChange={(e) =>
                  form.setValue(name("is_disabled") as any, !e.target.checked as any, {
                    shouldDirty: true,
                  })
                }
              />
            </Box>
          </Tooltip>
          <Tooltip label="Дублировать" placement="top">
            <IconButton
              aria-label="duplicate"
              size="sm"
              variant="ghost"
              icon={<DocumentDuplicateIcon width="16" />}
              onClick={onDuplicate}
            />
          </Tooltip>
          <Tooltip label="Выше" placement="top">
            <IconButton
              aria-label="move up"
              size="sm"
              variant="ghost"
              isDisabled={index === 0}
              icon={<ArrowUpIcon width="16" />}
              onClick={() => onMove("up")}
            />
          </Tooltip>
          <Tooltip label="Ниже" placement="top">
            <IconButton
              aria-label="move down"
              size="sm"
              variant="ghost"
              isDisabled={index === total - 1}
              icon={<ArrowDownIcon width="16" />}
              onClick={() => onMove("down")}
            />
          </Tooltip>
          <Tooltip label={t("delete")} placement="top">
            <IconButton
              aria-label="delete"
              size="sm"
              variant="ghost"
              colorScheme="red"
              icon={<TrashIcon width="16" />}
              onClick={onRemove}
            />
          </Tooltip>
        </HStack>
      </HStack>

      <Collapse in={open} animateOpacity>
        <Divider borderColor="ui.border" />
        <VStack align="stretch" spacing="5" p="4" bg="ui.surfaceMuted">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            <Field
              label={t("hostsDialog.remark")}
              hintBody={<TemplateVarsHint />}
              error={errors?.remark?.message}
            >
              <Input size="sm" bg="ui.surface" placeholder="🇩🇪 Германия" {...form.register(name("remark"))} />
            </Field>
            <Field
              label={t("hostsDialog.address")}
              hintBody={<TemplateVarsHint />}
              error={errors?.address?.message}
            >
              <Input
                size="sm"
                bg="ui.surface"
                placeholder="example.com"
                {...form.register(name("address"))}
              />
            </Field>
            <Field label={t("hostsDialog.port")} hint={t("hostsDialog.port.info")}>
              <Input
                size="sm"
                bg="ui.surface"
                type="number"
                placeholder={String(inboundPort || "8080")}
                {...form.register(name("port"))}
              />
            </Field>
            <Field
              label={t("hostsDialog.autoSelect")}
              helper={t("hostsDialog.autoSelect.info")}
              error={errors?.auto_select?.message}
            >
              <Select
                size="sm"
                bg="ui.surface"
                {...form.register(name("auto_select"), { valueAsNumber: true })}
              >
                <option value={0}>{t("hostsDialog.autoSelect.none")}</option>
                {autoSelectGroups.map((g, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}. {g.remark}
                  </option>
                ))}
              </Select>
            </Field>
          </SimpleGrid>

          <Box>
            <GroupTitle>TLS</GroupTitle>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
              <Field label={t("hostsDialog.security")} hint={t("hostsDialog.security.info")}>
                <Select size="sm" bg="ui.surface" {...form.register(name("security"))}>
                  {proxyHostSecurity.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("hostsDialog.sni")}
                hintBody={
                  <>
                    <Text>{t("hostsDialog.sni.info")}</Text>
                    <Text mt="2">
                      <Trans i18nKey="hostsDialog.host.wildcard" components={{ badge: <Badge /> }} />
                    </Text>
                    <Text>
                      <Trans i18nKey="hostsDialog.host.multiHost" components={{ badge: <Badge /> }} />
                    </Text>
                  </>
                }
                error={errors?.sni?.message}
              >
                <Input size="sm" bg="ui.surface" placeholder="example.com" {...form.register(name("sni"))} />
              </Field>
              <Field label={t("hostsDialog.alpn")}>
                <Select size="sm" bg="ui.surface" {...form.register(name("alpn"))}>
                  {proxyALPN.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("hostsDialog.fingerprint")}>
                <Select size="sm" bg="ui.surface" {...form.register(name("fingerprint"))}>
                  {proxyFingerprint.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </SimpleGrid>
            <HStack spacing="5" mt="3" wrap="wrap">
              <Checkbox size="sm" {...form.register(name("use_sni_as_host"))}>
                <Text fontSize="sm">{t("hostsDialog.useSniAsHost")}</Text>
              </Checkbox>
              <Checkbox size="sm" {...form.register(name("allowinsecure"))}>
                <Text fontSize="sm">{t("hostsDialog.allowinsecure")}</Text>
              </Checkbox>
            </HStack>
          </Box>

          <Box>
            <GroupTitle>{t("hostsDialog.host")}</GroupTitle>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
              <Field
                label={t("hostsDialog.host")}
                hintBody={
                  <>
                    <Text>{t("hostsDialog.host.info")}</Text>
                    <Text mt="2">
                      <Trans i18nKey="hostsDialog.host.wildcard" components={{ badge: <Badge /> }} />
                    </Text>
                    <Text>
                      <Trans i18nKey="hostsDialog.host.multiHost" components={{ badge: <Badge /> }} />
                    </Text>
                  </>
                }
                error={errors?.host?.message}
              >
                <Input size="sm" bg="ui.surface" placeholder="example.com" {...form.register(name("host"))} />
              </Field>
              <Field
                label={t("hostsDialog.path")}
                hint={t("hostsDialog.path.info")}
                error={errors?.path?.message}
              >
                <Input size="sm" bg="ui.surface" placeholder="/vless" {...form.register(name("path"))} />
              </Field>
            </SimpleGrid>
            <HStack spacing="5" mt="3" wrap="wrap">
              <Checkbox size="sm" {...form.register(name("mux_enable"))}>
                <Text fontSize="sm">{t("hostsDialog.muxEnable")}</Text>
              </Checkbox>
              <Checkbox size="sm" {...form.register(name("random_user_agent"))}>
                <Text fontSize="sm">{t("hostsDialog.randomUserAgent")}</Text>
              </Checkbox>
            </HStack>
          </Box>

          <Box>
            <GroupTitle>Обход блокировок</GroupTitle>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
              <Field
                label={t("hostsDialog.fragment")}
                hintBody={
                  <>
                    <Text>{t("hostsDialog.fragment.info")}</Text>
                    <Text mt="2">{t("hostsDialog.fragment.info.examples")}</Text>
                    <Text fontFamily="mono">100-200,10-20,tlshello</Text>
                    <Text fontFamily="mono">100-200,10-20,1-3</Text>
                    <Text mt="2">{t("hostsDialog.fragment.info.attention")}</Text>
                  </>
                }
                error={errors?.fragment_setting?.message}
              >
                <Input
                  size="sm"
                  bg="ui.surface"
                  placeholder="100-200,10-20,tlshello"
                  {...form.register(name("fragment_setting"))}
                />
              </Field>
              <Field
                label={t("hostsDialog.noise")}
                hintBody={
                  <>
                    <Text>{t("hostsDialog.noise.info")}</Text>
                    <Text mt="2">{t("hostsDialog.noise.info.examples")}</Text>
                    <Text fontFamily="mono">rand:10-20,10-20</Text>
                    <Text mt="2">{t("hostsDialog.noise.info.attention")}</Text>
                  </>
                }
                error={errors?.noise_setting?.message}
              >
                <Input
                  size="sm"
                  bg="ui.surface"
                  placeholder="rand:10-20,10-20"
                  {...form.register(name("noise_setting"))}
                />
              </Field>
            </SimpleGrid>
          </Box>
        </VStack>
      </Collapse>
    </Box>
  );
};

const GroupTitle: FC<{ children: ReactNode }> = ({ children }) => (
  <Text
    fontSize="10px"
    textTransform="uppercase"
    letterSpacing="0.06em"
    color="ui.textFaint"
    mb="2"
  >
    {children}
  </Text>
);

const InboundSection: FC<{ hostKey: string }> = ({ hostKey }) => {
  const { t } = useTranslation();
  const { inbounds } = useDashboard();
  const form = useFormContext<HostsForm>();
  const inbound = [...inbounds.values()].flat().find((i) => i.tag === hostKey);

  const {
    fields: hosts,
    append,
    remove,
    insert,
    move,
  } = useFieldArray({ control: form.control, name: hostKey });

  return (
    <Section
      icon={LinkIcon}
      title={hostKey}
      description={[
        inbound?.protocol,
        inbound?.network,
        inbound?.tls && inbound.tls !== "none" ? inbound.tls : null,
        `${hosts.length} хост(ов)`,
      ]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <Button
          size="sm"
          variant="outline"
          leftIcon={<PlusIcon width="16" />}
          onClick={() => append({ ...EMPTY_HOST } as any)}
        >
          {t("hostsDialog.addHost")}
        </Button>
      }
    >
      <VStack align="stretch" spacing="2">
        {hosts.length === 0 && (
          <Text fontSize="sm" color="ui.textMuted">
            Для этого инбаунда нет ни одного хоста — он не попадёт в подписку.
          </Text>
        )}
        {hosts.map((host, index) => (
          <HostRow
            key={host.id}
            hostKey={hostKey}
            index={index}
            total={hosts.length}
            inboundPort={inbound?.port}
            onRemove={() => remove(index)}
            onDuplicate={() => insert(index + 1, hosts[index] as any)}
            onMove={(direction) =>
              direction === "up"
                ? index > 0 && move(index, index - 1)
                : index < hosts.length - 1 && move(index, index + 1)
            }
          />
        ))}
      </VStack>
    </Section>
  );
};

export const Hosts: FC = () => {
  const { onEditingHosts, refetchUsers } = useDashboard();
  const { isLoading, hosts, fetchHosts, isPostLoading, setHosts } = useHosts();
  const toast = useToast();
  const { t } = useTranslation();

  const form = useForm<HostsForm>({ resolver: zodResolver(hostsSchema) });

  useEffect(() => {
    onEditingHosts(true);
    fetchHosts();
    return () => onEditingHosts(false);
  }, []);

  useEffect(() => {
    if (hosts) form.reset(hosts);
  }, [hosts]);

  const onSubmit = (values: HostsForm) => {
    setHosts(values)
      .then(() => {
        toast({
          title: t("hostsDialog.savedSuccess"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        refetchUsers();
      })
      .catch((err) => {
        if (err?.response?.status === 409 || err?.response?.status === 400) {
          toast({
            title: err.response?._data?.detail,
            status: "error",
            isClosable: true,
            position: "top",
            duration: 3000,
          });
        }
        if (err?.response?.status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            toast({
              title: err.response._data.detail[key] + " (" + key + ")",
              status: "error",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
          });
        }
      });
  };

  const tags = hosts ? Object.keys(hosts) : [];

  return (
    <Box w="full">
      <PageHeader
        title={t("header.hostSettings")}
        description={t("hostsDialog.title")}
        icon={LinkIcon}
      />

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <VStack align="stretch" spacing="4">
            {isLoading && <Skeleton height="180px" borderRadius="xl" />}

            {!isLoading && tags.length === 0 && (
              <Panel>
                <EmptyState
                  icon={LinkIcon}
                  title="Инбаундов не найдено"
                  description="Проверь конфиг Xray — хосты строятся поверх инбаундов из него."
                />
              </Panel>
            )}

            {tags.map((tag) => (
              <InboundSection key={tag} hostKey={tag} />
            ))}

            {tags.length > 0 && (
              <HStack
                px="4"
                py="3"
                spacing="3"
                justify="flex-end"
                bg="ui.surface"
                borderWidth="1px"
                borderColor={form.formState.isDirty ? "primary.500" : "ui.border"}
                borderRadius="xl"
                boxShadow="raised"
                zIndex="2"
              >
                <Text fontSize="xs" color="ui.textMuted" mr="auto">
                  {form.formState.isDirty
                    ? "Есть несохранённые изменения"
                    : "Всё сохранено"}
                </Text>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => hosts && form.reset(hosts)}
                  isDisabled={!form.formState.isDirty || isPostLoading}
                >
                  Отменить
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  colorScheme="primary"
                  isLoading={isPostLoading}
                >
                  {t("hostsDialog.apply")}
                </Button>
              </HStack>
            )}
          </VStack>
        </form>
      </FormProvider>
    </Box>
  );
};

export default Hosts;
