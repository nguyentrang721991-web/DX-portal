export type WorkflowCase = {
  id: string;
  case_code: string;
  current_step: string;
  status: string;
  assessor: string | null;
  reviewer: string | null;
};

export type GateRecord = {
  id: string;
  case_id: string;
  gate_code: string;
  status: string;
  decision: string | null;
};

type SupabaseClientLike = any;

export class WorkflowService {
  constructor(private supabase: SupabaseClientLike) {}

  async confirmGate(
    caseCode: string,
    gateCode: string,
    confirmedBy: string,
    comment?: string
  ) {
    // 1. Đọc case hiện tại
    const { data: assessmentCase, error: caseError } =
      await this.supabase
        .from('assessment_cases')
        .select('*')
        .eq('case_code', caseCode)
        .maybeSingle();

    if (caseError) throw caseError;

    if (!assessmentCase) {
      throw new Error('CASE_NOT_FOUND');
    }

    // MVP hiện chỉ xử lý G1 và G2.
    if (!['G1', 'G2'].includes(gateCode)) {
      throw new Error('UNSUPPORTED_GATE');
    }

    // 2. Kiểm tra đang đúng Gate hay không
    const expectedStep = gateCode === 'G1' ? 'DW1' : 'DW2';

    if (assessmentCase.current_step !== expectedStep) {
      throw new Error('INVALID_WORKFLOW_STEP');
    }

    // 3. Đọc Gate
    const { data: gate, error: gateError } = await this.supabase
      .from('case_gates')
      .select('*')
      .eq('case_id', assessmentCase.id)
      .eq('gate_code', gateCode)
      .maybeSingle();

    if (gateError) throw gateError;

    if (!gate) {
      throw new Error('GATE_NOT_FOUND');
    }

    if (gate.status !== 'PENDING') {
      throw new Error('GATE_NOT_PENDING');
    }

    // 4. Quy tắc G2:
    // Reviewer không được là Assessor
    if (
      gateCode === 'G2' &&
      assessmentCase.reviewer &&
      assessmentCase.assessor &&
      assessmentCase.reviewer === assessmentCase.assessor
    ) {
      throw new Error('REVIEWER_MUST_DIFFER_FROM_ASSESSOR');
    }

    const now = new Date().toISOString();

    // 5. Xác nhận Gate
    const { error: updateGateError } = await this.supabase
      .from('case_gates')
      .update({
        status: 'CONFIRMED',
        decision: 'CONFIRMED',
        confirmed_by: confirmedBy,
        confirmed_at: now,
        comment: comment ?? null,
      })
      .eq('id', gate.id);

    if (updateGateError) throw updateGateError;

    let nextStep: string;
    let nextStatus = 'READY';

    if (gateCode === 'G1') {
      nextStep = 'DW2';

      // Mở G2
      const { error: unlockError } = await this.supabase
        .from('case_gates')
        .update({
          status: 'PENDING',
        })
        .eq('case_id', assessmentCase.id)
        .eq('gate_code', 'G2');

      if (unlockError) throw unlockError;
    } else {
      // MVP dừng tại đây sau G2.
      nextStep = 'G2';
      nextStatus = 'COMPLETED_MVP';
    }

    // 6. WorkflowService là nơi duy nhất chuyển state
    const { error: updateCaseError } = await this.supabase
      .from('assessment_cases')
      .update({
        current_step: nextStep,
        status: nextStatus,
      })
      .eq('id', assessmentCase.id);

    if (updateCaseError) throw updateCaseError;

    // 7. Ghi audit log
    const { error: eventError } = await this.supabase
      .from('case_events')
      .insert({
        case_id: assessmentCase.id,
        event_type: `${gateCode}_CONFIRMED`,
        actor_id: confirmedBy,
        actor_type: 'HUMAN',
        from_state: assessmentCase.current_step,
        to_state: nextStep,
        payload: {
          gate_code: gateCode,
          comment: comment ?? null,
        },
      });

    if (eventError) throw eventError;

    return {
      case_code: caseCode,
      gate_code: gateCode,
      gate_status: 'CONFIRMED',
      previous_step: assessmentCase.current_step,
      current_step: nextStep,
      status: nextStatus,
    };
  }
}
