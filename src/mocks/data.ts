import { addMinutes, setHours, setMinutes, addDays } from 'date-fns';
import type { Sauna, Infusion } from '@/types/database';

const today = (h: number, m = 0) => setMinutes(setHours(new Date(), h), m).toISOString();
const tomorrow = (h: number, m = 0) =>
  addDays(setMinutes(setHours(new Date(), h), m), 1).toISOString();

export const mockSaunas: Sauna[] = [
  { id: 's80',  name: 'Finnische Sauna', temperature_label: '80°C',  sort_order: 1, is_active: true,  created_at: '', updated_at: '' },
  { id: 's90',  name: 'Bio-Sauna',       temperature_label: '90°C',  sort_order: 2, is_active: false, created_at: '', updated_at: '' },
  { id: 's100', name: 'Event-Sauna',     temperature_label: '100°C', sort_order: 3, is_active: true,  created_at: '', updated_at: '' },
];

const inf = (
  id: string,
  sauna_id: string,
  title: string,
  description: string,
  start: string,
  duration = 15
): Infusion => ({
  id, sauna_id, template_id: null, saunameister_id: null,
  title, description, image_path: null,
  start_time: start, duration_minutes: duration,
  end_time: addMinutes(new Date(start), duration).toISOString(),
  created_at: '',
});

export const mockInfusions: Infusion[] = [
  inf('i1', 's80',  'Eukalyptus klassisch', 'Klärend & frisch',          today(15)),
  inf('i2', 's80',  'Honig-Lavendel',       'Sanft beruhigend',          today(16, 30)),
  inf('i3', 's80',  'Birke',                'Waldfrisch',                today(18)),
  inf('i4', 's100', 'Feuer & Eis',          'Mit Fruchteis-Abkühlung',   today(15, 30), 20),
  inf('i5', 's100', 'Schwarzwald-Tanne',    'Erdig & würzig',            today(17)),
  inf('i6', 's100', 'Power-Aufguss',        'Saunameister-Show',         today(19), 25),
  inf('i7', 's80',  'Frühaufguss',          'Sanfter Start',             tomorrow(10)),
  inf('i8', 's90',  'Bio-Kräuter',          'Schonend warm',             tomorrow(11)),
];
