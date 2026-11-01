import { clearAllDrafts } from "@/features/shared/drafts";

/** Remove bearer tokens left behind by older dashboard versions. */
export const clearLegacyAuthToken = () => {
  try {
    localStorage.removeItem("token");
  } catch {
    /* Browser storage is optional. */
  }
};

/** Clear page-local state; authentication is held in an HttpOnly server cookie. */
export const clearAuthState = () => clearAllDrafts();
