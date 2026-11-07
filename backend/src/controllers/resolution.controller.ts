import { Request, Response } from 'express';
import { confirmResolution } from '../services/resolution.service';

export const resolve = async (req: Request, res: Response) => {
  const resolution = await confirmResolution(String(req.params.id), req.body);
  // 201: resolution saved. `retained` tells the UI if Hindsight accepted it.
  res.status(201).json({
    resolution,
    retained: resolution.retained,
    warning: resolution.retained ? undefined : `Resolution saved, but not yet remembered by Hindsight: ${resolution.retainError}. Use "Retry" on the incident page.`,
  });
};
