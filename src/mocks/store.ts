import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addMinutes } from 'date-fns';
import type { Sauna, Infusion } from '@/types/database';
import { mockSaunas, mockInfusions } from './data';

export type Saunameister = { id: string; name: string };

const mockMeisters: Saunameister[] = [
  { id: 'm1', name: 'Anja Becker' },
  { id: 'm2', name: 'Tobias Vogt' },
  { id: 'm3', name: 'Markus Stein' },
];

type State = {
  saunas: Sauna[];
  infusions: Infusion[];
  meisters: Saunameister[];
  currentMeisterId: string | null;
  toggleSauna: (id: string) => void;
  addInfusion: (i: Omit<Infusion, 'id' | 'end_time' | 'created_at'>) => void;
  removeInfusion: (id: string) => void;
  setMeister: (id: string | null) => void;
};

export const useMockStore = create<State>()(
  persist(
    (set) => ({
      saunas: mockSaunas,
      infusions: mockInfusions,
      meisters: mockMeisters,
      currentMeisterId: null,
      toggleSauna: (id) =>
        set((s) => ({
          saunas: s.saunas.map((x) => (x.id === id ? { ...x, is_active: !x.is_active } : x)),
        })),
      addInfusion: (i) =>
        set((s) => ({
          infusions: [
            ...s.infusions,
            {
              ...i,
              id: crypto.randomUUID(),
              end_time: addMinutes(new Date(i.start_time), i.duration_minutes).toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        })),
      removeInfusion: (id) =>
        set((s) => ({ infusions: s.infusions.filter((x) => x.id !== id) })),
      setMeister: (id) => set({ currentMeisterId: id }),
    }),
    { name: 'saunafreunde-mock-v1' }
  )
);
