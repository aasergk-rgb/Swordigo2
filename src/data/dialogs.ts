export interface Line {
  who?: string;
  text: string;
}

type Flags = Record<string, boolean>;

export interface NpcDef {
  texture: string;
  lines: (flags: Flags) => Line[];
  /** Flag set after the first conversation. */
  setFlag?: string;
}

export const NPCS: Record<string, NpcDef> = {
  E: {
    texture: 'npc_elder',
    setFlag: 'talkedElder',
    lines: (f) =>
      f.bossWolf
        ? [{ who: '長老エルダ', text: 'よく戻った、リオ。……ガレンのことは、あとで話そう。' }]
        : f.talkedElder
          ? [{ who: '長老エルダ', text: '森の奥へ行きなさい。泉で身を清めてから進むのじゃぞ。' }]
          : [
              { who: '長老エルダ', text: 'リオ、目が覚めたか。顔色が悪いのう。' },
              { who: 'リオ', text: '師匠の灯が消える夢を見たんです。師匠は……？' },
              { who: '長老エルダ', text: 'ガレンは昨夜、ひとりで森へ向かったきり戻らん。' },
              { who: '長老エルダ', text: 'その見習いの剣を持っていきなさい。森には虚（ウロ）が出る。' },
              { who: '長老エルダ', text: '敵を倒せば経験を積み、強くなれる。\n強くなるたびに、体・力・魔のどれを伸ばすか選ぶのじゃ。' },
            ],
  },
  K: {
    texture: 'npc_boy',
    lines: () => [
      { who: '羊飼いの少年', text: 'リオ兄ちゃん、森へ行くの？' },
      { who: '羊飼いの少年', text: '壺とか草を斬ると、たまに灯貨が出てくるんだよ！' },
    ],
  },
};

export const GAREN_SCENE: Line[] = [
  { who: 'リオ', text: '師匠！ ガレン師匠！' },
  { text: '……冷たい。灯が、消えている。' },
  { text: 'そばに、割れた剣の柄と、走り書きのメモが落ちている。' },
  { text: '『虚が目を覚ます。四つの欠片を集めよ。\n──そして、影を見るな』' },
  { who: 'リオ', text: '影……？' },
  { text: '……グルルルル……' },
];

export const BOSS_DEFEATED: Line[] = [
  { text: '影喰い狼は黒い霧になって消えた。' },
  { text: '霧の中から白い光がひとつ、空へ昇っていく。' },
  { who: '？？？', text: '……リオ……聞こえるか……' },
  { who: 'リオ', text: 'この声……師匠!? 柄の中から……？' },
  { who: 'ガレンの声', text: '欠片を……集めろ。そして……影を……' },
  { text: '森の奥で、無数の白い目が光った――。\nリオの意識は、そこで途切れた。' },
];

export const PICKUP_TEXT = {
  heartVessel: '灯の器を手に入れた！ 最大HPが 2 増えた。',
  expBag: '経験値の袋を手に入れた！',
};
