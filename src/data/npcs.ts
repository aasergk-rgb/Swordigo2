// Every NPC: look, visibility and what happens when you talk to them.
import type { NpcDef } from './types';
import { CH2_NPCS } from './npcs2';
import { minaMeeting } from './quests';

const sheep = (letter: 'A' | 'B' | 'C'): NpcDef => ({
  name: '羊',
  look: 'sheep',
  when: `talkedShepherd&!sheep${letter}`,
  talk: async (g) => {
    await g.say('メェ〜。（羊はリオの顔を見ると、村の方へ走っていった）');
    g.setFlag(`sheep${letter}`);
    g.npc(letter)?.hide();
    const n = ['A', 'B', 'C'].filter((k) => g.flag(`sheep${k}`)).length;
    g.toast(`羊を見つけた（${n}/3）`);
  },
});

const kid = (key: string): NpcDef => ({
  name: '子ども',
  look: 'boy',
  when: `seekStarted&!found_${key}`,
  talk: async (g) => {
    await g.say('み、見つかっちゃった！', '子ども');
    g.setFlag(`found_${key}`);
    const n = ['kidA', 'kidB', 'kidC', 'kidD', 'kidE'].filter((k) => g.flag(`found_${k}`)).length;
    g.toast(`隠れんぼ：${n}/5 人見つけた`);
    g.npc(letterOfKid(key))?.hide();
  },
});

function letterOfKid(key: string): string {
  return { kidA: 'A', kidB: 'C', kidC: 'D', kidD: 'J', kidE: 'N' }[key] ?? '';
}

