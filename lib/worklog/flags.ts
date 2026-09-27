/** Server-only gate. Every worklog API route must check this — the client-side
 * NEXT_PUBLIC_WORKLOG_ENABLED only controls UI visibility, never enforcement. */
export function isWorklogEnabled(): boolean {
  return process.env.WORKLOG_ENABLED === "true";
}
