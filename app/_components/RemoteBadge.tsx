export default function RemoteBadge({ workMode }: { workMode: "OFFICE" | "REMOTE" }) {
  if (workMode !== "REMOTE") return null;
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent border border-accent/40 rounded px-1.5 py-0.5 ml-2 align-middle">
      Remote
    </span>
  );
}
