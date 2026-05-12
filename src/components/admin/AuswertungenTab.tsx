import { useState } from 'react';
import { AufgieserStatsSection } from './stats/AufgieserStatsSection';
import { AktivitaetStatsSection } from './stats/AktivitaetStatsSection';
import { AromenStatsSection } from './stats/AromenStatsSection';
import { MitgliederStatsSection } from './stats/MitgliederStatsSection';
import { BewertungenStatsSection } from './stats/BewertungenStatsSection';
import { SocialStatsSection } from './stats/SocialStatsSection';

type Section = 'aufgieser' | 'aktivitaet' | 'aromen' | 'mitglieder' | 'bewertungen' | 'social';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'aufgieser',   label: 'Aufgießer',    icon: '🌟' },
  { id: 'aktivitaet',  label: 'Aktivität',    icon: '📅' },
  { id: 'aromen',      label: 'Aromen',       icon: '🌿' },
  { id: 'mitglieder',  label: 'Mitglieder',   icon: '👥' },
  { id: 'bewertungen', label: 'Bewertungen',  icon: '⭐' },
  { id: 'social',      label: 'Social',       icon: '📸' },
];

export function AuswertungenTab() {
  const [section, setSection] = useState<Section>('aufgieser');

  return (
    <div className="space-y-4">
      {/* Sub-Tab-Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition ring-1 ${
              section === s.id
                ? 'bg-amber-500/20 text-amber-100 ring-amber-500/40'
                : 'bg-forest-900/40 text-forest-300 ring-forest-800/40 hover:bg-forest-900'
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section-Render */}
      {section === 'aufgieser'   && <AufgieserStatsSection />}
      {section === 'aktivitaet'  && <AktivitaetStatsSection />}
      {section === 'aromen'      && <AromenStatsSection />}
      {section === 'mitglieder'  && <MitgliederStatsSection />}
      {section === 'bewertungen' && <BewertungenStatsSection />}
      {section === 'social'      && <SocialStatsSection />}
    </div>
  );
}
