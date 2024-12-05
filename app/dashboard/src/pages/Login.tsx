import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Formik, Field, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { fetch } from "@/service/http";
import { removeAuthToken, setAuthToken } from "@/utils/authStorage";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Language } from "@/components/Language";
import { ModeToggle } from "@/components/mode-toggle";
import LogoIcon from "@/assets/logo.svg";
import { LogIn } from "lucide-react";

const schema = Yup.object({
  username: Yup.string().required("login.fieldRequired"),
  password: Yup.string().required("login.fieldRequired"),
});

export const Login: React.FC = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  let location = useLocation();

  useEffect(() => {
    removeAuthToken();
    if (location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, []);

  const login = (
    values: { username: string; password: string },
    actions: FormikHelpers<any>
  ) => {
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("username", values.username);
    formData.append("password", values.password);
    formData.append("grant_type", "password");

    fetch
      .post("/admin/token", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      .then(({ access_token: token }) => {
        setAuthToken(token);
        navigate("/");
      })
      .catch((err) => {
        setError(err.response?._data?.detail || "An error occurred.");
      })
      .finally(() => {
        setLoading(false);
        actions.setSubmitting(false);
      });
  };

  return (
    <div className="flex flex-col justify-between min-h-screen p-6 w-full">
      <div className="w-full">
        <div className="flex justify-between w-full">
          <ModeToggle />
          <Language />
        </div>
        <div className="flex justify-center items-center w-full">
          <div className="w-full max-w-sm mt-6">
            <div className="flex flex-col items-center w-full">
              <div className="w-14 h-14 mb-4">
                <LogoIcon />
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                {t("login.loginYourAccount")}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {t("login.welcomeBack")}
              </p>
            </div>
            <div className="w-full max-w-xs m-auto pt-6">
              <Formik
                initialValues={{ username: "", password: "" }}
                validationSchema={schema}
                onSubmit={login}
              >
                {({ errors, touched, isSubmitting }) => (
                  <Form>
                    <div className="mt-4 space-y-4">
                      <div className="form-control">
                        <Field
                          as={Input}
                          className="py-5 px-4"
                          placeholder={t("username")}
                          name="username"
                          error={
                            errors.username && touched.username
                              ? t(errors.username)
                              : ""
                          }
                        />
                      </div>
                      <div className="form-control">
                        <Field
                          as={Input}
                          className="py-5 px-4"
                          type="password"
                          placeholder={t("password")}
                          name="password"
                          error={
                            errors.password && touched.password
                              ? t(errors.password)
                              : ""
                          }
                        />
                      </div>
                      {error && (
                        <Alert variant="destructive">
                          <AlertTitle>!</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <Button
                        type="submit"
                        className="w-full"
                        color="primary"
                        loading={loading || isSubmitting}
                      >
                        <div className="flex items-center gap-x-2">
                          <LogIn className="w-5 h-5" />
                          <span>{t("login")}</span>
                        </div>
                      </Button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
