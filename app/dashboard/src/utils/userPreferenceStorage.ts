const NUM_USERS_PER_PAGE_LOCAL_STORAGE_KEY = "marzban-num-users-per-page";
const NUM_USERS_PER_PAGE_DEFAULT = 10;
export const getUsersPerPageLimitSize = () => {
  const numUsersPerPage =
    localStorage.getItem(NUM_USERS_PER_PAGE_LOCAL_STORAGE_KEY) ||
    NUM_USERS_PER_PAGE_DEFAULT.toString(); // this catches `null` values
  return parseInt(numUsersPerPage) || NUM_USERS_PER_PAGE_DEFAULT; // this catches NaN values
};

export const setUsersPerPageLimitSize = (value: string) => {
  return localStorage.setItem(NUM_USERS_PER_PAGE_LOCAL_STORAGE_KEY, value);
};
