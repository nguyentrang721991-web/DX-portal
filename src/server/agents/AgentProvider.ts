export type AgentProviderName = 'claude' | 'microsoft';

export type AgentRunStatus = 'completed' | 'failed';

export interface AgentRunRequest {
  caseCode: string;
  agentCode: string;
  instructions: string;
  input: Record<string, unknown>;
  skills?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentRunResult<TOutput = unknown> {
  provider: AgentProviderName;
  agentCode: string;
  caseCode: string;
  status: AgentRunStatus;
  output: TOutput | null;
  model?: string;
  startedAt: string;
  completedAt: string;
  error?: {
    code: string;
    message: string;
  } | null;
}

export interface AgentProvider {
  readonly name: AgentProviderName;

  healthCheck(): Promise<{
    provider: AgentProviderName;
    status: 'connected' | 'unavailable';
    model?: string;
    message?: string;
  }>;

  runAgent<TOutput = unknown>(
    request: AgentRunRequest
  ): Promise<AgentRunResult<TOutput>>;
}
