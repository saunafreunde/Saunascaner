import { BlockhausScene } from '@/components/BlockhausScene';
import { CuckooDoor } from '@/components/CuckooDoor';

// Herzstück der Bühne: Blockhaus + Kuckuckstür mittig.
// Bleibt immer sichtbar — alle Saisonen und Themes stapeln sich nur drumherum.
// Die Sauna ist die Identität der Tafel.
export function StageCore() {
  return (
    <div className="relative mx-auto w-full max-w-[1920px] px-8 flex items-end justify-center">
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <BlockhausScene>
          <CuckooDoor scale={0.72} />
        </BlockhausScene>
      </div>
    </div>
  );
}
