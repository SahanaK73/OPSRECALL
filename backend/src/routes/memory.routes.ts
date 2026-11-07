import { Router } from 'express';
import { asyncHandler, validate } from '../middleware/validateRequest';
import { idParamSchema, memoryQuerySchema } from '../utils/schemas';
import * as c from '../controllers/memory.controller';

const r = Router();
r.get('/', validate({ query: memoryQuerySchema }), asyncHandler(c.getMemory));
r.get('/search', asyncHandler(c.search));
r.post('/retry/:id', validate({ params: idParamSchema }), asyncHandler(c.retry));
export default r;
