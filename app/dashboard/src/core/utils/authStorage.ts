export const getAuthToken = () => {
  return localStorage.getItem("token");
};

export const setAuthToken = (token: string) => {
  localStorage.setItem("token", token);
};

export const removeAuthToken = () => {
  localStorage.removeItem("token");
};
