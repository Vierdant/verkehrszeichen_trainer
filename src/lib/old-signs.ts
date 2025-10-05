// Minimal dataset of German traffic signs for the quiz
// Images are simple placeholder SVGs in `src/lib/assets/signs/`

export type TrafficSign = {
    id: string;
    title: string; // canonical German name
    aliases: string[]; // acceptable alternative answers for hard mode
    src: string; // imported SVG path
};

import s101 from '$lib/assets/signs/101_gefahrstelle.svg';
import s205 from '$lib/assets/signs/205_vorfahrt_gewaehren.svg';
import s206 from '$lib/assets/signs/206_halt_vorfahrt_gewaehren.svg';
import s250 from '$lib/assets/signs/250_verbot_fuer_fahrzeuge.svg';
import s306 from '$lib/assets/signs/306_vorfahrtstrasse.svg';
import s3301 from '$lib/assets/signs/3301_autobahn.svg';

export const SIGNS: TrafficSign[] = [
    {
        id: '101',
        title: 'Gefahrstelle',
        aliases: ['Achtung', 'Gefahr', 'Achtung Gefahrstelle'],
        src: s101
    },
    {
        id: '205',
        title: 'Vorfahrt gewähren',
        aliases: ['Vorfahrtsregelung', 'Yield', 'Vorfahrt gewaehren'],
        src: s205
    },
    {
        id: '206',
        title: 'Halt! Vorfahrt gewähren',
        aliases: ['Stop', 'Stoppschild', 'Stopp'],
        src: s206
    },
    {
        id: '250',
        title: 'Verbot für Fahrzeuge aller Art',
        aliases: ['Durchfahrt verboten', 'Verbot fuer Fahrzeuge'],
        src: s250
    },
    {
        id: '306',
        title: 'Vorfahrtstraße',
        aliases: ['Vorfahrtstrasse'],
        src: s306
    },
    {
        id: '330.1',
        title: 'Autobahn',
        aliases: ['Autobahnzufahrt', 'Autobahn beginnt'],
        src: s3301
    }
];

export function normalizeAnswer(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9äöüß\s\.]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}


