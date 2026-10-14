import { fetch } from "service/http";
import { queryClient } from "utils/react-query";
import { createUsersResource } from "./resource";
export const usersResource = createUsersResource(queryClient, fetch);
