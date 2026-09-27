import { notFound } from "next/navigation";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import ChangeLogClient from "./ChangeLogClient";

export default function WorklogChangeLogPage() {
  if (!isWorklogEnabled()) notFound();
  return <ChangeLogClient />;
}
