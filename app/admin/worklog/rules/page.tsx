import { notFound } from "next/navigation";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import RulesPageClient from "./RulesPageClient";

// With WORKLOG_ENABLED off, this route must behave exactly like it doesn't exist —
// not just have its nav link hidden. The client component below assumes the flag
// is on; all real enforcement is still re-checked in the API routes it calls.
export default function WorklogRulesPage() {
  if (!isWorklogEnabled()) notFound();
  return <RulesPageClient />;
}
