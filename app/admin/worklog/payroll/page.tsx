import { notFound } from "next/navigation";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import PayrollClient from "./PayrollClient";

export default function WorklogPayrollPage() {
  if (!isWorklogEnabled()) notFound();
  return <PayrollClient />;
}
