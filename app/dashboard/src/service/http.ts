import axios, { AxiosRequestConfig, AxiosInstance } from "axios";
import { getAuthToken } from "@/utils/authStorage";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_API,
});

export const fetcher = async <T = any>(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<T> => {
  const token = getAuthToken();
  if (token) {
    options.headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }

  const response = await axiosInstance.request<T>({
    url,
    ...options,
  });

  return response.data;
};

fetcher.get = <T = any>(url: string, options: AxiosRequestConfig = {}): Promise<T> => {
  return fetcher<T>(url, { ...options, method: 'GET' });
};

fetcher.post = <T = any>(url: string, data: any, options: AxiosRequestConfig = {}): Promise<T> => {
  return fetcher<T>(url, { ...options, method: 'POST', data });
};

fetcher.put = <T = any>(url: string, data: any, options: AxiosRequestConfig = {}): Promise<T> => {
  return fetcher<T>(url, { ...options, method: 'PUT', data });
};

fetcher.delete = <T = any>(url: string, options: AxiosRequestConfig = {}): Promise<T> => {
  return fetcher<T>(url, { ...options, method: 'DELETE' });
};

export const fetch = fetcher;
