/**
 * Local type shim for the DSH-hosted @deepseek-ai/dsh-skill-filesystem package.
 * The host injects this module at runtime; it is not installed from npm here.
 * This declaration keeps `tsc` self-contained (no host node_modules needed).
 */
declare module '@deepseek-ai/dsh-skill-filesystem' {
  export interface FilesystemProviderOptions {
    providerName?: string
    includeDefaultRoots?: boolean
    bundledSkillDir?: string
    watch?: boolean
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function apply(ctx: any, opts: FilesystemProviderOptions): void
}
