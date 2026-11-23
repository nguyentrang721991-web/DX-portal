import type { AssessmentCase } from '../types/assessment';

export async function getAssessmentCase(
  caseCode: string
): Promise<AssessmentCase> {
  const response = await fetch(
    `/api/assessment-cases/${encodeURIComponent(caseCode)}`
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.error ||
        `Không thể tải hồ sơ đánh giá (${response.status}).`
    );
  }

  return body as AssessmentCase;
}

export async function confirmAssessmentGate(
  caseCode: string,
  gateCode: string,
  confirmedBy: string,
  comment?: string
): Promise<{
  case_code: string;
  gate_code: string;
  gate_status: string;
  previous_step: string;
  current_step: string;
  status: string;
}> {
  const response = await fetch(
    `/api/assessment-cases/${encodeURIComponent(
      caseCode
    )}/gates/${encodeURIComponent(gateCode)}/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmedBy,
        comment,
      }),
    }
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.error ||
        `Không thể xác nhận ${gateCode} (${response.status}).`
    );
  }

  return body;
}
