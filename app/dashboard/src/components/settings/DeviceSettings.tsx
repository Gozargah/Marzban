/**
 * Devices tab: the HWID limit applied to new users, plus what the fleet of
 * registered devices currently looks like.
 */
import { Input, VStack } from "@chakra-ui/react";
import { DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import { FC } from "react";
import { DeviceStats } from "../DeviceStats";
import { Field, Section } from "../ui";
import { useYukuSettings } from "./yukuSettings";

export const DeviceSettings: FC = () => {
  const { data, patch } = useYukuSettings();

  return (
    <VStack align="stretch" spacing="4">
      <Section
        icon={DevicePhoneMobileIcon}
        title="Лимит устройств"
        description="Сколько устройств может держать подписку одновременно"
      >
        <Field
          label="По умолчанию для новых пользователей"
          helper="0 — без ограничения. У пользователя лимит можно переопределить в его карточке."
          hint="Устройство считается по HWID, который клиент присылает вместе с запросом подписки."
        >
          <Input
            type="number"
            min={0}
            maxW="200px"
            value={data.default_device_limit}
            onChange={(e) => patch({ default_device_limit: e.target.value })}
          />
        </Field>
      </Section>

      <DeviceStats />
    </VStack>
  );
};
