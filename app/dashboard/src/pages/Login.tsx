import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
	Button,
	FormControl,
	HStack,
	Text,
	VStack,
	chakra,
} from "@chakra-ui/react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import Logo from "assets/logo.svg?react";
import { Language } from "components/common/sidebar/Language";
import { ThemeChangerButton } from "components/common/sidebar/ThemeChangerButton";
import { Input } from "components/elements/Input";
import { Footer } from "components/layouts/Footer";
import { FC, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminToken } from "services/api";
import { ErrorType } from "services/http";
import { removeAuthToken, setAuthToken } from "utils/authStorage";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(1, "login.fieldRequired"),
  password: z.string().min(1, "login.fieldRequired"),
});

export const LogoIcon = chakra(Logo, {
  baseStyle: {
    strokeWidth: "10px",
    w: 16,
    h: 16,
  },
});

const LoginIcon = chakra(ArrowRightOnRectangleIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    strokeWidth: "2px",
  },
});

export const Login: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  let location = useLocation();
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  useEffect(() => {
    removeAuthToken();
    if (location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, []);

  const {
    mutate: login,
    isLoading,
    error,
  } = useAdminToken<ErrorType<string>>({
    mutation: {
      onSuccess({ access_token: token }) {
        setAuthToken(token);
				console.log('navigating...')
        navigate("/");
      },
    },
  });

  return (
    <VStack
      justifyContent="space-between"
      minH="100vh"
      p={{
        base: "4",
        md: "6",
      }}
      w="full"
    >
      <Box w="full">
        <HStack justifyContent="end" w="full">
          <ThemeChangerButton />
          <Language />
        </HStack>
        <HStack w="full" justifyContent="center" alignItems="center">
          <Box w="full" maxW="340px" mt="10">
            <VStack alignItems="center" w="full">
              <LogoIcon />
              <Text
                fontSize={{
                  base: "lg",
                  md: "2xl",
                }}
                fontWeight="semibold"
                mt="2"
                textAlign="center"
              >
                {t("login.loginYourAccount")}
              </Text>
              <Text
                color="gray.600"
                _dark={{ color: "gray.400" }}
                textAlign="center"
                fontSize={{
                  base: "sm",
                  md: "md",
                }}
              >
                {t("login.welcomeBack")}
              </Text>
            </VStack>
            <Box w="full" maxW="300px" m="auto" pt="4">
              <form
                onSubmit={handleSubmit((values) => {
                  login({
                    data: {
                      ...values,
                      grant_type: "password",
                    },
                  });
                })}
              >
                <VStack mt={4} rowGap={2}>
                  <FormControl>
                    <Input
                      w="full"
                      placeholder={t("username")}
                      {...register("username")}
                      error={t(errors?.username?.message as string)}
                    />
                  </FormControl>
                  <FormControl>
                    <Input
                      w="full"
                      type="password"
                      placeholder={t("password")}
                      {...register("password")}
                      error={t(errors?.password?.message as string)}
                      autoComplete=""
                    />
                  </FormControl>
                  {error && (
                    <Alert status="error" rounded="md">
                      <AlertIcon />
                      <AlertDescription>{error.data?.detail}</AlertDescription>
                    </Alert>
                  )}
                  <Button isLoading={isLoading} type="submit" w="full" colorScheme="primary">
                    {<LoginIcon marginRight={1} />}
                    {t("login")}
                  </Button>
                </VStack>
              </form>
            </Box>
          </Box>
        </HStack>
      </Box>
      <Footer />
    </VStack>
  );
};

export default Login;
