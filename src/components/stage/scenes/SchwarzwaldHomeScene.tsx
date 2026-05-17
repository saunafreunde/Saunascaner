// Optional-Layer: bringt die alte Basis zurück (Berge + Blockhaus + Gliders).
// Default off. Im Admin per Toggle aktivierbar oder als Bestandteil des
// Themes „Wald lebt".

import { BackdropMountains } from '@/components/BackdropMountains';
import { BlockhausScene } from '@/components/BlockhausScene';
import { CuckooDoor } from '@/components/CuckooDoor';
import { Gliders } from '@/components/Gliders';

export default function SchwarzwaldHomeScene() {
  return (
    <>
      <BackdropMountains />
      <Gliders />
      <div
        className="pointer-events-none fixed bottom-2 left-1/2 -translate-x-1/2"
        style={{ zIndex: 10 }}
        aria-hidden="true"
      >
        <BlockhausScene>
          <CuckooDoor scale={0.72} />
        </BlockhausScene>
      </div>
    </>
  );
}
