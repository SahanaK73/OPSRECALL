import { Schema, model } from 'mongoose';

const resolutionSchema = new Schema(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, unique: true },
    actualRootCause: { type: String, required: true, maxlength: 3000 },
    resolutionApplied: { type: String, required: true, maxlength: 3000 },
    verificationResults: { type: String, required: true, maxlength: 3000 },
    serviceRecovered: { type: Boolean, required: true },
    engineerName: { type: String, default: '', maxlength: 100 },
    engineerConfirmed: { type: Boolean, required: true },
    // Hindsight retention state
    retained: { type: Boolean, default: false },
    hindsightDocumentId: { type: String },
    retainedAt: { type: Date },
    retainError: { type: String },
  },
  { timestamps: true },
);

export const Resolution = model('Resolution', resolutionSchema);
