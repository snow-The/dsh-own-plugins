/** Ingest an experience trace into raw/ (immutable). */
export declare function ingestExperience(title: string, content: string, meta?: Record<string, unknown>): string;
/** Consolidate a raw trace into a wiki pattern (Wiki Maintainer). */
export declare function consolidatePattern(name: string, title: string, diagnosis: string, workaround: string): string;
/** Append to the evolution log (logs.md). */
export declare function logEvolution(round: string, action: string, detail: string): void;
/** Propose a skill update: write a candidate SKILL.md into skills/ (Skill Proposer). */
export declare function proposeSkill(name: string, description: string, body: string, fromPatterns?: string[]): string;
/** Gate: accept a candidate skill (move to active) or reject (remove). */
export declare function gateSkill(name: string, accept: boolean, score?: number): string;
/** Status of the skill wiki. */
export declare function wikiStatus(): {
    raw: number;
    patterns: number;
    skills: number;
    active: number;
    logs: string[];
};
/** Pull ACP compaction summaries from ~/.dsh/graph/graph.db as experience source. */
export declare function ingestFromAcp(limit?: number): string[];
