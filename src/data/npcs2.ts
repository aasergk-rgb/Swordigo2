// NPCs for chapters 2-6.
import type { GameApi, NpcDef } from './types';

const lever = (n: number, letter: string): NpcDef => ({
  name: 'レバー',
  look: 'lever',
  alt: { when: `lever${n}`, look: 'leverOn' },
  talk: async (g) => {
    if (g.flag(`lever${n}`)) {
      await g.say('風車のレバーは、もう倒してある。');
      return;
    }
    g.setFlag(`lever${n}`);
    g.npc(letter)?.setLook('leverOn');
    g.shake(200, 0.004);
    const done = [1, 2, 3].filter((k) => g.flag(`lever${k}`)).length;
    await g.say(`ガコン！ どこかで風車が回り始めた。（${done}/3）`);
  },
});

const bell = (n: number): NpcDef => ({
  name: '鐘',
  look: 'bell',
  talk: async (g) => {
    g.setFlag(`bell${n}`);
    g.flash(0xfff3a0, 120);
    const done = [1, 2, 3].filter((k) => g.flag(`bell${k}`)).length;
    await g.say(`カーン……澄んだ音が祠に響きわたる。（鐘の音 ${done}/3）`);
  },
});

async function countTablets(g: GameApi): Promise<number> {
  return [1, 2, 3, 4].filter((k) => g.flag(`item_tablet${k}`)).length;
}

