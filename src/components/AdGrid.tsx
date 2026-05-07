import { motion } from 'framer-motion';

export function AdGrid({ images }: { images: string[] }) {
  const slots = Array.from({ length: 4 }, (_, i) => images[i] ?? null);
  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.6, ease: [0.25, 1, 0.5, 1] } }}
      className="grid h-full grid-cols-2 grid-rows-2 gap-4"
    >
      {slots.map((src, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 flex items-center justify-center backdrop-blur"
        >
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-forest-300/40 text-sm">Werbeplatz {i + 1}</span>
          )}
        </div>
      ))}
    </motion.div>
  );
}
