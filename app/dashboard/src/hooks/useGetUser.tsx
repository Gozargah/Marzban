import { getAuthToken } from "utils/authStorage";
import { fetch } from "service/http";
import { UserApi, UseGetUserReturn } from "types/User";
import { useQuery } from "react-query";

const fetchUser = async () => {
    return await fetch("/admin");
}

const useGetUser = (): UseGetUserReturn => {
    const { data, isError, isLoading, isSuccess, error } = useQuery<UserApi, Error>({
        queryFn: () => fetchUser()
    })

    const userDataEmpty: UserApi =  {
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