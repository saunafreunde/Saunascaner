import { addMinutes, setHours, setMinutes, addDays } from 'date-fns';
import type { Sauna, Infusion } from '@/types/database';
import type { InfusionAttribute } from '@/lib/attributes';

const today = (h: number) => setMinutes(setHours(new Date(), h), 0).toISOString();
const tomorrow = (h: number) =>
  addDays(setMinutes(setHours(new Date(), h), 0), 1).toISOString();

export const mockSaunas: Sauna[] = [
  { id: 's80',  name: 'Kelo',             temperature_label: '80°C',  accent_color: '#fbbf24', sort_order: 1, is_active: true,  created_at: '', updated_at: '' },
  { id: 's90',  name: 'Finnische Sauna',  temperature_label: '90°C',  accent_color: '#34d399', sort_order: 2, is_active: false, created_at: '', updated_at: '' },
  { id: 's100', name: 'Blockhaus',        temperature_label: '100°C', accent_color: '#ef4444', sort_order: 3, is_active: true,  created_at: '', updated_at: '' },
];

const inf = (
  id: string,
  sauna_id: string,
  saunameister_id: string,
  title: string,
  description: string,
  attributes: InfusionAttribute[],
  start: string,
  duration = 15
): Infusion => ({
  id, sauna_id, template_id: null, saunameister_id,
  title, description, attributes, image_path: null,
  start_time: start, duration_minutes: duration,
  end_time: addMinutes(new Date(start), duration).toISOString(),
  created_at: '',
});

export const mockInfusions: Infusion[] = [
  inf('i1', 's80',  'm1', 'Eukalyptus klassisch', 'Klärend & frisch',         ['nature', 'music'],            today(15)),
  inf('i2', 's80',  'm2', 'Honig-Lavendel',       'Sanft beruhigend',         ['nature', 'no_music'],         today(16)),
  inf('i3', 's80',  'm1', 'Birke',                'Waldfrisch',               ['nature'],                     today(18)),
  inf('i4', 's100', 'm3', 'Feuer & Eis',          'Mit Fruchteis-Abkühlung',  ['flame', 'sud', 'loud_music'], today(15), 20),
  inf('i5', 's100', 'm2', 'Schwarzwald-Tanne',    'Erdig & würzig',           ['nature', 'flame', 'music'],   today(17)),
  inf('i6', 's100', 'm3', 'Power-Aufguss',        'Saunameister-Show',        ['flame', 'sud', 'loud_music'], today(19), 25),
  inf('i7', 's80',  'm1', 'Frühaufguss',          'Sanfter Start',            ['nature', 'no_music'],         tomorrow(10)),
  inf('i8', 's90',  'm2', 'Bio-Kräuter',          'Schonend warm',            ['nature', 'music'],            tomorrow(11)),
];
