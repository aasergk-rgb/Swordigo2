import type { RoomDef } from '../types';
import { CH1_ROOMS } from './ch1';
import { CH2_ROOMS } from './ch2';
import { CH3_ROOMS } from './ch3';
import { CH4_ROOMS } from './ch4';
import { CH56_ROOMS } from './ch56';
import { PROLOGUE_ROOMS } from './prologue';

export const ROOMS: Record<string, RoomDef> = Object.fromEntries([...PROLOGUE_ROOMS, ...CH1_ROOMS, ...CH2_ROOMS, ...CH3_ROOMS, ...CH4_ROOMS, ...CH56_ROOMS].map((r) => [r.id, r]));

export const START_ROOM = 'village';
