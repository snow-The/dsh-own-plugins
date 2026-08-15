/**
 * dsh-skill-pack — curated engineering skills for DeepSeek Harness.
 *
 * Cross-platform by construction: pure text skills (SKILL.md) mounted via
 * the host's filesystem provider; no platform-specific code, no runtime
 * dependencies beyond the DSH-hosted @deepseek-ai/dsh-skill-filesystem.
 *
 * Skills are curated from the mattpocock/skills ecosystem (engineering
 * workflows: handoff, grilling, teach, specs/tickets, writing) plus a
 * self-authored design-md skill (google-labs DESIGN.md format).
 */
import { fileURLToPath } from 'node:url';
import { apply as applyFilesystemProvider } from '@deepseek-ai/dsh-skill-filesystem';
const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url));
export const name = 'skill-pack';
export const inject = ['skills'];
// The host ctx shape is not exported by the filesystem provider package;
// this adapter only forwards it unchanged, so an explicit any is fine.
export function apply(ctx) {
    applyFilesystemProvider(ctx, {
        providerName: 'skill-pack',
        includeDefaultRoots: false,
        bundledSkillDir: skillsRoot,
        watch: false,
    });
}
