// Fassung der Datenschutzhinweise (/datenschutz, Overlay am Eingangs-Tablet).
//
// Bei JEDER inhaltlichen Änderung von src/components/DatenschutzInhalt.tsx
// beide Werte setzen: DATENSCHUTZ_STAND auf das Datum der Änderung,
// DATENSCHUTZ_FASSUNG auf „JJJJ-MM-TT“ — gab es am selben Tag schon eine
// ausgelieferte Fassung, mit Zähler: „JJJJ-MM-TT.2“, „.3“ … (N = 1–99, ohne
// führende Null). Eine Kennung darf nie für zwei verschiedene Texte stehen.
// Die App schickt DATENSCHUTZ_FASSUNG bei jeder Registrierung mit; die
// Datenbank speichert sie in members.datenschutz_fassung — so lässt sich
// später nachweisen, welchen Text jemand bestätigt hat (Text selbst:
// Git-Verlauf). Dasselbe Format prüfen der Trigger _members_datenschutz_fassung
// (0186/0205), api/qr-signin.ts und api/email.ts; ein neues Format dort ZUERST
// zulassen, sonst speichert die Datenbank still NULL.
//
// Bisherige Kennungen:
//   '2026-09-25'   Text aus b905733 (live ab 25.09.2026 04:24 UTC). Ab 07:55 UTC
//                  stand unter derselben Kennung der Text aus bd4bf58 (auch
//                  noch auf Geräten mit altem Bundle nach dem Deploy von
//                  '.2') — über den Zeitpunkt der Registrierung zuordnen:
//                  auth.users.created_at, NICHT members.created_at (die
//                  Mitgliedszeile entsteht bei Mail-Bestätigung erst mit dem
//                  Klick auf den Link, 0189).
//   '2026-09-25.2' Audit-Runde 3: Telegram-Vereinsmeldungen (Abzeichen,
//                  Aufguss-Name, Übernahmen, Auslöser des Alarms),
//                  Anwesenheits-PC, gekoppelte Geräte, Rechtsgrundlage der
//                  Vereinsmeldungen.
//   '2026-09-25.3' Audit-Runde 4 (0208): Vereinspostfach (was die App
//                  speichert, wer es sieht, ALL-INKL als Postfach-Anbieter,
//                  Frist 24 Monate), Anmeldung beim Telegram-Bot (Daten,
//                  Rechtsgrundlage, Fristen 60 Tage / 12 Monate).
//   '2026-09-25.4' Abschlussrunde (0210): Vereinspostfach speichert bei
//                  Antworten aus der App auch die Empfängeradressen (An/Cc).
export const DATENSCHUTZ_FASSUNG = '2026-09-25.4';
export const DATENSCHUTZ_STAND = '25. September 2026';
