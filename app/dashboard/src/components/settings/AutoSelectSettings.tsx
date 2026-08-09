/**
 * Auto-select tab: the balancer entries that appear in v2ray-json subscriptions.
 * A host joins one of these groups from the host editor.
 */
import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Select,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { BoltIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { FC } from "react";
import { EmptyState, Field, Hint, Section } from "../ui";
import { AUTO_SELECT_STRATEGIES, EMPTY_GROUP, useYukuSettings } from "./yukuSettings";

export const AutoSelectSettings: FC = () => {
  const { groups, setGroups, patchGroup } = useYukuSettings();

  return (
    <Section
      icon={BoltIcon}
      title="Автовыбор сервера"
      description="Записи в подписке, где клиент сам держится самого быстрого сервера"
      actions={
        <Button
          size="sm"
          variant="outline"
          leftIcon={<PlusIcon width="16" />}
          onClick={() => setGroups((list) => [...list, { ...EMPTY_GROUP }])}
        >
          Добавить группу
        </Button>
      }
    >
      <VStack align="stretch" spacing="3">
        <Text fontSize="xs" color="ui.textMuted">
          Каждая группа — отдельная запись в подписке. Хост попадает в группу в
          настройках хоста. Нужно минимум два хоста на группу, иначе запись не
          добавляется. В названии работают те же переменные, что и в объявлении.
        </Text>

        {groups.length === 0 && (
          <EmptyState
            icon={BoltIcon}
            title="Групп нет"
            description="Добавь группу, назначь ей хотя бы два хоста — и в подписке появится запись автовыбора."
          />
        )}

        {groups.map((group, index) => {
          const isLast = index === groups.length - 1;
          return (
            <Box
              key={index}
              borderWidth="1px"
              borderColor="ui.border"
              bg="ui.surfaceMuted"
              borderRadius="lg"
              p="3"
            >
              <HStack mb="3" spacing="2" align="center">
                <Badge colorScheme="primary" flexShrink={0}>
                  группа {index + 1}
                </Badge>
                <Input
                  size="sm"
                  bg="ui.surface"
                  placeholder={index === 0 ? "🌍 Автовыбор" : `🌍 Автовыбор ${index + 1}`}
                  value={group.remark}
                  onChange={(e) => patchGroup(index, { remark: e.target.value })}
                />
                {isLast && groups.length > 1 && (
                  <Tooltip label="Удалить последнюю группу" placement="top">
                    <IconButton
                      aria-label="удалить группу"
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      icon={<TrashIcon width="16" />}
                      onClick={() => setGroups((list) => list.slice(0, -1))}
                    />
                  </Tooltip>
                )}
              </HStack>

              <HStack
                align="flex-start"
                spacing="3"
                flexDir={{ base: "column", md: "row" }}
                gap={{ base: "3", md: "0" }}
              >
                <Box flex="1" minW="0" w="full">
                  <Field label="Стратегия">
                    <Select
                      size="sm"
                      bg="ui.surface"
                      value={group.strategy}
                      onChange={(e) => patchGroup(index, { strategy: e.target.value })}
                    >
                      {AUTO_SELECT_STRATEGIES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Text fontSize="xs" color="ui.textMuted" mt="1.5">
                    {AUTO_SELECT_STRATEGIES.find(([v]) => v === group.strategy)?.[2]}
                  </Text>
                </Box>

                <Box w={{ base: "full", md: "110px" }} flexShrink={0}>
                  <Field label="Интервал" hint="Как часто клиент перезамеряет серверы. Меньше 30s — лишний трафик через каждый сервер.">
                    <Input
                      size="sm"
                      bg="ui.surface"
                      placeholder="1m"
                      value={group.interval}
                      onChange={(e) => patchGroup(index, { interval: e.target.value })}
                    />
                  </Field>
                </Box>
              </HStack>

              <Box mt="3">
                <Field
                  label="Адрес для замеров"
                  hint="Пустое поле — http://www.gstatic.com/generate_204"
                >
                  <Input
                    size="sm"
                    bg="ui.surface"
                    placeholder="http://www.gstatic.com/generate_204"
                    value={group.destination}
                    onChange={(e) => patchGroup(index, { destination: e.target.value })}
                  />
                </Field>
              </Box>
            </Box>
          );
        })}

        <HStack spacing="1.5" align="center">
          <Hint label="Иначе хосты пропали бы из подписки молча." />
          <Text fontSize="xs" color="ui.textMuted">
            Удалить можно только последнюю группу и только если в ней нет хостов.
          </Text>
        </HStack>
      </VStack>
    </Section>
  );
};
