import { Alert, AlertDescription, AlertIcon, AlertTitle, Button, CloseButton, HStack, VStack } from "@chakra-ui/react";
import { FlagIcon } from "@heroicons/react/24/outline";
import { DONATION_URL } from "config/project";
import differenceInDays from "date-fns/differenceInDays";
import isValid from "date-fns/isValid";
import { useState } from "react";

export const NOTIFICATION_KEY = "marzban-menu-notification";

export const shouldShowDonation = (): boolean => {
  const date = localStorage.getItem(NOTIFICATION_KEY);
  if (!date) return true;
  try {
    if (date && isValid(parseInt(date))) {
      if (differenceInDays(new Date(), new Date(parseInt(date))) >= 7) return true;
      return false;
    }
    return true;
  } catch (err) {
    return true;
  }
};
export const DonationCard = () => {
  const [showDonationNotif, setShowDonationNotif] = useState(shouldShowDonation());
  const handleOnClose = () => {
    localStorage.setItem(NOTIFICATION_KEY, new Date().getTime().toString());
    setShowDonationNotif(false);
  };
  if (showDonationNotif)
    return (
      <Alert
        bg="active-menu-bg"
        border="1px solid"
        borderColor="border"
        _light={{
          boxShadow: "0px 2px 4px -2px rgba(16, 24, 40, 0.06)",
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
          onClick={handleOnClose}
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
