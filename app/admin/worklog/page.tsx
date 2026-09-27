import { notFound } from "next/navigation";
import { isWorklogEnabled } from "@/lib/worklog/flags";
import ReviewBoardClient from "./ReviewBoardClient";

export default function WorklogReviewPage() {
  if (!isWorklogEnabled()) notFound();
  return <ReviewBoardClient />;
}
