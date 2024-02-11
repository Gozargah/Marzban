import { Alert, AlertDescription, AlertIcon, AlertTitle, Button, CloseButton, HStack, VStack } from "@chakra-ui/react";
import { FlagIcon } from "@heroicons/react/24/outline";
import { shouldShowDonation } from "components/Header";
import { DONATION_URL } from "constants/project";
import { useState } from "react";

export const DonationCard = () => {
  const [showDonationNotif, setShowDonationNotif] = useState(shouldShowDonation());
  if (showDonationNotif)
    return (
      <Alert
        bg="#2E3035"
        _light={{
          bg: "gray.200",
        }}
        alignItems="start"
        p="4"
      >
        <VStack alignItems="start" fontSize="sm" gap="4">
          <VStack gap="1" alignItems="start">
            <HStack>
              <AlertIcon color="white" _light={{ color: "gray.800" }} mr="0" width="16px" height="16px">
                <FlagIcon width="16px" height="16px" strokeWidth="2px" />
              </AlertIcon>
              <AlertTitle fontWeight="semibold" color="white" _light={{ color: "gray.800" }}>
                Support Marzban
              </AlertTitle>
            </HStack>
            <AlertDescription color="gray.200" _light={{ color: "gray.600" }} lineHeight="20px">
              Donate to Marzban for seamless functionality and continued improvement. Thank you!
            </AlertDescription>
          </VStack>
          <HStack gap="4">
            <Button
              size="sm"
              variant="link"
              color="white"
              _light={{ color: "gray.800" }}
              fontWeight="semibold"
              textUnderlineOffset="3px"
              as="a"
              href={DONATION_URL}
              target="_blank"
            >
              Donate now
            </Button>
          </HStack>
        </VStack>
        <CloseButton
          onClick={setShowDonationNotif.bind(null, false)}
          color="white"
          alignSelf="flex-start"
          position="absolute"
          _light={{ color: "gray.800" }}
          right={3}
          top={3}
        />
      </Alert>
    );
  return null;
};
