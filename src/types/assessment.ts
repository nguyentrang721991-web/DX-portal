export interface AssessmentGate {
  id: string;
  gate_code: string;
  status: 'LOCKED' | 'PENDING' | 'CONFIRMED' | 'REJECTED';
  decision: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  comment: string | null;
}

export interface AssessmentCase {
  id: string;
  case_code: string;
  product_id: string;
  scope: string | null;

  current_step: string;
  status: string;

  assessor: string | null;
  reviewer: string | null;

  calculated_go: string | null;
  approved_go: string | null;

  criteria_version: string;
  gate_logic_version: string;
  workflow_version: string;
  assessment_version: number;

  gates: AssessmentGate[];

  created_at: string;
  updated_at: string;
}
