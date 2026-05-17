import { BackdropMountains } from '@/components/BackdropMountains';

// Thin wrapper — der Backdrop bleibt 1:1 wie vorher, nur jetzt im Stage-Layer.
// Wenn wir später eine eigene Variant brauchen (z.B. winterliche Berge),
// hier einen "variant"-Prop einbauen.
export function StageBackdrop() {
  return <BackdropMountains />;
}
