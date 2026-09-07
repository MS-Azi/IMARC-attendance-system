/**
 * Thin bracket marks at the four corners of a container — like crop marks on a
 * technical drawing. The parent element must be `position: relative`.
 * Purely decorative; carries no interaction or state.
 */
export default function CornerBrackets() {
  return (
    <>
      <span aria-hidden="true" className="bracket bracket-tl" />
      <span aria-hidden="true" className="bracket bracket-tr" />
      <span aria-hidden="true" className="bracket bracket-bl" />
      <span aria-hidden="true" className="bracket bracket-br" />
    </>
  );
}
