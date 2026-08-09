/**
 * Subscription tab: what the client sees at the top of the list, the two
 * placeholder notices, and the routing profile baked into v2ray-json configs.
 */
import {
  Badge,
  Box,
  HStack,
  Select,
  Tag,
  TagLabel,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  BellAlertIcon,
  MapIcon,
  MegaphoneIcon,
} from "@heroicons/react/24/outline";
import { FC, useMemo, useRef } from "react";
import { Field, Section } from "../ui";
import { useYukuSettings } from "./yukuSettings";

// Announce template variables with the sample values used for the live preview.
// Kept in sync with ANNOUNCE_VARIABLES / setup_format_variables on the backend.
const ANNOUNCE_VARS: Array<[string, string]> = [
  ["USERNAME", "ivan_2026"],
  ["DAYS_LEFT", "12"],
  ["TIME_LEFT", "12d 4h"],
  ["EXPIRE_DATE", "2026-08-06"],
  ["DATA_USAGE", "3.2 GB"],
  ["DATA_LIMIT", "50.0 GB"],
  ["DATA_LEFT", "46.8 GB"],
  ["GROUP_NAME", "LTE"],
  ["GROUP_USED", "12.3 GB"],
  ["GROUP_LIMIT", "100.0 GB"],
  ["GROUP_LEFT", "87.7 GB"],
  ["GROUPS", "LTE: 12.3 GB / 100.0 GB"],
  ["DEVICE_COUNT", "2"],
  ["DEVICE_LIMIT", "5"],
  ["DEVICE_LEFT", "3"],
  ["STATUS_EMOJI", "✅"],
  ["STATUS_TEXT", "Active"],
  ["SERVER_IP", "51.250.38.20"],
];

const renderPreview = (template: string): string =>
  ANNOUNCE_VARS.reduce(
    (text, [name, sample]) => text.split(`{${name}}`).join(sample),
    template
  );

// Mirrors align_announce() in app/subscription/share.py: emoji/CJK count as two
// cells, variation selectors and ZWJ as none.
const displayWidth = (line: string): number => {
  let width = 0;
  const chars = Array.from(line);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1] ?? "";
    if (ch === "\uFE0F" || ch === "\uFE0E" || ch === "\u200D") continue;
    if (next === "\uFE0F") {
      width += 2;
      continue;
    }
    width += (ch.codePointAt(0) ?? 0) >= 0x1f300 ? 2 : 1;
  }
  return width;
};

const alignAnnounce = (text: string, align: string): string => {
  if (align !== "center" || !text) return text;
  const lines = text.split("\n").map((l) => l.trim());
  const width = Math.max(...lines.map(displayWidth), 0);
  return lines
    .map((l) =>
      l ? " ".repeat(Math.max(Math.floor((width - displayWidth(l)) / 2), 0)) + l : l
    )
    .join("\n");
};

