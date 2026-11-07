export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'APP_ERROR',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export const notFound = (what: string) => new AppError(404, `${what} not found`, 'NOT_FOUND');
