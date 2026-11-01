type ApiError = { code?: string; detail?: string; message?: string };
type ApiResponse = { data: unknown; status: number };
type SuccessfulData<Response extends ApiResponse> = Response extends {
  data: infer Data;
  status: infer Status;
}
  ? Status extends 200 | 201 | 202 | 203 | 204 | 205
    ? Data
    : never
  : never;

export function requestApi<Response extends ApiResponse>(
  result: Promise<Response>,
): Promise<SuccessfulData<Response>>;
export function requestApi<T>(result: Promise<ApiResponse>): Promise<T>;
export async function requestApi<T>(result: Promise<ApiResponse>): Promise<T> {
  const response = await result;
  if (response.status < 200 || response.status >= 300) {
    const problem = response.data as ApiError;
    throw new ApiRequestError(
      problem.detail ?? problem.message ?? "Не удалось выполнить запрос. Попробуйте ещё раз.",
      response.status,
      problem.code,
    );
  }
  return response.data as T;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
