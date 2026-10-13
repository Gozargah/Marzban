import { adminQueryOptions } from "utils/admin-query";
import { UserApi, UseGetUserReturn } from "types/User";
import { useQuery } from "@tanstack/react-query";

const useGetUser = (): UseGetUserReturn => {
  const { data, isError, isLoading, isSuccess, error } = useQuery(adminQueryOptions);

  const userDataEmpty: UserApi = {
    discord_webook: "",
    is_sudo: false,
    telegram_id: "",
    username: ""
  }

  return {
    userData: data || userDataEmpty,
    getUserIsPending: isLoading,
    getUserIsSuccess: isSuccess,
    getUserIsError: isError,
    getUserError: error
  }
};

export default useGetUser;
