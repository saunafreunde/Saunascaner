// Inline-Sterne hinter dem Mitgliedernamen für anwesende Familienangehörige.
// 1 Stern pro Person (Partner + jedes anwesende Kind).
// Max 1 + 8 = 9 Sterne; bei >= 4 zeigen wir „⭐ ×N" kompakt.

export function FamilyStars({ withPartner, childrenCount }: { withPartner: boolean; childrenCount: number }) {
  const total = (withPartner ? 1 : 0) + Math.max(0, childrenCount);
  if (total === 0) return null;
  const ariaLabel = `+${total} Familienangehörig${total === 1 ? 'er' : 'e'}`;

  if (total >= 4) {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-300/90" title={ariaLabel} aria-label={ariaLabel}>
        ⭐ ×{total}
      </span>
    );
  }
  return (
    <span className="ml-1.5 inline-flex text-amber-300/90 leading-none" title={ariaLabel} aria-label={ariaLabel}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="-ml-0.5 first:ml-0">⭐</span>
      ))}
    </span>
  );
}
