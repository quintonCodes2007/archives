export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      throw new ApiError(
        data?.message ||
          data?.error ||
          (response.status >= 500
            ? "The service is unavailable. Check that the backend is running."
            : `Request failed (${response.status}).`),
        response.status,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.name === "AbortError"
        ? "The service took too long to respond. Please try again."
        : "Unable to reach the service. Check your connection and backend.",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const post = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });
export const put = (path, body) =>
  request(path, {
    method: "PUT",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
