import { Request, Response } from 'express';
import * as incidents from '../services/incident.service';
import { syntheticScenarios } from '../data/syntheticIncidents';

export const create = async (req: Request, res: Response) => {
  const incident = await incidents.createIncident(req.body);
  res.status(201).json(incident);
};
export const list = async (_req: Request, res: Response) => res.json(await incidents.listIncidents());
export const get = async (req: Request, res: Response) => res.json(await incidents.getIncidentWithResolution(String(req.params.id)));
export const stats = async (_req: Request, res: Response) => res.json(await incidents.getStats());
export const synthetic = (_req: Request, res: Response) => res.json({ notice: 'All data below is SYNTHETIC test data.', scenarios: syntheticScenarios() });
