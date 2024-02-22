import { jwtDecode } from "jwt-decode";
import { getAuthToken } from "core/utils/authStorage";

export const checkAuth = () => {
  let token = getAuthToken();
  let decode_token = token && jwtDecode(token);

  return decode_token ? true : false;
};
