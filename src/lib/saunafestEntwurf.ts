import { saunafestAm, type SaunafestTag } from '@/lib/api';
import type { Infusion } from '@/types/database';

/** true, wenn der Aufguss an einem Saunafest liegt, dessen Plan noch Entwurf ist
 *  (plan_bestaetigt_at leer). Solche Einteilungen sieht erst nach „Plan bestätigen“
 *  jemand außer dem Admin (Vorgabe 5, Migration 0163) — auch nicht auf dem
 *  Aufgießer-Profil oder in der Favoriten-Liste der Gäste. */
export function istFestEntwurf(i: Pick<Infusion, 'start_time'>, tage: SaunafestTag[] | undefined): boolean {
  const fest = saunafestAm(new Date(i.start_time), tage);
  return !!fest && !fest.plan_bestaetigt_at;
}