export const CH2_NPCS: Record<string, NpcDef> = {
  // ---------------------------------------------------------------- chapter 2
  windmillKeeper: {
    name: '風車守りの老人',
    look: 'villager',
    talk: async (g) => {
      const n = [1, 2, 3].filter((k) => g.flag(`lever${k}`)).length;
      if (g.save.lights.includes('windmill')) {
        await g.say('風車が回れば、麓の村にも粉が届く。ありがとうよ。', '風車守りの老人');
      } else if (n >= 3) {
        await g.say([
          { who: '風車守りの老人', text: 'おお……三つとも回っとる！ 高原に風が戻ったわい。' },
          { who: '風車守りの老人', text: 'わしの若い頃の羽根飾りじゃ。つければ、ゆっくり落ちられる。' },
        ]);
        await g.giveEquip('feather');
        await g.completeQuest('windmill', '風車守りの老人');
      } else {
        await g.say([
          { who: '風車守りの老人', text: '虚が出てから、風車がみんな止まってしもうた。' },
          { who: '風車守りの老人', text: '高原のあちこちにあるレバーを倒せば、また回るはずなんじゃが……（あと ' + (3 - n) + ' つ）' },
        ]);
      }
    },
  },
  lever1: lever(1, 'A'),
  lever2: lever(2, 'C'),
  lever3: lever(3, 'A'),
  kaiPlateau: {
    name: 'カイ',
    look: 'kai',
    when: '!kaiMet',
    talk: async (g) => {
      await g.say('……邪魔だ。どけ。', 'カイ');
    },
  },
  bard: {
    name: '旅の吟遊詩人',
    look: 'scholar',
    talk: async (g) => {
      const n = [1, 2, 3].filter((k) => g.flag(`bell${k}`)).length;
      if (g.save.lights.includes('bard')) {
        await g.say('♪ 灯を手渡す少年の歌、いまも作っているところさ。', '旅の吟遊詩人');
      } else if (n >= 3) {
        await g.say([
          { who: '旅の吟遊詩人', text: '聞こえたよ、祠の三つの鐘！ これで新しい歌が書ける。' },
          { who: '旅の吟遊詩人', text: 'お礼に、旅の途中で拾った星の粉をあげよう。' },
        ]);
        g.giveItem('ether', 2);
        await g.completeQuest('bard', '旅の吟遊詩人');
      } else {
        await g.say([
          { who: '旅の吟遊詩人', text: '天の祠には、三つの鐘があるらしい。' },
          { who: '旅の吟遊詩人', text: 'その音を聞いてみたいんだが、わたしの足では祠に登れなくてね。鳴らしてきてくれないか？' },
        ]);
      }
    },
  },
  bell1: bell(1),
  bell2: bell(2),
  bell3: bell(3),

  // ---------------------------------------------------------------- chapter 3
  scholar: {
    name: '学者',
    look: 'scholar',
    talk: async (g) => {
      const n = await countTablets(g);
      if (g.save.lights.includes('scholar')) {
        await g.say('英雄は王を倒さなかった……封じたのだ。歴史書を書き直さねばならん。', '学者');
      } else if (n >= 4) {
        await g.say([
          { who: '学者', text: '石版が四枚そろった！ ……読めるぞ。' },
          { who: '学者', text: '「英雄は虚の王ノクスを斬れず、剣の灯で封じた。封印は百年ののち、必ずゆるむ」……' },
          { who: '学者', text: '君のおかげで真実に近づけた。これは礼だ。' },
        ]);
        g.setFlag('gave_tablets');
        g.giveItem('bigPotion', 2);
        await g.completeQuest('scholar', '学者');
      } else {
        await g.say([
          { who: '学者', text: 'アクアリアの壁画を研究している。だが肝心の石版が、都のあちこちに散らばっていてね。' },
          { who: '学者', text: `四枚そろえば、英雄の本当の物語が読めるはずなんだ。（${n}/4）` },
        ]);
      }
    },
  },
  ghostGirl: {
    name: '幽霊の少女',
    look: 'ghostGirl',
    talk: async (g) => {
      if (g.save.lights.includes('ghost')) {
        await g.say('♪……ありがとう、お兄ちゃん。もう寂しくないよ。', '幽霊の少女');
      } else if (g.flag('item_musicBox')) {
        await g.say([
          { who: '幽霊の少女', text: 'わたしのオルゴール……！ ずっと、ずっと探してたの。' },
          { who: '幽霊の少女', text: '♪…………これで、お母さんのところへ行ける。このお月さまの輪、あげるね。' },
        ]);
        g.setFlag('gave_musicBox');
        await g.giveEquip('fullMoon');
        await g.completeQuest('ghost', '幽霊の少女');
      } else {
        await g.say([
          { who: '幽霊の少女', text: 'お兄ちゃん、わたしが見えるの？' },
          { who: '幽霊の少女', text: '都が沈んだ日に、オルゴールをなくしちゃったの。光の格子の向こうの、どこか……' },
        ]);
      }
    },
  },
  merchantAqualia: {
    name: '沈んだ都の商人',
    look: 'merchant',
    talk: async (g) => {
      await g.say('おや、生きたお客さんとは珍しい。水の底でも商売は続くのさ。', '沈んだ都の商人');
      await g.openShop('aqualia');
    },
  },

  // ---------------------------------------------------------------- chapter 4
  oldSmith: {
    name: '老いた鍛冶師',
    look: 'smith',
    talk: async (g) => {
      if (g.save.lights.includes('oldSmith')) {
        await g.say('竜の鱗の鎧、似合っとるぞ。', '老いた鍛冶師');
      } else if (g.flag('item_scale')) {
        await g.say([
          { who: '老いた鍛冶師', text: 'それは竜の鱗！ よく拾ってきた……！' },
          { who: '老いた鍛冶師', text: '久しぶりに腕が鳴るわい。……ほれ、鱗の鎧じゃ。' },
        ]);
        g.setFlag('gave_scale');
        await g.giveEquip('scaleMail');
        await g.completeQuest('oldSmith', '老いた鍛冶師');
      } else {
        await g.say([
          { who: '老いた鍛冶師', text: 'わしはこの炉で百の剣を打ってきた。……だが、ルミナブレードだけは別じゃ。' },
          { who: '老いた鍛冶師', text: 'あれは人の灯で打つ剣。わしの腕だけでは直せん。' },
          { who: '老いた鍛冶師', text: '炉の奥で竜の鱗を拾ったら持ってきてくれ。いい鎧にしてやる。' },
        ]);
      }
    },
  },
  merchantForge: {
    name: '炉の商人',
    look: 'merchant',
    talk: async (g) => {
      await g.say('熱いだろう？ 竜皮の外套があれば、溶岩の上も歩けるぜ。', '炉の商人');
      await g.openShop('forge');
    },
  },
  fireSpirit: {
    name: '迷子の火の精',
    look: 'fireSpirit',
    when: '!spiritFollow',
    talk: async (g) => {
      await g.say([
        { who: '迷子の火の精', text: 'ぐすっ……お家がわかんなくなっちゃった……' },
        { who: 'リオ', text: '炉の入口に、君みたいな火の精がいたよ。一緒に行こう。' },
      ]);
      g.setFlag('spiritFollow');
      g.npc('E')?.hide();
      g.toast('迷子の火の精がついてきた');
    },
  },
  fireFamily: {
    name: '火の精の母',
    look: 'fireSpirit',
    talk: async (g) => {
      if (g.save.lights.includes('spirit')) {
        await g.say('あの子、あなたの話ばかりしているのよ。', '火の精の母');
      } else if (g.flag('spiritFollow')) {
        await g.say([
          { who: '火の精の母', text: 'ああ、わたしの子！ どこへ行ってたの！' },
          { who: '火の精の母', text: '本当にありがとう。わたしたちの火の力を、少し分けてあげる。' },
        ]);
        g.save.mpMax += 4;
        g.save.mp = g.save.mpMax;
        g.toast('最大 MP が 4 増えた');
        await g.completeQuest('spirit', '火の精の親子');
      } else {
        await g.say('子どもが炉の奥へ迷い込んでしまったの……見かけたら、連れて帰ってくれない？', '火の精の母');
      }
    },
  },

  // ---------------------------------------------------------------- chapters 5-6
  kaiCapital: {
    name: 'カイ',
    look: 'kai',
    talk: async (g) => {
      await g.say([
        { who: 'カイ', text: '塔の門は俺が押さえる。……行け、リオ。' },
        { who: 'カイ', text: '今度は、お前の影じゃなく、お前自身を信じてる。' },
      ]);
    },
  },
  frozen: {
    name: '灯を吸われた人',
    look: 'villager',
    talk: async (g) => {
      await g.say('…………（体は温かいのに、目に光がない。灯を吸われている）');
    },
  },
  frozenF: {
    name: '灯を吸われた人',
    look: 'villagerF',
    talk: async (g) => {
      await g.say('…………（かすかに唇が動いた。「たすけて」）');
    },
  },
  guard: {
    name: '王都の兵士',
    look: 'guard',
    talk: async (g) => {
      await g.say([
        { who: '王都の兵士', text: '君が……柄の少年か。塔が現れてから、王都の灯がどんどん吸われている。' },
        { who: '王都の兵士', text: '我々はここで虚を食い止める。塔は通りの東の果てだ！' },
      ]);
    },
  },
  elderNight: {
    name: '長老エルダ',
    look: 'elder',
    talk: async (g) => {
      await g.say('皆の灯を受け取ったなら、泉の前へ。……ガレンが待っておる。', '長老エルダ');
    },
  },
  villagerNight: {
    name: '村人',
    look: 'villager',
    talk: async (g) => {
      await g.say('リオ、無事でよかった。……おれたちの灯も、持っていってくれ。', '村人');
    },
  },
  minaNight: {
    name: 'ミナ',
    look: 'mina',
    talk: async (g) => {
      await g.say([
        { who: 'ミナ', text: '……あんたのせいじゃないよ、リオ。' },
        { who: 'ミナ', text: '怪我なんて、地図を描いてれば毎日のこと。だから、そんな顔しないで。' },
      ]);
    },
  },
};
