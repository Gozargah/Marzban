import { Badge, Box, Card, HStack, Text, VStack } from "@chakra-ui/react";
import { FC, PropsWithChildren, ReactElement, ReactNode } from "react";

type StatisticCardProps = {
  title: string;
  content: ReactNode;
  icon?: ReactElement;
  badge?: number;
};

export const StatisticCard: FC<PropsWithChildren<StatisticCardProps>> = ({ title, content, icon, badge }) => {
  return (
    <Card
      p={6}
      borderWidth="1px"
      borderColor="border"
      bg="card-bg"
      borderStyle="solid"
      boxShadow="none"
      borderRadius="12px"
      width="full"
      display="flex"
      justifyContent="space-between"
      flexDirection="row"
    >
      <VStack alignItems="start">
        <HStack align="start" alignItems="start" columnGap="4">
          {icon == undefined ? undefined : (
            <Box
              p="2"
              position="relative"
              color="white"
              _before={{
                content: `""`,
                position: "absolute",
                top: 0,
                left: 0,
                bg: "primary.400",
                display: "block",
                w: "full",
                h: "full",
                borderRadius: "5px",
                opacity: ".5",
                z: "1",
              }}
              _after={{
                content: `""`,
                position: "absolute",
                top: "-5px",
                left: "-5px",
                bg: "primary.400",
                display: "block",
                w: "calc(100% + 10px)",
                h: "calc(100% + 10px)",
                borderRadius: "8px",
                opacity: ".4",
                z: "1",
              }}
            >
              {icon}
            </Box>
          )}

          <Text
            color="gray.600"
            _dark={{
              color: "gray.300",
            }}
            fontWeight="medium"
            textTransform="capitalize"
            fontSize="sm"
          >
            {title}
          </Text>
        </HStack>
        <Box fontSize="3xl" fontWeight="semibold" mt="2">
          {content}
        </Box>
      </VStack>
      {badge == undefined ? undefined : (
        <Box alignSelf="end">
          <Badge px="2" colorScheme={badge > 0 ? "green" : badge < 0 ? "red" : "gray"}>
            {badge > 0 ? "↑" : badge < 0 ? "↓" : "-"}
            {Math.abs(badge)}%
          </Badge>
        </Box>
      )}
    </Card>
  );
};
