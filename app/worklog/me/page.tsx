import { notFound } from "next/navigation";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import MyRecordClient from "./MyRecordClient";

export default function MyRecordPage() {
  if (!isWorklogEnabled()) notFound();
  return <MyRecordClient />;
}
