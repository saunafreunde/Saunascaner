import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addMinutes } from 'date-fns';
import type { Sauna, Infusion } from '@/types/database';
import type { InfusionAttribute } from '@/lib/attributes';
import { mockSaunas, mockInfusions } from './data';

export type Saunameister = { id: string; name: string; pin: string };
export type Member = { id: string; name: string; is_present: boolean };
export type Evacuation = { active: boolean; triggeredBy: string | null; triggeredAt: number | null };

export type MeisterTemplate = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  attributes: InfusionAttribute[];
};

const mockMeisters: Saunameister[] = [
  { id: 'm1', name: 'Anja Becker',  pin: '1111' },
  { id: 'm2', name: 'Tobias Vogt',  pin: '2222' },
  { id: 'm3', name: 'Markus Stein', pin: '3333' },
];

const mockMembers: Member[] = [
  { id: 'p1', name: 'Anja Becker',  is_present: true  },
  { id: 'p2', name: 'Tobias Vogt',  is_present: true  },
  { id: 'p3', name: 'Markus Stein', is_present: false },
  { id: 'p4', name: 'Lara Hofer',   is_present: true  },
  { id: 'p5', name: 'Felix Renz',   is_present: true  },
  { id: 'p6', name: 'Sonja Klein',  is_present: false },
];

const seedTemplates: Record<string, MeisterTemplate[]> = {
  m1: [
    { id: 't-m1-1', title: 'Eukalyptus klassisch', description: 'Klärend & frisch',  duration_minutes: 15, attributes: ['nature', 'music'] },
    { id: 't-m1-2', title: 'Birke',                description: 'Waldfrisch',         duration_minutes: 15, attributes: ['nature'] },
  ],
  m2: [
    { id: 't-m2-1', title: 'Honig-Lavendel',     description: 'Sanft beruhigend',  duration_minutes: 15, attributes: ['nature', 'no_music'] },
    { id: 't-m2-2', title: 'Schwarzwald-Tanne',  description: 'Erdig & würzig',    duration_minutes: 15, attributes: ['nature', 'flame', 'music'] },
  ],
  m3: [
    { id: 't-m3-1', title: 'Feuer & Eis',     description: 'Mit Fruchteis-Abkühlung', duration_minutes: 20, attributes: ['flame', 'sud', 'loud_music'] },
    { id: 't-m3-2', title: 'Power-Aufguss',   description: 'Saunameister-Show',        duration_minutes: 25, attributes: ['flame', 'sud', 'loud_music'] },
  ],
};

type State = {
  saunas: Sauna[];
  infusions: Infusion[];
  meisters: Saunameister[];
  templatesByMeister: Record<string, MeisterTemplate[]>;
  currentMeisterId: string | null;
  members: Member[];
  evacuation: Evacuation;
  toggleSauna: (id: string) => void;
  addInfusion: (i: Omit<Infusion, 'id' | 'end_time' | 'created_at'>) => void;
  removeInfusion: (id: string) => void;
  loginMeister: (id: string, pin: string) => boolean;
  logoutMeister: () => void;
  addTemplate: (meisterId: string, t: Omit<MeisterTemplate, 'id'>) => void;
  removeTemplate: (meisterId: string, templateId: string) => void;
  setEvacuation: (e: Evacuation) => void;
};

export const useMockStore = create<State>()(
  persist(
    (set) => ({
      saunas: mockSaunas,
      infusions: mockInfusions,
      meisters: mockMeisters,
      templatesByMeister: seedTemplates,
      currentMeisterId: null,
      members: mockMembers,
      evacuation: { active: false, triggeredBy: null, triggeredAt: null },
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
      loginMeister: (id, pin) => {
        const m = mockMeisters.find((x) => x.id === id);
        if (!m || m.pin !== pin) return false;
        set({ currentMeisterId: id });
        return true;
      },
      logoutMeister: () => set({ currentMeisterId: null }),
      addTemplate: (meisterId, t) =>
        set((s) => ({
          templatesByMeister: {
            ...s.templatesByMeister,
            [meisterId]: [...(s.templatesByMeister[meisterId] ?? []), { ...t, id: crypto.randomUUID() }],
          },
        })),
      removeTemplate: (meisterId, templateId) =>
        set((s) => ({
          templatesByMeister: {
            ...s.templatesByMeister,
            [meisterId]: (s.templatesByMeister[meisterId] ?? []).filter((t) => t.id !== templateId),
          },
        })),
      setEvacuation: (e) => set({ evacuation: e }),
    }),
    { name: 'saunafreunde-mock-v4' }
  )
);
