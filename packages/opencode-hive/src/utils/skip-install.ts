/**
 * Shared guard for auto-installers (tools, LSP servers, RTK).
 *
 * Auto-install is skipped when:
 * - `HIVE_DISABLE_AUTO_INSTALL` is set to '1' or 'true', or
 * - `HOME` contains 'hive-e2e' (E2E test sandbox environments).
 */
export function shouldSkipAutoInstall(): boolean {
  return (
    process.env.HIVE_DISABLE_AUTO_INSTALL === '1' ||
    process.env.HIVE_DISABLE_AUTO_INSTALL === 'true' ||
    (process.env.HOME !== undefined && process.env.HOME.includes('hive-e2e'))
  );
}
