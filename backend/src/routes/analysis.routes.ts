import { Router } from 'express';
import { asyncHandler, validate } from '../middleware/validateRequest';
import { analyzeBodySchema, idParamSchema } from '../utils/schemas';
import { analyze } from '../controllers/analysis.controller';

const r = Router();
// mounted at /api/incidents
r.post('/:id/analyze', validate({ params: idParamSchema, body: analyzeBodySchema }), asyncHandler(analyze));
export default r;
