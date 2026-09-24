export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, message, details);
export const notFound = (message = 'Not found') => new AppError(404, message);
export const conflict = (message) => new AppError(409, message);
