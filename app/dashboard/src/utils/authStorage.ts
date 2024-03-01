import { jwtDecode } from "jwt-decode";

export const getAuthToken = () => {
  return localStorage.getItem("token");
};

export const isValidToken = () => {
  let token = getAuthToken();
  let decode_token = token && jwtDecode(token);
  return !!decode_token;
};

export const setAuthToken = (token: string) => {
  localStorage.setItem("token", token);
};

export const removeAuthToken = () => {
  localStorage.removeItem("token");
};