export const NPCS: Record<string, NpcDef> = {
  // ---------------------------------------------------------------- Haruna village
  elder: {
    name: '長老エルダ',
    look: 'elder',
    talk: async (g) => {
      if (g.flag('boss_noxgiant')) {
        await g.say([{ who: '長老エルダ', text: 'よう帰ったな、リオ。……ガレンも、きっと誇りに思っておる。' }]);
      } else if (g.flag('ch6')) {
        await g.say([{ who: '長老エルダ', text: '王都の東に黒い塔が立っておる。行きなさい、リオ。皆の灯と共に。' }]);
      } else if (g.flag('boss_levia')) {
        await g.say([{ who: '長老エルダ', text: '最後の欠片は竜の炉じゃ。湖底の門の、ひびの入った壁の奥にあるという。' }]);
      } else if (g.flag('boss_tempest')) {
        await g.say([{ who: '長老エルダ', text: '三つ目の欠片は深い水の底……ドルムの暗い扉の先、地底湖の向こうじゃ。' }]);
      } else if (g.flag('boss_golem')) {
        await g.say([{ who: '長老エルダ', text: '欠片をひとつ取り戻したか。次は風の高原の先、天の祠じゃな。ドルムの崖の上から行けるそうな。' }]);
      } else if (g.flag('prologueDone')) {
        await g.say([
          { who: '長老エルダ', text: '柄はお前を選んだ。ガレンの声が導いてくれよう。' },
          { who: '長老エルダ', text: '街道を西へ行けば鉱山町ドルム。坑道「石の心臓」に欠片が眠っているはずじゃ。' },
        ]);
      } else if (g.flag('talkedElder')) {
        await g.say([{ who: '長老エルダ', text: '森の奥へ行きなさい。泉で身を清めてから進むのじゃぞ。' }]);
      } else {
        await g.say([
          { who: '長老エルダ', text: 'リオ、目が覚めたか。顔色が悪いのう。' },
          { who: 'リオ', text: '師匠の灯が消える夢を見たんです。師匠は……？' },
          { who: '長老エルダ', text: 'ガレンは昨夜、ひとりで森へ向かったきり戻らん。' },
          { who: '長老エルダ', text: 'その見習いの剣を持っていきなさい。森には虚（ウロ）が出る。' },
          { who: '長老エルダ', text: '敵を倒せば経験を積み、強くなれる。\n強くなるたびに、体力・攻撃力・魔力のどれを伸ばすか選ぶのじゃ。' },
        ]);
        g.setFlag('talkedElder');
      }
    },
  },
  shepherd: {
    name: '羊飼いの少年',
    look: 'boy',
    talk: async (g) => {
      const n = ['A', 'B', 'C'].filter((k) => g.flag(`sheep${k}`)).length;
      if (g.save.lights.includes('sheep')) {
        await g.say('リオ兄ちゃん、羊たち元気だよ！', '羊飼いの少年');
      } else if (!g.flag('talkedShepherd')) {
        await g.say([
          { who: '羊飼いの少年', text: 'リオ兄ちゃん、大変なんだ！ 羊が3匹、森に逃げちゃった……' },
          { who: '羊飼いの少年', text: '森で見かけたら、話しかけてあげて。きっと自分で帰ってくるから。' },
        ]);
        g.setFlag('talkedShepherd');
      } else if (n < 3) {
        await g.say(`羊はまだ ${3 - n} 匹、森にいるみたい……`, '羊飼いの少年');
      } else {
        await g.say([
          { who: '羊飼いの少年', text: '全部帰ってきた！ ありがとう、リオ兄ちゃん！' },
          { who: '羊飼いの少年', text: 'これ、母さんが作った灯の雫。持っていって！' },
        ]);
        g.giveItem('potion', 3);
        await g.completeQuest('sheep', '羊飼いの少年');
      }
    },
  },
  smith: {
    name: '鍛冶屋',
    look: 'smith',
    talk: async (g) => {
      if (g.save.lights.includes('smith')) {
        await g.say('影の鉄で鍛えた刃だ。虚だろうが何だろうが、スパッといくぜ。', '鍛冶屋');
      } else if (g.flag('item_shadowIron')) {
        await g.say([
          { who: '鍛冶屋', text: 'そいつは……影の鉄！ 虚が落とす、黒い鉱石だ。' },
          { who: '鍛冶屋', text: 'よし、お前の剣に混ぜて鍛え直してやる。……ほらよ！' },
        ]);
        g.setFlag('gave_shadowIron');
        g.save.atk += 1;
        g.toast('攻撃力が 1 上がった！');
        await g.completeQuest('smith', '鍛冶屋');
      } else {
        await g.say([
          { who: '鍛冶屋', text: 'ガレンの弟子か。森に「影の鉄」って黒い鉱石が落ちてたら、持ってきてくれ。' },
          { who: '鍛冶屋', text: '森の奥の、高い岩の上で見たって話だ。' },
        ]);
      }
    },
  },
  merchantVillage: {
    name: '雑貨屋',
    look: 'merchant',
    talk: async (g) => {
      await g.say('いらっしゃい。旅の支度なら任せておくれ。', '雑貨屋');
      await g.openShop('village');
    },
  },
  garenBody: {
    name: 'ガレン',
    look: 'garen',
    lying: true,
    when: '!prologueDone',
    talk: async (g) => {
      await g.say('……師匠の手は、もう冷たい。');
    },
  },
  sheepA: sheep('A'),
  sheepB: sheep('B'),
  sheepC: sheep('C'),

  // ---------------------------------------------------------------- Dorm
  mina: {
    name: 'ミナ',
    look: 'mina',
    // After the forge she is recovering in Haruna (see minaNight).
    when: '!ch5',
    talk: async (g) => {
      const place = { dorm: 1, plateau3: 2, aqualia1: 3, forge1: 4 }[g.roomId] ?? 0;
      if (place) await minaMeeting(g, place);
      if (g.flag('ch4')) {
        await g.say([
          { who: 'ミナ', text: '竜の炉……暑いし、空気がピリピリしてる。' },
          { who: 'ミナ', text: 'ねえリオ。最近、あんたの影が変な動きしてない？ ……ううん、気のせいだよね。' },
        ]);
      } else if (g.flag('boss_levia')) {
        await g.say('灯爆、うまく使えてる？ ひびの入った壁なら吹っ飛ばせるよ。', 'ミナ');
      } else if (g.flag('ch3')) {
        await g.say([
          { who: 'ミナ', text: 'ここが沈んだ都アクアリア……百年前の英雄の都だよ。' },
          { who: 'ミナ', text: '灯の玉を叩くと水の高さが変わる仕掛けがあるみたい。泳げば高い所にも届くかも。' },
        ]);
      } else if (g.flag('boss_tempest')) {
        await g.say('三つ目の欠片は地底湖の先だって？ ドルムの下の段の暗い扉……門の奥の玉を灯弾で撃てば開くかもね。', 'ミナ');
      } else if (g.flag('ch2')) {
        await g.say([
          { who: 'ミナ', text: 'この先が天の祠。昔の人が空に一番近い場所に建てたんだって。' },
          { who: 'ミナ', text: '遠くの灯の玉は、剣じゃ届かない。何か光を飛ばす方法があればね……' },
        ]);
      } else if (g.flag('boss_golem')) {
        await g.say([
          { who: 'ミナ', text: '欠片、取り戻したんだ！ やるじゃん。' },
          { who: 'ミナ', text: '次は崖の上の「風の高原」。その先の「天の祠」に、二つ目があるはず。' },
        ]);
      } else if (g.flag('boss_rockqueen')) {
        await g.say('二段ジャンプ？ ……へえ。それなら崖の上の高原にも行けるね。でもまずは坑道の奥！', 'ミナ');
      } else {
        await g.say([
          { who: 'ミナ', text: '坑道の奥で、でっかい岩の化け物が灯を食べてるって噂。' },
          { who: 'ミナ', text: '鍵のかかった扉があったら、その区域で見つけた小さな鍵で開けられるよ。' },
        ]);
      }
    },
  },
  merchantDorm: {
    name: '鉱山の商人',
    look: 'merchant',
    talk: async (g) => {
      await g.say('へい、らっしゃい！ 坑道に潜るなら装備はケチっちゃいけねえ。', '鉱山の商人');
      await g.openShop('dorm');
    },
  },
  minerWife: {
    name: '鉱夫の妻',
    look: 'villagerF',
    talk: async (g) => {
      if (g.save.lights.includes('miner')) {
        await g.say('あの人、また坑道に行くって言ってるの。……ふふ、懲りないんだから。', '鉱夫の妻');
      } else if (g.flag('foundMiner')) {
        await g.say([
          { who: '鉱夫の妻', text: 'あの人が帰ってきたの！ 本当に、本当にありがとう……！' },
          { who: '鉱夫の妻', text: 'これ、あの人の蛍の小瓶。暗い坑道で役に立つわ。' },
        ]);
        await g.giveEquip('firefly');
        await g.completeQuest('miner', '鉱夫の妻');
      } else {
        await g.say([
          { who: '鉱夫の妻', text: 'うちの人が坑道から戻らないの。みんな心が空っぽになっちゃって、探しにも行ってくれなくて……' },
          { who: '鉱夫の妻', text: '崩れた坑道の奥にいるかもしれない。お願い、見てきてくれない？' },
        ]);
        g.setFlag('askedMiner');
      }
    },
  },
  minerHusband: {
    name: '鉱夫',
    look: 'miner',
    when: '!foundMiner',
    talk: async (g) => {
      await g.say([
        { who: '鉱夫', text: '……う、うう。灯が……吸われて……' },
        { who: 'リオ', text: 'しっかりしてください！ 奥さんが待ってます！' },
        { who: '鉱夫', text: '……女房が？ そうだ、帰らなきゃ……ありがとよ、坊主。' },
      ]);
      g.setFlag('foundMiner');
      g.npc('H')?.hide();
    },
  },
  kidLeader: {
    name: 'ガキ大将',
    look: 'boy',
    talk: async (g) => {
      const n = ['kidA', 'kidB', 'kidC', 'kidD', 'kidE'].filter((k) => g.flag(`found_${k}`)).length;
      if (g.save.lights.includes('kids')) {
        await g.say('次は負けないからな！', 'ガキ大将');
      } else if (!g.flag('seekStarted')) {
        await g.say([
          { who: 'ガキ大将', text: 'なあ兄ちゃん、隠れんぼしようぜ！ 仲間が5人、町のどこかに隠れてる。' },
          { who: 'ガキ大将', text: '崖の上とか、門の向こうとか、とんでもないとこに隠れる奴もいるからな！' },
        ]);
        g.setFlag('seekStarted');
        g.refreshRoom();
      } else if (n < 5) {
        await g.say(`まだ ${5 - n} 人見つかってないぜ！`, 'ガキ大将');
      } else {
        await g.say([{ who: 'ガキ大将', text: '全員見つけたのか！？ ちぇっ、兄ちゃんの勝ちだ。ほら、みんなのお小遣い！' }]);
        g.giveCoins(300);
        await g.completeQuest('kids', 'ドルムの子どもたち');
      }
    },
  },
  kidA: kid('kidA'),
  kidB: kid('kidB'),
  kidC: kid('kidC'),
  kidD: kid('kidD'),
  kidE: kid('kidE'),

  ...CH2_NPCS,
};

