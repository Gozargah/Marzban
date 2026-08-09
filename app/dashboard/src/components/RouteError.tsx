import { Box, Button, Text, VStack } from "@chakra-ui/react";
import { FC } from "react";
import { useRouteError } from "react-router-dom";
import { Login } from "../pages/Login";

/**
 * Route-level error element. Only a genuine auth failure (401/403 from the
 * admin loader) should drop the user to the login screen and clear the token.
 * A render-time exception must NOT log the user out — show a recoverable
 * message and keep the session.
 */
export const RouteError: FC = () => {
  const error: any = useRouteError();
  const status =
    error?.status ?? error?.statusCode ?? error?.response?.status;

  if (status === 401 || status === 403) {
    return <Login />;
  }

  return (
    <VStack minH="100vh" justifyContent="center" spacing={4} p={6}>
      <Text fontSize="lg" fontWeight="semibold">
        Что-то пошло не так
      </Text>
      <Text fontSize="sm" color="gray.500" textAlign="center" maxW="420px">
        Произошла ошибка интерфейса. Сессия не сброшена — просто перезагрузите
        страницу.
      </Text>
      <Box>
        <Button colorScheme="primary" onClick={() => window.location.reload()}>
          Перезагрузить
        </Button>
      </Box>
    </VStack>
  );
};
