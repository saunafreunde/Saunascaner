// Zentraler Helper für den anzuzeigenden Aufgießer-Namen.
//
// Jedes Mitglied hat zwei Namen:
//   - members.name        → echter Klarname (z.B. "Christoph Wolfert")
//   - members.sauna_name  → künstlerischer "Aufguss-Name" (z.B. "Der Feuermeister")
//
// In allen Aufguss-Kontexten (Tafel, Planner, Bewerten, Mitarbeiter, Gast,
// Mini-Timeline, Pending-Ratings) soll der Aufguss-Name angezeigt werden,
// wenn gesetzt — sonst Fallback auf echten Namen. Bei Safety-kritischen
// Stellen (Evakuierungs-Banner) bleibt absichtlich der echte Name stehen.
//
// Genau dieselbe Logik wie list_meister_names() in Migration 0006:
//   COALESCE(sauna_name, name)

type MemberWithNames = {
  name?: string | null;
  sauna_name?: string | null;
};

type MemberWithId = MemberWithNames & { id: string };

/** Aufgießer-Anzeigename: sauna_name wenn nicht-leer, sonst echter Klarname. */
export function displayMemberName(
  m: MemberWithNames | null | undefined,
  fallback: string = '—',
): string {
  if (!m) return fallback;
  const sn = m.sauna_name?.trim();
  if (sn) return sn;
  return m.name?.trim() || fallback;
}

/** Sucht im Member-Array per ID und liefert den Aufguss-Namen. */
export function lookupMemberName(
  members: ReadonlyArray<MemberWithId> | undefined,
  id: string | null,
  fallback: string = '—',
): string {
  if (!id) return fallback;
  const m = members?.find((x) => x.id === id);
  return displayMemberName(m, fallback);
}
