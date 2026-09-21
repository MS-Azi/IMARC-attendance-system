/**
 * A clock in/out time that turns red with the app's existing glow treatment when the
 * device behind it was flagged as MISMATCH — same signal the Device Review queue uses.
 */
export default function DeviceFlagTime({ time, flagged }: { time: string | null; flagged: boolean }) {
  const label = time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  if (!flagged) return <>{label}</>;
  return (
    <span className="text-bad glow" title="Unrecognized device — pending review">
      {label}
    </span>
  );
}
