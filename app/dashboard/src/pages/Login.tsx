import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  chakra,
  FormControl,
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
import { useAccentColor } from "contexts/AccentColorContext";

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
  const { accent } = useAccentColor();
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
        <HStack w="full" justifyContent="center" alignItems="center" mt={8}>
          <Box
            w="full"
            maxW="400px"
            className="glass"
            p={8}
            borderRadius="24px"
          >
            <VStack alignItems="center" w="full" spacing={3}>
              <Box
                p={3}
                borderRadius="16px"
                bg={`linear-gradient(135deg, ${accent.primary}, ${accent.secondary})`}
                boxShadow={`0 8px 30px ${accent.glow}`}
                transition="all 0.5s ease"
              >
                <LogoIcon color="white" />
              </Box>
              <Text
                fontSize="2xl"
                fontWeight="bold"
                bgGradient={`linear(to-r, ${accent.primary}, ${accent.secondary})`}
                bgClip="text"
                transition="all 0.5s ease"
              >
                {t("login.loginYourAccount")}
              </Text>
              <Text color="gray.400" fontSize="sm">
                {t("login.welcomeBack")}
              </Text>
            </VStack>
            <Box w="full" maxW="320px" m="auto" pt="6">
              <form onSubmit={handleSubmit(login)}>
                <VStack mt={4} rowGap={3}>
                  <FormControl>
                    <Input
                      w="full"
                      placeholder={t("username")}
                      className="glass-input"
                      {...register("username")}
                      error={t(errors?.username?.message as string)}
                    />
                  </FormControl>
                  <FormControl>
                    <Input
                      w="full"
                      type="password"
                      placeholder={t("password")}
                      className="glass-input"
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
                    className="accent-btn"
                    size="lg"
                    borderRadius="12px"
                    mt={2}
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
