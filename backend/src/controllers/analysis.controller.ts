import { Request, Response } from 'express';
import { analyzeIncident } from '../services/analysis.service';

export const analyze = async (req: Request, res: Response) => {
  const analysis = await analyzeIncident(String(req.params.id), req.body.useMemory);
  res.status(201).json(analysis);
};
