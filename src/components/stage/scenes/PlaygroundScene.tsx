// Wrapper-Scene: rendert die bestehende GapBridge-Playground-Variante
// als optionaler Layer. Mittig rechts unten zwischen Blockhaus und
// Tafel-Rand.

import { GapBridge } from '@/components/GapBridge';

export default function PlaygroundScene() {
  return (
    <div
      className="pointer-events-none fixed bottom-2 overflow-visible"
      style={{ zIndex: 28, right: '12%', width: 360 }}
      aria-hidden="true"
    >
      <GapBridge variant="playground" />
    </div>
  );
}
