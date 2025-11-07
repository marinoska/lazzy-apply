import { stringify } from "qs";
import { getSupabase } from "../supabase";

export const UNAUTHORIZED = 401;

export const CONTENT_TYPE = "Content-Type";
const defaultHeaders = {
  [CONTENT_TYPE]: "application/json",
};

function isJsonResponse<T extends { headers: Headers }>(response: T) {
  const contentType = response.headers.get("content-type");
  return contentType && contentType.includes("application/json");
}

export type ClientError = {
  data?: unknown;
  message?: string;
  status: number;
  isServerError: boolean;
};
type GetParams = { params?: object; headers?: object };
type PostParams = {
  body?: BodyInit | object;
  headers?: HeadersInit;
  query?: object;
  isFormData?: boolean;
};

type ErrorOptions = {
  host: string;
  url: string;
  status: number;
};

export class Client {
  private authHeader: { Authorization?: string } = {};
  private _authToken? = "";
  private onError?: (options: ErrorOptions) => void;

  constructor(private readonly _host: string) {
    if (!_host) throw new Error("No remote host provided");
  }

  get host() {
    return this._host;
  }

  get authToken() {
    return this._authToken;
  }

  private async _doFetch<T>(url: string, options: RequestInit): Promise<T> {
    await this.setAccessToken();
    const { onError, host, authHeader }: Client = this;
    const headers = { headers: { ...options.headers, ...authHeader } };
    try {
      const response = await fetch(`${host}${url}`, { ...options, ...headers });
      const data = isJsonResponse(response)
        ? await response.json()
        : await response.text();
      if (response.ok) {
        return data;
      }

      const { status, statusText } = response;
      if (onError) onError({ host, url, status });

      if (data && status >= 400 && status < 500) {
        return Promise.reject({ data, status });
      }
      return Promise.reject({
        message: statusText || "Failed request",
        status,
        isServerError: true,
      });
    } catch (e) {
      return Promise.reject({
        message: (e as Error).message,
        isServerError: true,
      });
    }
  }

  public get<R>(path: string, options: GetParams = {}) {
    const { params = {}, headers = {} } = options;
    const qs = Object.keys(params).length ? `?${stringify(params)}` : "";
    return this._doFetch<R>(`${path}${qs}`, {
      headers: {
        Accept: "application/json",
        ...headers,
      },
    });
  }

  public doDelete<R>(path: string) {
    return this._doFetch<R>(`${path}`, {
      method: "DELETE",
    });
  }

  public post<R>(
    path: string,
    { body, headers, query = {}, isFormData = false }: PostParams,
  ) {
    const qs = Object.keys(query).length ? `?${stringify(query)}` : "";

    if (isFormData) {
      return this._doFetch<R>(`${path}${qs}`, {
        body: body as FormData,
        method: "POST",
      });
    }

    return this._doFetch<R>(`${path}${qs}`, {
      body: body && JSON.stringify(body),
      headers: headers
        ? { ...defaultHeaders, ...headers }
        : { ...defaultHeaders },
      method: "POST",
    });
  }

  public put<R>(
    path: string,
    options: RequestInit,
    method: "PUT" | "PATCH" = "PUT",
  ): Promise<R> {
    const headers = options.headers
      ? { ...options.headers, ...defaultHeaders }
      : { ...defaultHeaders };
    return this._doFetch<R>(`${path}`, {
      body: JSON.stringify(options.body),
      headers,
      method,
    });
  }

  public patch<R>(...params: [path: string, options: object]): Promise<R> {
    return this.put<R>(...params, "PATCH");
  }

  public async setAccessToken() {
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
    
      if (!session?.access_token) {
        return;
      }
    
    this.authHeader.Authorization = `Bearer ${session.access_token}`;
    this._authToken = session.access_token;
  }

  public deleteAccessToken() {
    if (this.authHeader.Authorization) {
      delete this.authHeader.Authorization;
      this._authToken = "";
    }
  }

  public setOnError(callback: (options: ErrorOptions) => void) {
    this.onError = callback;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL as string | undefined;

if (!API_BASE_URL) {
	console.warn("VITE_API_URL is not set. API calls may fail.");
}
export const apiClient = new Client(import.meta.env.VITE_API_URL);
