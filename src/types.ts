export type SearchStage = "started" | "no-luck" | "while";

export type ApplicationStatus =
  | "Applied"
  | "Screening"
  | "Interview"
  | "Offer"
  | "Rejected";

export type CvMode = "paste" | "skip" | "starter";
export type JobMode = "role" | "paste";
export type SearchBlocker = "silence" | "ats" | "tailoring" | "confidence";
export type OutputGoal = "cv" | "bundle" | "interview";

export interface Analysis {
  score: number;
  matchedKeywords: string[];
  keywordGaps: string[];
  topIssues: string[];
  allIssues: string[];
  formattingIssues: string[];
  sectionNotes: string[];
  improvementSteps: string[];
  strengths: string[];
  createdAt: string;
}

export interface SessionData {
  id: string;
  email: string;
  targetRole: string;
  searchStage: SearchStage;
  blocker: SearchBlocker;
  cvMode: CvMode;
  jobMode: JobMode;
  outputGoal: OutputGoal;
  cvText: string;
  jobText: string;
  analysis: Analysis;
  optimizedCv: string;
  coverLetter: string;
  linkedInKit: LinkedInKit;
  interviewPrep: InterviewPrep;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedInKit {
  headlines: string[];
  about: string;
  keywordBank: string[];
}

export interface StarWorksheet {
  question: string;
  situationPrompt: string;
  taskPrompt: string;
  actionPrompt: string;
  resultPrompt: string;
}

export interface InterviewPrep {
  questions: string[];
  worksheets: StarWorksheet[];
}

export interface ApplicationRecord {
  id: string;
  company: string;
  role: string;
  link: string;
  status: ApplicationStatus;
  appliedAt: string;
  notes: string;
  nextFollowupAt: string;
  createdAt: string;
}
