// Wrapper-Scene: rendert die bestehende Holzfäller-Komponente als optionaler
// Layer auf der linken Seite. Default off; per Admin oder Theme „Wald lebt"
// aktivierbar.

import { Holzfaeller } from '@/components/Holzfaeller';

export default function HolzfaellerScene() {
  return (
    <div
      className="pointer-events-none fixed bottom-2 overflow-visible"
      style={{ zIndex: 30, left: '2%' }}
      aria-hidden="true"
    >
      <Holzfaeller scale={1.0} />
    </div>
  );
}
