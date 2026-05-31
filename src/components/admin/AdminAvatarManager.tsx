// Admin-Komponente für Avatar-Upload + Lock-Toggle pro Mitglied.
// Migration 0111: admin_set_member_avatar + admin_set_avatar_lock.
//
// Verwendung im MembersTab pro Listen-Zeile:
//   <AdminAvatarManager member={m} />
//
// UI:
//   [Avatar 40x40] [📷 Bild] [🔓/🔒 Lock]
// Klick auf "Bild" → File-Picker → Upload zu storage 'assets/avatars/'
//   → admin_set_member_avatar RPC mit neuem Pfad
// Klick auf Schloss → admin_set_avatar_lock(toggle)

import { useRef, useState } from 'react';
import {
  uploadAsset,
  useAdminSetMemberAvatar,
  useAdminSetAvatarLock,
  type Member,
} from '@/lib/api';
import { Avatar } from '@/components/Avatar';

interface Props {
  member: Member;
}

export function AdminAvatarManager({ member }: Props) {
  const setAvatar = useAdminSetMemberAvatar();
  const setLock = useAdminSetAvatarLock();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const path = await uploadAsset(file, 'avatars');
      await setAvatar.mutateAsync({ memberId: member.id, avatarPath: path });
    } catch (e) {
      setErr((e as Error).message);
      window.alert(`Upload fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      // Input zurücksetzen damit gleiche Datei nochmal hochladbar wäre
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!window.confirm(`Profilbild von "${member.name}" entfernen?`)) return;
    try {
      await setAvatar.mutateAsync({ memberId: member.id, avatarPath: null });
    } catch (e) {
      window.alert(`Entfernen fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  async function handleLockToggle() {
    const next = !member.avatar_locked;
    try {
      await setLock.mutateAsync({ memberId: member.id, locked: next });
    } catch (e) {
      window.alert(`Lock-Wechsel fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Avatar mit Lock-Badge */}
      <div className="relative flex-shrink-0">
        <Avatar
          name={member.sauna_name || member.name}
          avatarPath={member.avatar_path}
          size="sm"
        />
        {member.avatar_locked && (
          <div
            aria-label="Avatar gesperrt"
            title="Vom Admin gesperrt — nur Admin kann ändern"
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-[10px] grid place-items-center text-forest-950 ring-1 ring-forest-950"
          >
            🔒
          </div>
        )}
      </div>

      {/* Upload-Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title={member.avatar_locked
          ? 'Bild ändern (überschreibt das gesperrte Bild)'
          : 'Bild hochladen'}
        className="rounded-md bg-forest-900/80 px-1.5 py-1 text-[11px] font-medium text-forest-200 ring-1 ring-forest-700/40 hover:bg-forest-800 disabled:opacity-40 transition"
      >
        {uploading ? '⏳' : '📷'}
      </button>

      {/* Remove-Button (nur wenn eigenes Bild da ist) */}
      {member.avatar_path && (
        <button
          type="button"
          onClick={handleRemove}
          title="Eigenes Bild entfernen (zurück auf Default-Avatar)"
          className="rounded-md bg-forest-900/80 px-1.5 py-1 text-[11px] font-medium text-rose-300 ring-1 ring-forest-700/40 hover:bg-rose-950/60 transition"
        >
          ✕
        </button>
      )}

      {/* Lock-Toggle */}
      <button
        type="button"
        onClick={handleLockToggle}
        disabled={setLock.isPending}
        title={member.avatar_locked
          ? 'Sperre aufheben (Mitglied kann Bild dann selbst ändern)'
          : 'Sperren — danach kann nur Admin das Bild ändern'}
        className={`rounded-md px-1.5 py-1 text-[11px] font-medium ring-1 transition ${
          member.avatar_locked
            ? 'bg-amber-500/15 text-amber-300 ring-amber-500/40 hover:bg-amber-500/25'
            : 'bg-forest-900/80 text-forest-300 ring-forest-700/40 hover:bg-forest-800'
        }`}
      >
        {member.avatar_locked ? '🔒' : '🔓'}
      </button>

      {err && <span className="text-[10px] text-rose-300/80">{err}</span>}
    </div>
  );
}
