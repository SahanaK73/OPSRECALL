import { Router } from 'express';
import { asyncHandler, validate } from '../middleware/validateRequest';
import { createIncidentSchema, idParamSchema } from '../utils/schemas';
import * as c from '../controllers/incident.controller';

const r = Router();
r.post('/', validate({ body: createIncidentSchema }), asyncHandler(c.create));
r.get('/', asyncHandler(c.list));
r.get('/stats', asyncHandler(c.stats)); // before '/:id'
r.get('/synthetic', c.synthetic);
r.get('/:id', validate({ params: idParamSchema }), asyncHandler(c.get));
export default r;
