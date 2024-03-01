import { isValidToken } from "utils/authStorage";

export const useIsAuthenticated = () => {
  return isValidToken();
};
