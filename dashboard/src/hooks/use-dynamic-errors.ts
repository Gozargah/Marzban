import {toast} from "sonner";
import {useTranslation} from "react-i18next";
import {isEmptyObject} from "@/utils/isEmptyObject.ts";

interface DynamicErrorHandlerProps {
    error: any;
    fields: string[];
    form: any;
    contextKey: string;
}

// Hook for handling error
const useDynamicErrorHandler = () => {
    const { t } = useTranslation();

    return ({error, fields, form, contextKey}: DynamicErrorHandlerProps) => {
        console.error("Operation failed:", error);
        console.error("Error response:", error?.response);
        console.log("Error data:", error?.response?._data?.detail);

        // Reset all previous errors
        form.clearErrors();

        const responseData = error?.response?._data || error?.response?.data;

        // Handle validation errors
        if (responseData && !isEmptyObject(responseData)) {
            const detail = responseData.detail;

            if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
                const firstField = Object.keys(detail)[0];
                const firstMessage = detail[firstField];

                Object.entries(detail).forEach(([field, message]) => {
                    if (fields.includes(field)) {
                        form.setError(field, {
                            type: "manual",
                            message:
                                typeof message === "string"
                                    ? message
                                    : t("validation.invalid", {
                                        field: t(`${contextKey}.${field}`, {defaultValue: field}),
                                        defaultValue: `${field} is invalid`,
                                    }),
                        });
                    }
                });

                toast.error(
                    firstMessage ||
                    t("validation.invalid", {
                        field: t(`${contextKey}.${firstField}`, {defaultValue: firstField}),
                        defaultValue: `${firstField} is invalid`,
                    })
                );
            } else if (typeof detail === "string") {
                toast.error(detail);
            }
        } else if (responseData) {
            // Handle structured API errors
            let errorMessage = "";

            if (typeof responseData === "string") {
                errorMessage = responseData;
            } else if (Array.isArray(responseData.detail)) {
                // Pydantic-style array of errors
                responseData.detail.forEach((err: any) => {
                    const field = err?.loc?.[1];
                    if (field) {
                        form.setError(field, {
                            type: "manual",
                            message: err.msg,
                        });
                    }
                });
                errorMessage = responseData.detail[0]?.msg || "Validation error";
            } else if (typeof responseData.detail === "string") {
                errorMessage = responseData.detail;
            } else if (responseData.message) {
                errorMessage = responseData.message;
            } else {
                errorMessage = "An unexpected error occurred";
            }

            toast.error(errorMessage);
        } else {
            // Generic fallback
            toast.error(
                error?.message || t(`${contextKey}.genericError`, {defaultValue: "An error occurred"})
            );
        }
    };
};

export default useDynamicErrorHandler;
