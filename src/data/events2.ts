// Story scripts for chapters 2-6.
import type { GameApi } from './types';

type Ev = (g: GameApi) => Promise<void>;

export const CH2_EVENTS: Record<string, Ev> = {
  // ---------------------------------------------------------------- chapter 2
  kaiMeet: async (g) => {
    if (g.flag('kaiMet')) return;
    await g.say([
      { who: '？？？', text: '止まれ。……この先は、虚の群れの巣だ。' },
      { who: 'カイ', text: '俺はカイ。虚を狩る「影狩り」だ。……その柄、ガレンの剣か。' },
      { who: 'リオ', text: '師匠を知ってるの？' },
      { who: 'カイ', text: '噂だけだ。……来るぞ。死にたくなければ剣を抜け。' },
    ]);
    const x = g.playerX();
    for (const dx of [-110, 90, 140]) g.summon('w', Math.max(2, Math.round((x + dx) / 16)), 14);
    await g.waitNoEnemies();
    await g.say([
      { who: 'カイ', text: '……悪くない腕だ。' },
      { who: 'カイ', text: 'だが覚えておけ。虚はな、人の心の空っぽなところに入り込む。' },
      { who: 'カイ', text: '俺の家族も、そうやって喰われた。……お前の影、妙に濃いな。' },
      { who: 'リオ', text: '……え？' },
      { who: 'カイ', text: '気にするな。また会うこともあるだろう。' },
    ]);
    g.setFlag('kaiMet');
    const kai = g.npc('J');
    if (kai) {
      await kai.moveTo(kai.x - 200, 140);
      kai.hide();
    }
  },

  boltAltar: async (g) => {
    if (g.save.abilities.bolt) return;
    await g.say([
      { text: '祭壇に、柄をかざすと……刃のない柄の先に、小さな光が灯った。' },
      { who: 'ガレンの声', text: '灯を放つ術だ。遠くの灯の玉も、これで点けられる。' },
    ]);
    await g.giveAbility('bolt', '魔法「灯弾」', 'C で光の弾を撃つ（MP 3）。\nまっすぐ飛び、離れた灯の玉を点けられる。\n剣で敵に当てると MP が回復する。');
  },

  mirror: async (g) => {
    if (g.flag('mirror')) return;
    g.setFlag('mirror');
    g.face(-1);
    await g.wait(300);
    g.shake(300, 0.003);
    await g.say([
      { text: '磨かれた鏡の壁に、リオの姿が映っている。' },
      { text: '……鏡の中のリオの影が、一瞬遅れて動いた。' },
      { text: 'そして――笑った、ように見えた。' },
      { who: 'リオ', text: '……気のせい、だよな。' },
    ]);
  },

  tempestEnter: async (g) => {
    if (g.flag('boss_tempest')) return;
    await g.wait(600);
    g.shake(600, 0.006);
    await g.say([
      { text: 'ゴオォォォ……！ 屋上に嵐が巻き起こる。' },
      { who: 'ガレンの声', text: '（空の主だ……羽根を打ち返し、降りてきた隙を斬れ）' },
    ]);
    g.startBoss();
  },

  boss_tempest: async (g) => {
    await g.wait(900);
    await g.say('嵐がやみ、大鷲の羽根の中から光のかけらが舞い降りた。');
    await g.giveFragment();
    await g.say([
      { who: 'ガレンの声', text: '疾風の欠片……二つ目だ。' },
      { who: 'ガレンの声', text: '三つ目は深い水の底……百年前、英雄の都があった場所だ。' },
      { who: 'ガレンの声', text: 'ドルムの暗い扉は門に閉ざされている……崖の上から、壁のくぼみの玉を灯弾で撃て。' },
      { text: '第3章　沈んだ都' },
    ]);
    g.setFlag('ch3');
    g.toast('ドルムの崖の上から、くぼみの灯の玉を灯弾（C）で撃とう');
  },
  // ---------------------------------------------------------------- chapter 3
  boss_captain: async (g) => {
    await g.wait(800);
    await g.say([
      { who: '沈んだ騎士長', text: '……その柄……英雄の……灯……' },
      { who: '沈んだ騎士長', text: '百年……待った……この力を……継ぐ者を……' },
      { text: '騎士長の鎧が崩れ、青白い光がリオの柄に吸い込まれた。' },
    ]);
    await g.giveAbility('rift', '魔法「灯渡り」', '前へ瞬間移動する（MP 5）。移動中は無敵。\n光の格子をすり抜けられる。A / S で魔法を切り替え。');
    await g.say([
      { who: 'カイ', text: '……ここにいたか。' },
      { who: 'リオ', text: 'カイ！ どうしてアクアリアに？' },
      { who: 'カイ', text: '壁画を読んだ。英雄は虚の王ノクスを斬らず、封じた。そして十六年前、封印がゆるんだ。' },
      { who: 'カイ', text: '逃げ出したノクスは「生まれたばかりの子どもの影」に隠れた……と書いてある。' },
      { who: 'カイ', text: '……リオ。お前、自分の生まれを知っているか？' },
      { who: 'リオ', text: '……知らない。物心ついた時には、師匠と二人だった。' },
      { who: 'カイ', text: '…………そうか。確かめさせてもらう。いずれな。' },
    ]);
    g.setFlag('kaiSuspects');
  },

  leviaEnter: async (g) => {
    if (g.flag('boss_levia')) return;
    await g.wait(600);
    g.shake(700, 0.006);
    await g.say([
      { text: '水面が大きく泡立った……！' },
      { who: 'ガレンの声', text: '（深き者だ。頭が水から出た隙に斬れ。吐き出す泡は打ち返せる）' },
      { who: 'ガレンの声', text: '（足元の水が揺れたら、触手が来るぞ）' },
    ]);
    g.startBoss();
  },

  boss_levia: async (g) => {
    await g.wait(900);
    await g.say('水が静まり、深淵の底から光のかけらが浮かび上がってきた。');
    await g.giveFragment();
    await g.say([
      { who: 'ガレンの声', text: '深淵の欠片……残るは一つ。竜の炉だ。' },
      { who: 'ガレンの声', text: '湖底の門の、ひびの入った壁の奥……熱い風の吹く方へ。' },
      { who: 'ミナ', text: 'リオー！ 見つけた、やっぱりここにいた！' },
      { who: 'ミナ', text: 'ひびの入った壁を壊すんでしょ？ ちょうどいい魔法、研究してたんだ。あんたの柄なら使えるはず！' },
    ]);
    await g.giveAbility('bomb', '魔法「灯爆」', '置いて少し後に爆発する（MP 8）。\nひびの入った壁を壊せる。硬い敵にも効く。');
    await g.say([{ text: '第4章　竜の炉' }]);
    g.setFlag('ch4');
    g.toast('湖底の門のひびの入った壁を、灯爆で壊そう');
  },

  // ---------------------------------------------------------------- chapter 4
  wardAltar: async (g) => {
    if (g.save.abilities.ward) return;
    await g.say([
      { text: '炉の壁に、古い祭壇が埋め込まれている。柄をかざすと、温かい光が体を包んだ。' },
      { who: 'ガレンの声', text: '守りの術だ……灯は、自分だけでなく誰かを守るためにある。' },
    ]);
    await g.giveAbility('ward', '魔法「灯守り」', '3秒間、光の盾で身を守る（MP 12）。\n飛んでくる弾を打ち返す。');
  },

  igniaEnter: async (g) => {
    if (g.flag('boss_ignia')) return;
    await g.wait(600);
    g.shake(900, 0.008);
    await g.say([
      { text: '炉の奥で、巨大な竜が目を開けた。' },
      { who: 'ガレンの声', text: '（溶岩竜だ……灯爆で頭を打て。怯んだ隙が勝機だ）' },
    ]);
    g.startBoss();
  },

  boss_ignia: async (g) => {
    await g.wait(900);
    await g.say('竜の体が冷えて岩に還り、胸の奥から最後の欠片が転がり落ちた。');
    await g.giveFragment();
    await g.say([
      { who: 'ミナ', text: 'リオ！ やったね、これで四つ全部――' },
      { text: '――その瞬間。四つの欠片が激しく光り、リオの足元の影が大きく膨れ上がった。' },
      { who: 'リオ', text: 'う……ああああっ！' },
    ]);
    g.flash(0x8a4ad0, 600);
    g.shake(900, 0.015);
    await g.say([
      { text: '影が鞭のように伸び、ミナを弾き飛ばした。' },
      { who: 'ミナ', text: 'きゃあっ！' },
      { who: 'リオ', text: 'ミナ！ ……違う、今のは、ぼくじゃ……' },
      { who: 'カイ', text: '……やはりな。' },
      { who: 'カイ', text: 'お前の影の中に、ノクスがいる。欠片が揃えば、奴は目を覚ます。' },
      { who: 'カイ', text: '俺は家族を虚に喰われた。……悪く思うな、リオ。剣を抜け。' },
    ]);
    await g.fadeOut(600);
    await g.warp('forgeDuel', '1');
  },

  duelEnter: async (g) => {
    if (g.flag('duelDone')) return;
    await g.wait(500);
    await g.say([
      { who: 'カイ', text: '手加減はしない。' },
      { who: 'リオ', text: '……わかった。ぼくも、確かめたい。' },
    ]);
    g.startBoss();
  },

  boss_kai: async (g) => {
    g.setFlag('duelDone');
    g.setFlag('kaiDuelWon');
    await g.wait(700);
    await g.say([
      { who: 'カイ', text: '……ぐっ。強いな、お前は。' },
      { who: 'カイ', text: 'なぜとどめを刺さない？ 俺はお前を殺そうとしたんだぞ。' },
      { who: 'リオ', text: '君の家族を奪ったのは虚だ。……君じゃない。ぼくも、たぶん違う。' },
      { who: 'カイ', text: '…………甘い奴だ。' },
    ]);
    await g.completeQuest('kai', 'カイ');
    await EV_AFTER_DUEL(g);
  },

  kaiWins: async (g) => {
    g.setFlag('duelDone');
    await g.wait(300);
    await g.say([
      { who: 'カイ', text: '……終わりだ、リオ。' },
      { text: 'カイは短剣を振り上げた。……だが、その刃は、いつまでも振り下ろされなかった。' },
      { who: 'カイ', text: '……くそ。なんで、お前は……そんな目で俺を見る。' },
    ]);
    await EV_AFTER_DUEL(g);
  },

  // ---------------------------------------------------------------- chapter 5
  nightEnter: async (g) => {
    if (g.flag('ch6')) return;
    await g.wait(600);
    await g.say([
      { text: '――気がつくと、リオはハルナ村の泉のそばに寝かされていた。夜空には星が瞬いている。' },
      { who: '長老エルダ', text: '目が覚めたか。カイという若者が、お前とミナを担いでここまで運んできた。' },
      { who: 'リオ', text: '長老……ぼくの影の中に、ノクスがいるって……本当なんですか。' },
      { who: '長老エルダ', text: '…………本当じゃ。十六年前、封印を破ったノクスは、赤ん坊の影に逃げ込んだ。' },
      { who: '長老エルダ', text: 'ガレンは剣を振り上げ……そして、赤ん坊を斬れなかった。' },
      { who: '長老エルダ', text: '代わりに剣を四つに割り、ノクスが力を取り戻せぬようにした。そして、その子を育てた。……お前じゃ、リオ。' },
      { who: 'リオ', text: '……師匠は、ずっと知ってて……ぼくを……' },
      { who: 'ガレンの声', text: '……リオ。' },
      { who: 'ガレンの声', text: 'お前を斬れなかったこと、一度も後悔したことはない。' },
      { who: 'ガレンの声', text: 'ルミナブレードは、鉄で打つ剣ではない。人の灯で打つ剣だ。' },
      { who: 'ガレンの声', text: 'お前が旅で助けてきた者たちを……思い出せ。' },
    ]);
    const lights = g.save.lights;
    const voices: Record<string, string> = {
      sheep: '羊飼いの少年「リオ兄ちゃん、がんばれ！」',
      smith: '鍛冶屋「おれの鍛えた鉄、無駄にするなよ」',
      miner: '鉱夫の妻「あの人を連れ戻してくれた灯、今度はあなたに」',
      kids: 'ドルムの子どもたち「兄ちゃん、負けんなよー！」',
      windmill: '風車守りの老人「風は、お前の背中を押しとるぞ」',
      bard: '吟遊詩人「君の歌の続きを、聞かせてくれ」',
      scholar: '学者「真実は、君が書き換えるんだ」',
      ghost: '幽霊の少女「♪……お兄ちゃん、ありがとう」',
      oldSmith: '老いた鍛冶師「わしの灯も、打ち込んでくれ」',
      spirit: '火の精の親子「あったかい灯、あげる！」',
      mina: 'ミナ「……あんたの地図の続き、あたしが描くから。だから帰ってきて」',
      kai: 'カイ「……信じてみる。お前を」',
    };
    if (lights.length) {
      await g.say([{ text: `夜の村に、ひとつ、またひとつと灯がともる。旅で出会った人たちの灯が、柄に集まってくる――（${lights.length}/12）` }]);
      await g.say(lights.map((id) => ({ text: voices[id] ?? '' })).filter((l) => l.text));
    } else {
      await g.say([{ text: '柄はかすかに温かい。……ガレンの灯だけが、そこに宿っている。' }]);
    }
    await g.fadeOut(800, 0xffffff);
    await g.say([
      { text: '――竜の炉。' },
      { text: '老いた鍛冶師が槌を振るうたびに、四つの欠片と柄が、人々の灯でひとつに溶け合っていく。' },
      { who: 'ガレンの声', text: '見事だ、リオ。……これが、お前の剣だ。' },
    ]);
    if (lights.length >= 4) g.setFlag('bladeWave');
    if (lights.length >= 8) g.setFlag('regen');
    if (lights.length >= 12) g.setFlag('allies');
    await g.giveEquip('luminablade');
    g.save.equip.sword = 'luminablade';
    const perks = [lights.length >= 4 ? '・溜め斬りで光の波を放つ' : '', lights.length >= 8 ? '・HP が少しずつ回復する' : '', lights.length >= 12 ? '・最後の戦いで、仲間が共に戦う' : ''].filter(Boolean);
    if (perks.length) await g.say([{ text: `人々の灯がルミナブレードに宿った：\n${perks.join('\n')}` }]);
    await g.say([
      { who: 'カイ', text: '……王都の方角を見ろ。空に、黒い塔が立っている。' },
      { who: 'カイ', text: 'ノクスが、お前の影から出ていった。今度は王都の灯を喰らうつもりだ。' },
      { text: '第6章　虚の塔' },
    ]);
    g.setFlag('ch6');
    g.save.room = 'capital';
    await g.warp('capital', '1');
  },

  // ---------------------------------------------------------------- chapter 6
  capitalEnter: async (g) => {
    if (g.flag('capitalIntro')) return;
    g.setFlag('capitalIntro');
    await g.wait(500);
    await g.say([
      { text: '王都ルミエは色を失っていた。人々は立ったまま、目から光だけが抜け落ちている。' },
      { who: 'カイ', text: g.flag('kaiDuelWon') ? 'リオ。……炉では悪かった。お前は、俺が思っていたような奴じゃなかった。' : 'リオ。……炉では、俺は刃を振り下ろせなかった。それが答えだ。' },
      { who: 'カイ', text: '俺は塔の門を押さえる。ミナも村から魔法で援護すると言っていた。' },
      { who: 'カイ', text: '行け。お前の影に、ケリをつけてこい。' },
    ]);
  },

  noxEnter: async (g) => {
    if (g.flag('boss_nox')) return;
    await g.wait(600);
    await g.say([
      { text: '塔の頂。リオの前に、リオと同じ姿をした影が立っていた。' },
      { who: 'ノクス', text: 'ようやく会えたな、器よ。十六年、お前の中は居心地がよかったぞ。' },
      { who: 'ノクス', text: '空っぽの心。親の顔も知らぬ寂しさ。……それが私の食事だった。' },
      { who: 'リオ', text: 'もう空っぽじゃない。みんなの灯が、ここにある。' },
      { who: 'ノクス', text: 'ならば奪うまで。お前の技は、全て知っている。' },
    ]);
    g.startBoss();
  },

  boss_nox: async (g) => {
    await g.wait(700);
    await g.say([
      { who: 'ノクス', text: 'ぐ……器の分際で……！' },
      { text: '影がほどけ、塔そのものが脈打ちはじめた。足元が闇に呑まれていく――' },
    ]);
    g.shake(1200, 0.012);
    await g.fadeOut(800);
    await g.warp('towerTop2', '1');
  },

  noxGiantEnter: async (g) => {
    if (g.flag('boss_noxgiant')) return;
    await g.wait(700);
    await g.say([
      { who: 'ノクス', text: 'この世界の灯を、全て喰らってやる……！' },
      { who: 'ガレンの声', text: '（リオ……手のひらの光を斬れ。闇の雨は、灯守りで跳ね返せ）' },
      ...(g.flag('allies')
        ? [
            { who: 'ミナ', text: 'リオ、聞こえる!? 村から魔法を送るよ！' },
            { who: 'カイ', text: '門は片付けた。……背中は任せろ。' },
          ]
        : []),
    ]);
    g.startBoss();
  },

  boss_noxgiant: async (g) => {
    await g.wait(900);
    await g.say([
      { text: '巨大な影が崩れ、小さな影がひとつ、リオの前に残った。' },
      { text: 'それは、膝を抱えてうずくまる、子どもの姿をしていた。' },
      { who: 'ノクス', text: '……なぜ……斬らない。' },
      { who: 'リオ', text: '君は、ぼくの空っぽだったところから生まれたんだろう。' },
      { who: 'リオ', text: 'ずっと寂しかったのは、ぼくも同じだ。……だから、もういいんだ。' },
      { text: 'リオは剣を置き、自分の影を抱きしめた。' },
      { text: '影はあたたかい光に変わり、夜明けの空へ、静かに昇っていった――' },
    ]);
    g.flash(0xffffff, 1500);
    await g.wait(1200);
    g.ending();
  },
};

async function EV_AFTER_DUEL(g: GameApi): Promise<void> {
  await g.say([{ text: 'リオの意識は、そこで途切れた――' }]);
  g.setFlag('ch5');
  g.save.room = 'villageNight';
  g.save.hp = g.save.hpMax;
  await g.fadeOut(1200);
  await g.warp('villageNight', 'F');
}
