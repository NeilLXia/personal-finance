export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const authExpiredEvent = "expense-tracker:auth-expired";

export const addAuthExpiredListener = (handler: () => void) => {
  window.addEventListener(authExpiredEvent, handler);

  return () => {
    window.removeEventListener(authExpiredEvent, handler);
  };
};

export const notifyAuthExpired = () => {
  window.dispatchEvent(new Event(authExpiredEvent));
};

export const getResponseErrorMessage = async (
  response: Response,
  fallbackMessage: string,
) => {
  try {
    const responseBody = await response.json();

    return responseBody.error?.error_message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

export const request = async (
  path: string,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) => {
  const response = await fetch(path, options);

  if (!response.ok) {
    const message = await getResponseErrorMessage(
      response,
      `${fallbackMessage} with ${response.status}`,
    );

    if (response.status === 401) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  return response;
};

export const getJson = async <T>(
  path: string,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) => (await request(path, options, fallbackMessage)).json() as Promise<T>;

export const postJson = async <T>(
  path: string,
  body?: unknown,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) =>
  (
    await request(
      path,
      {
        ...options,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      fallbackMessage,
    )
  ).json() as Promise<T>;

export const putJson = async <T>(
  path: string,
  body?: unknown,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) =>
  (
    await request(
      path,
      {
        ...options,
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      fallbackMessage,
    )
  ).json() as Promise<T>;

export const postJsonWithoutBody = async (
  path: string,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) =>
  request(
    path,
    {
      ...options,
      method: "POST",
    },
    fallbackMessage,
  );

export const postFormData = async <T>(
  path: string,
  body: FormData,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) =>
  (
    await request(
      path,
      {
        ...options,
        method: "POST",
        body,
      },
      fallbackMessage,
    )
  ).json() as Promise<T>;

export const postUrlEncoded = async (
  path: string,
  body: URLSearchParams,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) =>
  request(
    path,
    {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        ...options.headers,
      },
      body,
    },
    fallbackMessage,
  );

export const deleteRequest = async (
  path: string,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
) =>
  request(
    path,
    {
      ...options,
      method: "DELETE",
    },
    fallbackMessage,
  );
