import crypto from 'crypto';
import { Incident } from '../models/Incident';
import { Resolution } from '../models/Resolution';
import { AppError, notFound } from '../utils/AppError';
import { CreateIncidentInput } from '../utils/schemas';

export const makeFingerprint = (i: Pick<CreateIncidentInput, 'serviceName' | 'title' | 'errorMessage' | 'occurredAt'>) =>
  crypto
    .createHash('sha256')
    .update([i.serviceName, i.title, i.errorMessage, new Date(i.occurredAt).toISOString()].map((s) => s.trim().toLowerCase()).join('|'))
    .digest('hex');

export async function createIncident(input: CreateIncidentInput) {
  const fingerprint = makeFingerprint(input);
  const existing = await Incident.findOne({ fingerprint }).select('_id');
  if (existing) {
    throw new AppError(409, 'This incident was already submitted (same service, title, error and timestamp).', 'DUPLICATE_INCIDENT', { existingId: existing._id });
  }
  return Incident.create({
    ...input,
    fingerprint,
    activity: [{ type: 'submitted', message: `Incident submitted: ${input.title}` }],
  });
}

export const listIncidents = () => Incident.find().sort({ createdAt: -1 }).select('-analyses.recalledMemories').lean();

export async function getIncidentWithResolution(id: string) {
  const incident = await Incident.findById(id).lean();
  if (!incident) throw notFound('Incident');
  const resolution = incident.resolutionId ? await Resolution.findById(incident.resolutionId).lean() : null;
  return { ...incident, resolution };
}

export async function getStats() {
  const [byStatus, bySeverity, total, critical, memoryAssisted, recent] = await Promise.all([
    Incident.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Incident.aggregate([{ $group: { _id: '$severity', n: { $sum: 1 } } }]),
    Incident.countDocuments(),
    Incident.countDocuments({ severity: 'Critical' }),
    // memory-assisted = at least one analysis where memories were actually supplied to the LLM
    Incident.countDocuments({ 'analyses.memoryUsed': true }),
    Incident.aggregate([
      { $unwind: '$activity' },
      { $sort: { 'activity.at': -1 } },
      { $limit: 12 },
      { $project: { incidentId: '$_id', title: 1, type: '$activity.type', message: '$activity.message', at: '$activity.at', _id: 0 } },
    ]),
  ]);
  const st = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
  const sev = Object.fromEntries(bySeverity.map((s) => [s._id, s.n]));
  return {
    total,
    open: (st.open ?? 0) + (st.analyzed ?? 0),
    critical,
    resolved: st.resolved ?? 0,
    memoryAssisted,
    severity: { Critical: sev.Critical ?? 0, High: sev.High ?? 0, Medium: sev.Medium ?? 0, Low: sev.Low ?? 0 },
    recentActivity: recent,
  };
}
