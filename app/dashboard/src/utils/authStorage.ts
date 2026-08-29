// The session lives in an httpOnly cookie the server sets on login, so no
// script on the page can read the token. Nothing auth related is kept here
// any more; this only cleans up after installs that predate the cookie.
export const clearLegacyToken = () => {
  localStorage.removeItem("token");
};
