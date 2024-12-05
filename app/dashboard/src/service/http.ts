import axios, { AxiosRequestConfig, AxiosInstance } from "axios";
import { getAuthToken } from "@/utils/authStorage";

// Create Axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_API,
});

// Custom fetcher function with type support
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

// Adding convenience methods for common HTTP methods
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

// Export fetch as alias for fetcher
export const fetch = fetcher;
