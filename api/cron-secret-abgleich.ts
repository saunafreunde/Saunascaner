// api/cron-secret-abgleich.ts — VORÜBERGEHEND (24.09.2026, Migrationen 0168/0169).
//
// Überträgt den Wert der Vercel-Env CRON_SECRET einmalig in den Supabase-Vault
// (Eintrag 'cron_secret'), aus dem die pg_cron-Jobs ihn bei jedem Lauf lesen.
// So steht das Geheimnis nie im Klartext in einem Befehl, einer Migration oder
// einer Ausgabe.
//
// Sicherheit: nimmt KEINE Eingaben entgegen und gibt den Wert nie zurück. Ein
// fremder Aufruf kann nur bewirken, dass derselbe Wert aus der Env erneut
// geprüft wird ('unveraendert'). Die RPC darf nur service_role ausführen.
// Wird nach dem Abgleich wieder gelöscht; 0169 entfernt die RPC.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret = process.env.CRON_SECRET ?? '';
  if (secret.length < 32) return res.status(500).json({ error: 'CRON_SECRET fehlt oder ist zu kurz' });

  const sb = serviceClient();
  if (!sb) return res.status(500).json({ error: 'env missing' });

  const { data, error } = await sb.rpc('cron_secret_hinterlegen', { p_secret: secret });
  if (error) {
    console.error('[cron-secret-abgleich] RPC fehlgeschlagen', error.code ?? '');
    return res.status(500).json({ error: 'rpc failed', code: error.code ?? null });
  }
  return res.status(200).json({ ok: true, status: data });
}
