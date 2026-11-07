import { Incident } from '../models/Incident';
import { Resolution } from '../models/Resolution';
import { AppError, notFound } from '../utils/AppError';
import { logger } from '../utils/logger';
import { ResolveInput } from '../utils/schemas';
import { retainResolution } from './hindsight.service';

async function retainFor(incidentId: string) {
  const incident = await Incident.findById(incidentId);
  const resolution = await Resolution.findOne({ incidentId });
  if (!incident || !resolution) throw notFound('Incident or resolution');
  if (!resolution.engineerConfirmed) throw new AppError(400, 'Only engineer-confirmed resolutions can be remembered', 'NOT_CONFIRMED');
  try {
    const { documentId } = await retainResolution({
      incidentId: String(incident._id),
      serviceName: incident.serviceName,
      environment: incident.environment,
      severity: incident.severity,
      title: incident.title,
      errorMessage: incident.errorMessage,
      symptoms: incident.symptoms ?? '',
      recentDeployment: incident.recentDeployment ?? '',
      actualRootCause: resolution.actualRootCause,
      resolutionApplied: resolution.resolutionApplied,
      verificationResults: resolution.verificationResults,
      serviceRecovered: resolution.serviceRecovered,
      isSynthetic: !!incident.isSynthetic,
    });
    resolution.retained = true;
    resolution.hindsightDocumentId = documentId;
    resolution.retainedAt = new Date();
    resolution.retainError = undefined;
    incident.activity.push({ type: 'retained', message: 'Resolution retained in Hindsight memory', at: new Date() } as never);
  } catch (e) {
    resolution.retained = false;
    resolution.retainError = (e as Error).message;
    incident.activity.push({ type: 'retain_failed', message: `Could not retain in Hindsight: ${(e as Error).message}`, at: new Date() } as never);
    logger.warn(`Retain failed for ${incidentId}: ${(e as Error).message}`);
  }
  await resolution.save();
  await incident.save();
  return resolution;
}

/** Save the engineer-confirmed resolution, then retain it in Hindsight. */
export async function confirmResolution(incidentId: string, input: ResolveInput) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw notFound('Incident');
  if (incident.status === 'resolved') throw new AppError(409, 'This incident already has a confirmed resolution.', 'ALREADY_RESOLVED');

  const resolution = await Resolution.create({ ...input, engineerConfirmed: true, incidentId });
  incident.resolutionId = resolution._id;
  incident.status = 'resolved';
  incident.activity.push({ type: 'resolved', message: `Engineer confirmed root cause: ${input.actualRootCause.slice(0, 120)}`, at: new Date() } as never);
  await incident.save();
  return retainFor(incidentId); // resolution is safe in MongoDB even if Hindsight fails
}

export const retryRetain = retainFor;
