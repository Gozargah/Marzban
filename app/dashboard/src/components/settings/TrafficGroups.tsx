/**
 * Traffic groups tab.
 *
 * A group caps how much a single user may pull through a set of nodes; the
 * hosts listed in it are what gets hidden (or replaced by the notice) once the
 * cap is reached. Same endpoints as before — this is the page-shaped rewrite of
 * the old modal.
 */
import {
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  IconButton,
  Input,
  Select,
  Spinner,
  Text,
  Textarea,
  Tooltip,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  PlusIcon,
  ScaleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { FC, useEffect, useMemo, useState } from "react";
import { fetch } from "service/http";
import { EmptyState, Field, Section } from "../ui";

const GB = 1024 ** 3;

type HostCandidate = { id: number; remark: string; inbound_tag: string };
type NodeItem = { id: number; name: string };
type Group = {
  id: number;
  name: string;
  traffic_limit: number | null;
  reset_strategy: string;
  notice_text: string | null;
  include_master: boolean;
  host_ids: number[];
  node_ids: number[];
};

type Draft = {
  id?: number;
  name: string;
  limitGB: string;
  reset_strategy: string;
  notice_text: string;
  include_master: boolean;
  host_ids: number[];
  node_ids: number[];
};

const EMPTY_DRAFT: Draft = {
  name: "",
  limitGB: "",
  reset_strategy: "no_reset",
  notice_text: "",
  include_master: false,
  host_ids: [],
  node_ids: [],
};

const RESET_LABELS: Record<string, string> = {
  no_reset: "без сброса",
  day: "ежедневно",
  week: "еженедельно",
  month: "ежемесячно",
  year: "ежегодно",
};

export const TrafficGroups: FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [candidates, setCandidates] = useState<HostCandidate[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const notify = (title: string, status: "success" | "error") =>
    toast({ title, status, isClosable: true, duration: 3000, position: "top" });

  const loadAll = () => {
    setLoading(true);
    // each request is independent so one failing endpoint can't blank the
    // others (e.g. host list staying empty because /nodes hiccuped)
    Promise.allSettled([
      fetch("/host-groups"),
      fetch("/host-candidates"),
      fetch("/nodes"),
    ])
      .then(([g, c, n]: any) => {
        if (g.status === "fulfilled") setGroups(g.value || []);
        if (c.status === "fulfilled") setCandidates(c.value || []);
        if (n.status === "fulfilled")
          setNodes((n.value || []).map((x: any) => ({ id: x.id, name: x.name })));
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  // node_id -> group name, for "node already used by another group" warnings
  const nodeOwner = useMemo(() => {
    const m: Record<number, string> = {};
    groups.forEach((g) => {
      if (draft && g.id === draft.id) return;
      g.node_ids.forEach((nid) => (m[nid] = g.name));
    });
    return m;
  }, [groups, draft]);

  const hostsByInbound = useMemo(() => {
    const m: Record<string, HostCandidate[]> = {};
    candidates.forEach((h) => {
      (m[h.inbound_tag] = m[h.inbound_tag] || []).push(h);
    });
    return m;
  }, [candidates]);

  const startEdit = (g: Group) =>
    setDraft({
      id: g.id,
      name: g.name,
      limitGB: g.traffic_limit ? String(Math.round((g.traffic_limit / GB) * 100) / 100) : "",
      reset_strategy: g.reset_strategy || "no_reset",
      notice_text: g.notice_text || "",
      include_master: !!g.include_master,
      host_ids: [...g.host_ids],
      node_ids: [...g.node_ids],
    });

  const toggle = (key: "host_ids" | "node_ids", id: number) => {
    if (!draft) return;
    const has = draft[key].includes(id);
    setDraft({
      ...draft,
      [key]: has ? draft[key].filter((x) => x !== id) : [...draft[key], id],
    });
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return notify("Укажите название", "error");
    const gb = parseFloat(draft.limitGB);
    const body = {
      name: draft.name.trim(),
      traffic_limit: draft.limitGB && !isNaN(gb) ? Math.round(gb * GB) : 0,
      reset_strategy: draft.reset_strategy,
      notice_text: draft.notice_text || null,
      include_master: draft.include_master,
      host_ids: draft.host_ids,
      node_ids: draft.node_ids,
    };
    setSaving(true);
    const req = draft.id
      ? fetch(`/host-group/${draft.id}`, { method: "PUT", body })
      : fetch("/host-group", { method: "POST", body });
    req
      .then(() => {
        notify("Группа сохранена", "success");
        setDraft(null);
        loadAll();
      })
      .catch((e: any) => notify(e?.data?.detail || "Ошибка сохранения", "error"))
      .finally(() => setSaving(false));
  };

  const remove = (g: Group) => {
    if (!window.confirm(`Удалить группу «${g.name}»?`)) return;
    fetch(`/host-group/${g.id}`, { method: "DELETE" })
      .then(() => {
        notify("Группа удалена", "success");
        loadAll();
      })
      .catch(() => notify("Ошибка удаления", "error"));
  };

  if (loading)
    return (
      <Section icon={ScaleIcon} title="Группы трафика">
        <Spinner />
      </Section>
    );

  if (draft)
    return (
      <Section
        icon={ScaleIcon}
        title={draft.id ? `Группа «${draft.name || "без названия"}»` : "Новая группа"}
        description="Лимит считается по нодам, а прячутся — хосты"
        actions={
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<ArrowLeftIcon width="16" />}
            onClick={() => setDraft(null)}
          >
            К списку
          </Button>
        }
      >
        <VStack align="stretch" spacing="4">
          <Field label="Название группы">
            <Input
              value={draft.name}
              placeholder="напр. play2go"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>

          <HStack
            align="flex-start"
            spacing="4"
            flexDir={{ base: "column", sm: "row" }}
            gap={{ base: "4", sm: "0" }}
            w="full"
          >
            <Box flex="1" w="full">
              <Field label="Лимит на пользователя, ГБ" helper="0 или пусто — безлимит">
                <Input
                  type="number"
                  value={draft.limitGB}
                  placeholder="0"
                  onChange={(e) => setDraft({ ...draft, limitGB: e.target.value })}
                />
              </Field>
            </Box>
            <Box flex="1" w="full">
              <Field label="Сброс счётчика">
                <Select
                  value={draft.reset_strategy}
                  onChange={(e) => setDraft({ ...draft, reset_strategy: e.target.value })}
                >
                  {Object.entries(RESET_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </Box>
          </HStack>

          <Field
            label="Текст-заглушка при превышении"
            helper="Показывается вместо хостов группы, когда лимит исчерпан."
          >
            <Textarea
              rows={2}
              value={draft.notice_text}
              placeholder="🔴 Лимит трафика группы исчерпан"
              onChange={(e) => setDraft({ ...draft, notice_text: e.target.value })}
            />
          </Field>

          <Field
            label="Ноды для учёта трафика"
            helper="Учёт идёт по нодам. Нода должна быть только в одной группе."
          >
            <VStack
              align="stretch"
              spacing="1"
              maxH="180px"
              overflowY="auto"
              borderWidth="1px"
              borderColor="ui.border"
              borderRadius="lg"
              p="3"
            >
              <Checkbox
                isChecked={draft.include_master}
                onChange={() => setDraft({ ...draft, include_master: !draft.include_master })}
              >
                <Text fontSize="sm">Мастер-нода (сама панель)</Text>
              </Checkbox>
              {nodes.map((n) => {
                const owner = nodeOwner[n.id];
                return (
                  <Checkbox
                    key={n.id}
                    isChecked={draft.node_ids.includes(n.id)}
                    onChange={() => toggle("node_ids", n.id)}
                  >
                    <HStack spacing="2">
                      <Text fontSize="sm">{n.name}</Text>
                      {owner && (
                        <Badge colorScheme="orange" fontSize="10px">
                          уже в «{owner}»
                        </Badge>
                      )}
                    </HStack>
                  </Checkbox>
                );
              })}
              {nodes.length === 0 && (
                <Text fontSize="xs" color="ui.textMuted">
                  Нет нод
                </Text>
              )}
            </VStack>
          </Field>

          <Field
            label="Хосты группы"
            helper="Именно эти записи скрываются из подписки, когда лимит исчерпан."
          >
            <VStack
              align="stretch"
              spacing="2"
              maxH="220px"
              overflowY="auto"
              borderWidth="1px"
              borderColor="ui.border"
              borderRadius="lg"
              p="3"
            >
              {Object.entries(hostsByInbound).map(([tag, hs]) => (
                <Box key={tag}>
                  <Text fontSize="10px" textTransform="uppercase" color="ui.textFaint" mb="1">
                    {tag}
                  </Text>
                  {hs.map((h) => (
                    <Checkbox
                      key={h.id}
                      ml="2"
                      isChecked={draft.host_ids.includes(h.id)}
                      onChange={() => toggle("host_ids", h.id)}
                    >
                      <Text fontSize="sm">{h.remark}</Text>
                    </Checkbox>
                  ))}
                </Box>
              ))}
              {candidates.length === 0 && (
                <Text fontSize="xs" color="ui.textMuted">
                  Нет хостов
                </Text>
              )}
            </VStack>
          </Field>

          <HStack justify="flex-end" spacing="2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Отмена
            </Button>
            <Button colorScheme="primary" isLoading={saving} onClick={save}>
              Сохранить
            </Button>
          </HStack>
        </VStack>
      </Section>
    );

  return (
    <Section
      icon={ScaleIcon}
      title="Группы трафика"
      description="Лимит на пользователя внутри набора нод"
      actions={
        <Button
          size="sm"
          variant="outline"
          leftIcon={<PlusIcon width="16" />}
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          Новая группа
        </Button>
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          icon={ScaleIcon}
          title="Групп пока нет"
          description="Создайте первую — на текущих пользователей это не влияет, пока в группе нет нод."
          action={
            <Button
              size="sm"
              colorScheme="primary"
              leftIcon={<PlusIcon width="16" />}
              onClick={() => setDraft({ ...EMPTY_DRAFT })}
            >
              Новая группа
            </Button>
          }
        />
      ) : (
        <VStack align="stretch" spacing="2">
          {groups.map((g) => (
            <HStack
              key={g.id}
              justify="space-between"
              borderWidth="1px"
              borderColor="ui.border"
              bg="ui.surfaceMuted"
              borderRadius="lg"
              p="3"
              flexWrap="wrap"
              gap="2"
            >
              <Box minW="0">
                <HStack spacing="2">
                  <Text fontWeight="500">{g.name}</Text>
                  <Badge colorScheme={g.traffic_limit ? "primary" : "gray"}>
                    {g.traffic_limit
                      ? `${Math.round((g.traffic_limit / GB) * 100) / 100} ГБ/юзер`
                      : "безлимит"}
                  </Badge>
                </HStack>
                <Text fontSize="xs" color="ui.textMuted" mt="0.5">
                  {g.node_ids.length} нод · {g.host_ids.length} хостов ·{" "}
                  {RESET_LABELS[g.reset_strategy] ?? g.reset_strategy}
                </Text>
              </Box>
              <HStack spacing="1">
                <Tooltip label="Изменить" placement="top">
                  <IconButton
                    aria-label="изменить"
                    size="sm"
                    variant="ghost"
                    icon={<PencilSquareIcon width="18" />}
                    onClick={() => startEdit(g)}
                  />
                </Tooltip>
                <Tooltip label="Удалить" placement="top">
                  <IconButton
                    aria-label="удалить"
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    icon={<TrashIcon width="18" />}
                    onClick={() => remove(g)}
                  />
                </Tooltip>
              </HStack>
            </HStack>
          ))}
        </VStack>
      )}
    </Section>
  );
};
