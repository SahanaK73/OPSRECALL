import { Schema, model, InferSchemaType, Types } from 'mongoose';

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export const STATUSES = ['open', 'analyzed', 'resolved'] as const;

const activitySchema = new Schema(
  { type: { type: String, required: true }, message: { type: String, required: true }, at: { type: Date, default: Date.now } },
  { _id: false },
);

// One entry per time the engineer asked for an analysis.
const analysisSchema = new Schema(
  {
    createdAt: { type: Date, default: Date.now },
    memoryRequested: { type: Boolean, required: true }, // user asked for memory
    memoryUsed: { type: Boolean, required: true }, // memories were ACTUALLY supplied to the LLM
    memoryError: { type: String }, // Hindsight failure message, if any
    model: { type: String },
    recalledMemories: { type: [Schema.Types.Mixed], default: [] }, // provenance records
    result: { type: Schema.Types.Mixed, required: true }, // validated LLM output
  },
  { _id: true },
);

const incidentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    serviceName: { type: String, required: true, trim: true, maxlength: 100 },
    severity: { type: String, enum: SEVERITIES, required: true },
    environment: { type: String, required: true, trim: true, maxlength: 50 },
    errorMessage: { type: String, required: true, maxlength: 5000 },
    logDetails: { type: String, default: '', maxlength: 20000 },
    symptoms: { type: String, default: '', maxlength: 5000 },
    recentDeployment: { type: String, default: '', maxlength: 3000 },
    occurredAt: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'open', index: true },
    isSynthetic: { type: Boolean, default: false },
    fingerprint: { type: String, index: true },
    analyses: { type: [analysisSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
    resolutionId: { type: Schema.Types.ObjectId, ref: 'Resolution' },
  },
  { timestamps: true },
);

export type IncidentDoc = InferSchemaType<typeof incidentSchema> & { _id: Types.ObjectId };
export const Incident = model('Incident', incidentSchema);
