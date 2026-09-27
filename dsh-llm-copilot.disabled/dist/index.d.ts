import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, StreamChunk, LlmProviderInfo, LlmModelInfo, LlmResolvedModelInfo, ResolvedRetryPolicy } from '@deepseek-ai/dsh-llm';
export declare const name = "dsh-llm-copilot";
export declare const description = "DSH LLM provider adapter for GitHub Copilot (OpenAI-compatible chat/completions, Bearer = `gh auth token`). Student plan models: gpt-4o / gpt-4o-mini / gpt-4.1 / gpt-3.5-turbo.";
export declare const inject: string[];
export declare const PROVIDER = "copilot";
export declare const NS = "llm-copilot";
/** Copilot provider configuration (plugin settings + adapter options). */
export interface CopilotConfig {
    /** API base, default https://api.githubcopilot.com */
    baseURL?: string;
    /** Static token override; when absent the adapter shells out to `gh auth token` (TTL-cached). */
    apiKey?: string;
    /** Model catalog advertised to the host (default: the four student-plan models). */
    models?: readonly string[];
    /** Context window advertised for gpt-4o (default 128000). */
    contextWindow?: number;
    /** Default max output tokens (default 4096). */
    maxTokens?: number;
}
export declare class CopilotAdapter extends LlmAdapter {
    private readonly baseURL;
    private readonly contextWindow;
    private readonly maxTokens;
    private readonly models;
    private readonly resolveApiKey;
    constructor(config: CopilotConfig, resolveApiKey: () => Promise<string>);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy | undefined;
    listModels(): Promise<readonly LlmModelInfo[]>;
    resolveModel(_provider: string, model: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
export declare function apply(ctx: {
    llm?: {
        registerAdapter?(providers: string[], adapter: unknown): () => void;
        registerConfigurableProviders?(entries: {
            provider: string;
            displayName: string;
            settingsNs: string;
            settingsPath: string[];
        }[]): void;
    };
    on?(event: string, listener: () => void): void;
    logger?: {
        warn?(msg: string): void;
    };
}, config?: CopilotConfig): void;