export const SubscriptionSettings: FC = () => {
  const { data, patch } = useYukuSettings();
  const announceRef = useRef<HTMLTextAreaElement | null>(null);

  const preview = useMemo(
    () => alignAnnounce(renderPreview(data.announce), data.announce_align),
    [data.announce, data.announce_align]
  );

  // insert {VAR} where the caret is, so building a template stays one click
  const insertVariable = (name: string) => {
    const el = announceRef.current;
    const token = `{${name}}`;
    if (!el) {
      patch({ announce: data.announce + token });
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    patch({ announce: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <VStack align="stretch" spacing="4">
      <Section
        icon={MegaphoneIcon}
        title="Объявление в шапке подписки"
        description="Строки над списком серверов в клиенте"
        actions={
          <HStack spacing="2">
            <Text fontSize="xs" color="ui.textMuted">
              Выравнивание
            </Text>
            <Select
              size="sm"
              w="150px"
              value={data.announce_align}
              onChange={(e) => patch({ announce_align: e.target.value })}
            >
              <option value="left">по левому краю</option>
              <option value="center">по центру</option>
            </Select>
          </HStack>
        }
      >
        <VStack align="stretch" spacing="4">
          <Field
            label="Текст объявления"
            helper="Нажми на переменную, чтобы вставить её в текст. DATA_* — общий трафик юзера и его лимит, GROUP_* — трафик в группе хостов ({GROUPS} — список всех групп, по строке на группу)."
            hintBody={
              <Text>
                По центру строки дополняются пробелами. В клиенте шрифт
                пропорциональный, поэтому центрирование приблизительное.
              </Text>
            }
          >
            <Textarea
              ref={announceRef}
              rows={6}
              fontFamily="mono"
              fontSize="sm"
              placeholder="🔥 Подписка активна&#10;Осталось: {DAYS_LEFT} дн."
              value={data.announce}
              onChange={(e) => patch({ announce: e.target.value })}
            />
          </Field>

          <HStack spacing="1.5" wrap="wrap">
            {ANNOUNCE_VARS.map(([name]) => (
              <Tag
                key={name}
                size="sm"
                cursor="pointer"
                variant="subtle"
                colorScheme="primary"
                onClick={() => insertVariable(name)}
                _hover={{ opacity: 0.75 }}
              >
                <TagLabel>{`{${name}}`}</TagLabel>
              </Tag>
            ))}
          </HStack>

          <Box>
            <Text fontSize="xs" color="ui.textMuted" mb="1.5">
              Превью с примерными значениями
            </Text>
            <Box
              bg="ui.surfaceMuted"
              borderWidth="1px"
              borderColor="ui.border"
              borderRadius="lg"
              p="3"
              fontSize="sm"
              fontFamily={data.announce_align === "center" ? "mono" : undefined}
              whiteSpace="pre-wrap"
              minH="64px"
            >
              {preview || (
                <Text as="span" color="ui.textFaint">
                  — пусто, будет показан текст по умолчанию —
                </Text>
              )}
            </Box>
          </Box>
        </VStack>
      </Section>

      <Section
        icon={BellAlertIcon}
        title="Сообщения-заглушки"
        description="Показываются вместо серверов, когда подписка недоступна"
      >
        <VStack align="stretch" spacing="4">
          <Field
            label="Истёкшая подписка"
            helper="Каждая строка — отдельный «сервер»-уведомление в клиенте."
          >
            <Textarea
              rows={3}
              value={data.expired_notice}
              onChange={(e) => patch({ expired_notice: e.target.value })}
            />
          </Field>
          <Field
            label="Превышен лимит устройств"
            helper="Показывается устройству, которое не поместилось в лимит."
          >
            <Textarea
              rows={3}
              value={data.device_limit_notice}
              onChange={(e) => patch({ device_limit_notice: e.target.value })}
            />
          </Field>
        </VStack>
      </Section>

      <Section
        icon={MapIcon}
        title="Роутинг и DNS"
        description="Профиль, встроенный в конфиги формата v2ray-json"
      >
        <Field
          helper="Российские сайты и локальная сеть идут мимо VPN, реклама и телеметрия режутся, DNS для RU-доменов — через DoH Яндекса."
        >
          <Select
            value={data.subscription_routing}
            onChange={(e) => patch({ subscription_routing: e.target.value })}
          >
            <option value="off">выключено (обычный конфиг)</option>
            <option value="yuku_routing">RU split-tunnel + блокировка рекламы</option>
          </Select>
        </Field>
        {data.subscription_routing !== "off" && (
          <HStack
            mt="3"
            align="flex-start"
            spacing="2"
            bg="orange.50"
            _dark={{ bg: "rgba(237,137,54,.12)" }}
            borderRadius="lg"
            p="3"
          >
            <Badge colorScheme="orange">внимание</Badge>
            <Text fontSize="xs" color="ui.textMuted">
              Профиль повторяется в каждом конфиге: подписка вырастает с десятков
              КБ до нескольких МБ. Включай, только если на nginx включён gzip для
              /sub.
            </Text>
          </HStack>
        )}
      </Section>
    </VStack>
  );
};
