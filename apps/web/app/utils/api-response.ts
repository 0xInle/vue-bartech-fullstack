type ApiError = { detail?: string; message?: string };
type ApiResponse = { data: unknown; status: number };

export async function requestApi<T>(result: Promise<ApiResponse>): Promise<T> {
  const response = await result;
  if (response.status < 200 || response.status >= 300) {
    const problem = response.data as ApiError;
    throw new Error(
      problem.detail ?? problem.message ?? "Не удалось выполнить запрос. Попробуйте ещё раз.",
    );
  }
  return response.data as T;
}
