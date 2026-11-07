export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type Status = 'open' | 'analyzed' | 'resolved';

export interface RecalledMemory {
  ref: string;
  incidentId?: string;
  title?: string;
  serviceName?: string;
  severity?: string;
  confirmedRootCause?: string;
  resolutionApplied?: string;
  verificationResults?: string;
  serviceRecovered?: boolean;
  verifiedRecord: boolean;
  retrievedFacts: string[];
  hindsightRank: number;
  sharedService: boolean | null;
  sharedTerms: string[];
  llm?: { relevance: 'high' | 'medium' | 'low' | 'none'; similarities: string[]; differences: string[]; influence: string };
}

export interface AnalysisResult {
  summary: string;
  possibleCauses: { cause: string; confidence: 'low' | 'medium' | 'high'; evidence: string[]; basedOn: string }[];
  historicalComparisons: { memoryRef: string; relevance: 'high' | 'medium' | 'low' | 'none'; similarities: string[]; differences: string[]; influence: string }[];
  recommendedChecks: string[];
  alternativeExplanations: string[];
  missingInformation: string[];
  insufficientEvidence: boolean;
  requiresEngineerReview: boolean;
  memoryInfluenced: boolean;
}

export interface Analysis {
  _id: string;
  createdAt: string;
  memoryRequested: boolean;
  memoryUsed: boolean;
  memoryError?: string;
  model?: string;
  recalledMemories: RecalledMemory[];
  result: AnalysisResult;
}

export interface Resolution {
  _id: string;
  actualRootCause: string;
  resolutionApplied: string;
  verificationResults: string;
  serviceRecovered: boolean;
  engineerName?: string;
  retained: boolean;
  retainedAt?: string;
  retainError?: string;
}

export interface Incident {
  _id: string;
  title: string;
  serviceName: string;
  severity: Severity;
  environment: string;
  errorMessage: string;
  logDetails: string;
  symptoms: string;
  recentDeployment: string;
  occurredAt: string;
  status: Status;
  isSynthetic: boolean;
  createdAt: string;
  analyses: Analysis[];
  activity: { type: string; message: string; at: string }[];
  resolution?: Resolution | null;
}

export interface Stats {
  total: number;
  open: number;
  critical: number;
  resolved: number;
  memoryAssisted: number;
  severity: Record<Severity, number>;
  recentActivity: { incidentId: string; title: string; type: string; message: string; at: string }[];
}

export interface Scenario {
  key: string;
  label: string;
  incident: Omit<Incident, '_id' | 'status' | 'createdAt' | 'analyses' | 'activity' | 'resolution'>;
  resolution?: { actualRootCause: string; resolutionApplied: string; verificationResults: string; serviceRecovered: boolean; engineerName: string };
}

export interface MemoryResponse {
  bankId: string;
  retainedIncidents: {
    incidentId: string; title?: string; serviceName?: string; severity?: string; isSynthetic?: boolean; symptoms?: string; errorMessage?: string;
    confirmedRootCause: string; resolutionApplied: string; verificationResults: string; serviceRecovered: boolean;
    retained: boolean; retainedAt?: string; retainError?: string; hindsightDocumentId?: string;
    recalledBy: { incidentId: string; title: string; relevance?: string }[];
  }[];
  hindsight: { total: number; items: { id: string; text: string; fact_type?: string; context?: string; document_id?: string }[] } | null;
  hindsightError?: string;
}
