import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildBackupZip } from "@/lib/backup";
import { writeAuditLog } from "@/lib/audit";
import { withTimeout } from "@/lib/worklog/timeout";

/** On-demand full data backup — read-only against every existing table. The only
 * write is an AuditLog row recording who downloaded a backup and when. */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const dateStr = new Date().toISOString().slice(0, 10);
  try {
    const zip = await withTimeout(buildBackupZip(), 30000, "backup");
    await writeAuditLog({
      actorType: "ADMIN",
      actorId: session.sub,
      action: "data_backup.download",
      entityType: "Backup",
      entityId: dateStr,
    });
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="imarc-backup-${dateStr}.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Backup failed." }, { status: 500 });
  }
}
