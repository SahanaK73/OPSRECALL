import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

type Schemas = { body?: ZodTypeAny; params?: ZodTypeAny; query?: ZodTypeAny };

/** Validate (and normalise) body/params/query. Failures become a 400 via the error handler. */
export const validate = (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.query) (req as unknown as { validatedQuery: unknown }).validatedQuery = schemas.query.parse(req.query);
    next();
  } catch (e) {
    next(e);
  }
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
