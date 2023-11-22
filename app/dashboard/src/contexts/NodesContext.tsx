import { useGetNodes } from "service/api";
import { z } from "zod";
import { useDashboard } from "./DashboardContext";

export const NodeSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  port: z
    .number()
    .min(1)
    .or(z.string().transform((v) => parseFloat(v)))
    .optional(),
  api_port: z
    .number()
    .min(1)
    .or(z.string().transform((v) => parseFloat(v)))
    .optional(),
  xray_version: z.string().nullable().optional(),
  id: z.number().nullable().optional(),
  status: z
    .enum(["connected", "connecting", "error", "disabled"])
    .nullable()
    .optional(),
  message: z.string().nullable().optional(),
  add_as_new_host: z.boolean().optional(),
});

export type NodeType = z.infer<typeof NodeSchema>;

export const getNodeDefaultValues = (): NodeType => ({
  name: "",
  address: "",
  port: 62050,
  api_port: 62051,
  xray_version: "",
});

export const useNodesQuery = () => {
  const { isEditingNodes } = useDashboard();
  return useGetNodes({
    query: {
      refetchInterval: isEditingNodes ? 3000 : undefined,
      refetchOnWindowFocus: false,
    },
  });
};
