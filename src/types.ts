export type Qualification = 
  | 'grundkurs' | 'vertiefung' | 'saunameister' 
  | 'banja' | 'raeuchern' | 'menthol' | 'kraeuter' | 'peeling';

export interface FeedbackQuestion {
  id: string;
  text: string;
  type: 'yes_no' | 'event';
}

export interface MemberProfile {
  code: string;
  memberNumber: string;
  memberName: string;
  memberStatus: string;
  present: boolean;
  visits30: number;
  visits365: number;
  visitsTotal: number;
  warning: string;
  autoCheckoutInfo: boolean;
  isAdmin: boolean;
  qualifications: Qualification[];
  feedbackQuestions: FeedbackQuestion[];
  isNew?: boolean;
  isFamily?: boolean;
  checkoutMessage?: string;
  needsFamilyCount?: boolean;
}

export interface ScannerConfig {
  apiUrl: string;
  apiToken: string;
  deviceName: string;
  codePattern: string;
  dedupeMs: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoHideEnabled: boolean;
  adminCode: string;
  feedbackQuestions?: FeedbackQuestion[];
}

export interface LogEntry {
  id: string;
  code: string;
  message: string;
  kind: 'success' | 'warn' | 'error';
  time: string;
  isoTime: string;
}

export type ScanStatus = 'idle' | 'scanning' | 'sending' | 'success' | 'warning' | 'error';
