import type { PaletteDefinition, PaletteRunResult, RunPalettesOptions } from '../core/types.mjs';

export interface ExecOutput {
    exitCode: number;
    stdout: string;
    stderr?: string;
}

export interface ActionsExec {
    exec(command: string, argumentsList?: string[], options?: Record<string, unknown>): Promise<number>;
    getExecOutput(
        command: string,
        argumentsList?: string[],
        options?: Record<string, unknown>,
    ): Promise<ExecOutput>;
}

export interface GithubContext {
    sha: string;
    ref: string;
    repo: {
        owner: string;
        repo: string;
    };
    payload: {
        repository?: {
            default_branch?: string;
        };
    };
}

export interface PullRequestSummary {
    number: number;
}

export interface GithubPullsClient {
    list(parameters: Record<string, unknown>): Promise<{ data: PullRequestSummary[] }>;
    create(parameters: Record<string, unknown>): Promise<unknown>;
    update(parameters: Record<string, unknown>): Promise<unknown>;
}

export interface GithubClient {
    rest: {
        pulls: GithubPullsClient;
    };
}

export type DiscoverPalettes = () => Promise<PaletteDefinition[]>;
export type SynchronizePalettes = (options: RunPalettesOptions) => Promise<PaletteRunResult[]>;

export interface InactiveConfiguredPage {
    paletteId: string;
    pageName: string;
    targetJson: string;
}

export interface RunGithubActionDependencies {
    github: GithubClient;
    context: GithubContext;
    exec: ActionsExec;
    environment?: Record<string, string | undefined>;
    discover?: DiscoverPalettes;
    synchronize?: SynchronizePalettes;
    report?: (message: string) => void;
}
