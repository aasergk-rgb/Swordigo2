// Quest helpers shared by NPC scripts.
import type { GameApi } from './types';

/** Mina's quest: meet her in four places. */
export async function minaMeeting(g: GameApi, n: number): Promise<void> {
  const flag = `minaMet${n}`;
  if (g.flag(flag)) return;
  g.setFlag(flag);
  const met = [1, 2, 3, 4].filter((k) => g.flag(`minaMet${k}`)).length;
  if (met >= 4) {
    await g.say([
      { who: 'ミナ', text: '……ねえ、リオ。ずっと言おうと思ってたんだけど。' },
      { who: 'ミナ', text: '地図って、誰かが歩いた跡なんだよ。あんたの歩いた跡、ちゃんと全部描いておいたから。' },
    ]);
    await g.completeQuest('mina', 'ミナ');
  }
}
