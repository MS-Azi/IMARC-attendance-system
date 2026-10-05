/** For a remote clock-in/out: a Google Maps link when GPS was captured, or a plain
 * note when it wasn't (staff is still allowed to clock in without it). */
export default function LocationLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return <span className="font-mono text-[11px] text-muted">Location not shared</span>;
  }
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[11px] text-accent hover:underline"
    >
      View location
    </a>
  );
}
