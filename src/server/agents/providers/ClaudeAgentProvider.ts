import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentProvider,
  AgentRunRequest,
  AgentRunResult,
} from '../AgentProvider.ts';

export class ClaudeAgentProvider implements AgentProvider {
  readonly name = 'claude' as const;

  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY_NOT_CONFIGURED');
    }

    this.client = new Anthropic({ apiKey });
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  }

  async healthCheck() {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16,
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly: CONNECTED',
          },
        ],
      });

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return {
        provider: this.name,
        status: 'connected' as const,
        model: this.model,
        message: text || 'CONNECTED',
      };
    } catch (error) {
      return {
        provider: this.name,
        status: 'unavailable' as const,
        model: this.model,
        message:
          error instanceof Error
            ? error.message
            : 'Claude provider is unavailable.',
      };
    }
  }

  async runAgent<TOutput = unknown>(
    request: AgentRunRequest
  ): Promise<AgentRunResult<TOutput>> {
    const startedAt = new Date().toISOString();

    try {
      const skillContext = request.skills?.length
        ? `\n\nSkills to apply:\n${request.skills.join('\n')}`
        : '';

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: `${request.instructions}${skillContext}`,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              caseCode: request.caseCode,
              agentCode: request.agentCode,
              input: request.input,
              metadata: request.metadata ?? {},
            }),
          },
        ],
      });

      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      let output: unknown = text;

      try {
        output = JSON.parse(text);
      } catch {
        // Provider contract allows text output during early integration.
      }

      return {
        provider: this.name,
        agentCode: request.agentCode,
        caseCode: request.caseCode,
        status: 'completed',
        output: output as TOutput,
        model: this.model,
        startedAt,
        completedAt: new Date().toISOString(),
        error: null,
      };
    } catch (error) {
      return {
        provider: this.name,
        agentCode: request.agentCode,
        caseCode: request.caseCode,
        status: 'failed',
        output: null,
        model: this.model,
        startedAt,
        completedAt: new Date().toISOString(),
        error: {
          code: 'CLAUDE_RUN_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Claude agent execution failed.',
        },
      };
    }
  }
}
