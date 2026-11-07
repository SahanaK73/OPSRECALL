import { Router } from 'express';
import { asyncHandler, validate } from '../middleware/validateRequest';
import { idParamSchema, resolveSchema } from '../utils/schemas';
import { resolve } from '../controllers/resolution.controller';

const r = Router();
// mounted at /api/incidents
r.post('/:id/resolve', validate({ params: idParamSchema, body: resolveSchema }), asyncHandler(resolve));
export default r;
