/** Serverfehler der Spiele-RPCs lesbar machen (0206/0209: Sperre gesperrter
 *  bzw. unbestätigter Konten). Unbekannte Fehler bleiben wie sie sind. */
export function spielFehlerText(e: unknown): string {
  const msg = (e as Error)?.message ?? '';
  if (msg.startsWith('gegner_gesperrt')) return 'Dieses Spiel gibt es nicht mehr — das Konto des Gegners ist gesperrt oder noch nicht freigegeben.';
  if (msg.startsWith('konto_gesperrt')) return 'Dein Konto ist gesperrt oder noch nicht freigegeben — Spielen ist gerade nicht möglich.';
  return msg || 'Unbekannter Fehler';
}
