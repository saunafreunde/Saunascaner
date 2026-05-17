// Wrapper-Scene: rendert die bestehende Reh-Komponente als optionaler
// Layer auf der rechten Seite.

import { Reh } from '@/components/Reh';

export default function RehScene() {
  return (
    <div
      className="pointer-events-none fixed bottom-2 overflow-visible"
      style={{ zIndex: 30, right: '2%' }}
      aria-hidden="true"
    >
      <Reh scale={1.0} />
    </div>
  );
}
