import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember } from '@/lib/api';
import { shouldShowAreaHub } from '@/lib/areaHub';
import { AreaHubFooter } from './AreaHubFooter';

// Conditional wrapper: rendert AreaHubFooter nur wenn
//  - User eingeloggt + Member-Daten geladen
//  - Pfad ist KEINE TV/Kiosk/Auth-Route
//
// Mountpunkt in App.tsx (siehe `<BottomNavGate />`-Pattern).
export function AreaHubGate() {
  const { pathname } = useLocation();
  const { ready, user } = useAuth();
  const me = useCurrentMember();

  if (!shouldShowAreaHub(pathname)) return null;
  if (!ready || !user) return null;
  if (!me.data) return null;
  // Pending-Approval-User sehen nichts — sie sehen ohnehin nur die PendingApproval-Page
  if (me.data.approved === false) return null;

  return <AreaHubFooter />;
}
