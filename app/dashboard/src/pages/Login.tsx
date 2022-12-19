import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FC, useEffect, useState } from "react";
import { FieldValues, useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Footer } from "../components/Footer";
import { Input } from "../components/Input";
import { fetch } from "../service/http";
import { setAuthToken } from "../utils/authStorage";

const schema = z.object({
  username: z.string().min(1, "This field is required"),
  password: z.string().min(1, "This field is required"),
});

export const Login: FC = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  let location = useLocation();
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm({
    resolver: zodResolver(schema),
  });
  useEffect(() => {
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
    <VStack justifyContent="space-between" minH="100vh">
      <HStack w="full" justifyContent="center" alignItems="center">
        <Box w="full" maxW="340px" mt="6">
          <form onSubmit={handleSubmit(login)}>
            <VStack>
              <Text
                display="block"
                textAlign="left"
                w="full"
                fontSize="xl"
                fontWeight="semibold"
              >
                Login
              </Text>
              <Input
                w="full"
                placeholder="Username"
                {...register("username")}
                error={errors?.username?.message as string}
              />
              <Input
                w="full"
                type="password"
                placeholder="Password"
                {...register("password")}
                error={errors?.password?.message as string}
              />

              {error && (
                <Alert status="error" rounded="md">
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button isLoading={loading} type="submit" w="full">
                Login
              </Button>
            </VStack>
          </form>
        </Box>
      </HStack>
      <Footer />
    </VStack>
  );
};
