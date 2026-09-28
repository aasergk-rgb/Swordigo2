import type { RoomDef } from '../types';
import { CH1_ROOMS } from './ch1';
import { PROLOGUE_ROOMS } from './prologue';

export const ROOMS: Record<string, RoomDef> = Object.fromEntries([...PROLOGUE_ROOMS, ...CH1_ROOMS].map((r) => [r.id, r]));

export const START_ROOM = 'village';
