import { notFound } from "next/navigation";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import FullRulesClient from "./FullRulesClient";

export default function WorklogFullRulesPage() {
  if (!isWorklogEnabled()) notFound();
  return <FullRulesClient />;
}
