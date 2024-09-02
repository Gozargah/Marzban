import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  chakra,
  FormControl,
  FormLabel,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { FC, useEffect, useState } from "react";
import { FieldValues, useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Footer } from "components/Footer";
import { Input } from "components/Input";
import { fetch } from "service/http";
import { removeAuthToken, setAuthToken } from "utils/authStorage";
import { ReactComponent as Logo } from "assets/logo.svg";
import { useTranslation } from "react-i18next";
import { Language } from "components/Language";

const schema = z.object({
  username: z.string().min(1, "login.fieldRequired"),
  password: z.string().min(1, "login.fieldRequired"),
});

export const LogoIcon = chakra(Logo, {
  baseStyle: {
    strokeWidth: "10px",
    w: 12,
    h: 12,
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  let location = useLocation();
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm({
    resolver: zodResolver(schema),
  });
  useEffect(() => {
    removeAuthToken();
    if (location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, []);
  const login = (values: FieldValues) => {
    setError("");
    const formData = new FormData();
    formData.append("username", values.username);
    formData.append("password", values.password);
    formData.append("grant_type", "password");
    setLoading(true);
    fetch("/admin/token", { method: "post", body: formData })
      .then(({ access_token: token }) => {
        setAuthToken(token);
        navigate("/");
      })
      .catch((err) => {
        setError(err.response._data.detail);
      })
      .finally(setLoading.bind(null, false));
  };
  return (
    <VStack justifyContent="space-between" minH="100vh" p="6" w="full">
      <Box w="full">
        <HStack justifyContent="end" w="full">
          <Language />
        </HStack>
        <HStack w="full" justifyContent="center" alignItems="center">
          <Box w="full" maxW="340px" mt="6">
            <VStack alignItems="center" w="full">
              <LogoIcon />
              <Text fontSize="2xl" fontWeight="semibold">
                {t("login.loginYourAccount")}
              </Text>
              <Text color="gray.600" _dark={{ color: "gray.400" }}>
                {t("login.welcomeBack")}
              </Text>
            </VStack>
            <Box w="full" maxW="300px" m="auto" pt="4">
              <form onSubmit={handleSubmit(login)}>
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
                    />
                  </FormControl>
                  {error && (
                    <Alert status="error" rounded="md">
                      <AlertIcon />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    isLoading={loading}
                    type="submit"
                    w="full"
                    colorScheme="primary"
                  >
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
