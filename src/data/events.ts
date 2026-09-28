// Story scripts. Each runs as an async function with the game API; the scene freezes player
// input while a script runs. Scripts check flags themselves so they are safe to re-enter.
import { CH2_EVENTS } from './events2';
import type { GameApi } from './types';

export const EVENTS: Record<string, (g: GameApi) => Promise<void>> = {
  // ---------------------------------------------------------------- prologue
  villageEnter: async (g) => {
    if (!g.flag('intro')) {
      g.setFlag('intro');
      await g.wait(400);
      await g.say([
        { text: '――師匠の灯が、消える夢を見た。' },
        { who: 'リオ', text: '……ただの夢だ。そうだよな、師匠。' },
        { text: '（長老エルダに話を聞いてみよう）' },
      ]);
      return;
    }
    if (g.flag('afterWolf') && !g.flag('ch1')) {
      g.setFlag('ch1');
      await g.wait(500);
      await g.say([
        { who: '長老エルダ', text: '目が覚めたか、リオ。森で倒れているのを村の者が見つけてな。' },
        { who: 'リオ', text: '長老……師匠が、師匠が……！' },
        { who: '長老エルダ', text: '……わかっておる。ガレンは、最期までお前を守ろうとしたのじゃろう。' },
        { who: '長老エルダ', text: 'その割れた柄は「ルミナブレード」。虚を斬れる、ただ一つの剣の柄じゃ。' },
        { who: '長老エルダ', text: '十六年前、剣は四つの欠片に割られ、世界の四隅に散らばった。' },
        { who: '長老エルダ', text: '虚が目を覚ました今、欠片を集められるのは……柄に選ばれたお前だけじゃ。' },
        { who: '？？？', text: '（……リオ……西へ……石の心臓へ……）' },
        { who: 'リオ', text: '今の声……師匠？ 柄の中から……！' },
        { who: '長老エルダ', text: '街道を西へ行けば、鉱山町ドルム。坑道「石の心臓」に一つ目の欠片があるはずじゃ。' },
      ]);
      await g.say([{ text: '第1章　石の心臓' }]);
      g.toast('← 村の左から街道へ出られるようになった');
    }
  },

  forestBossEnter: async (g) => {
    if (g.flag('boss_wolf') || !g.flag('metGaren')) return;
    await g.wait(700);
    g.toast('影喰い狼 が現れた！');
    g.startBoss();
  },

  garenScene: async (g) => {
    if (g.flag('metGaren') || g.flag('boss_wolf')) return;
    await g.say([
      { who: 'リオ', text: '師匠！ ガレン師匠！' },
      { text: '……冷たい。灯が、消えている。' },
      { text: 'そばに、割れた剣の柄と、走り書きのメモが落ちている。' },
      { text: '『虚が目を覚ます。四つの欠片を集めよ。\n──そして、影を見るな』' },
      { who: 'リオ', text: '影……？' },
      { text: '……グルルルル……' },
    ]);
    g.setFlag('metGaren');
    g.shake(500, 0.008);
    g.toast('影喰い狼 が現れた！');
    g.startBoss();
  },

  boss_wolf: async (g) => {
    await g.wait(900);
    await g.say([
      { text: '影喰い狼は黒い霧になって消えた。' },
      { text: '霧の中から白い光がひとつ、空へ昇っていく。' },
      { who: '？？？', text: '……リオ……聞こえるか……' },
      { who: 'リオ', text: 'この声……師匠!? 柄の中から……？' },
      { who: 'ガレンの声', text: '欠片を……集めろ。そして……影を……' },
      { text: '森の奥で、無数の白い目が光った――。\nリオの意識は、そこで途切れた。' },
    ]);
    g.setFlag('prologueDone');
    g.setFlag('afterWolf');
    g.save.room = 'village';
    g.save.hp = g.save.hpMax;
    await g.fadeOut(1200);
    await g.warp('village', 'F');
  },

  // ---------------------------------------------------------------- chapter 1
  dormEnter: async (g) => {
    if (g.flag('minaIntro')) return;
    g.setFlag('minaIntro');
    await g.wait(300);
    await g.say([
      { who: '？？？', text: 'ちょっと、そこのあんた！ その腰の柄……光ってない？' },
      { who: 'ミナ', text: 'あたしはミナ。地図屋で、灯の魔法の研究者。……見習いだけどね。' },
      { who: 'ミナ', text: 'この町の坑道「石の心臓」で、人の灯が吸われる事件が起きてるの。奥から、あんたの柄と同じ光を感じる。' },
      { who: 'リオ', text: '剣の欠片だ……！ 行ってみる。' },
      { who: 'ミナ', text: '坑道の入口は町の下の段、左の端。暗いから気をつけて。あたしはこの辺にいるから、何かあったら声かけて。' },
    ]);
  },

  golemEnter: async (g) => {
    if (g.flag('boss_golem')) return;
    await g.wait(500);
    g.shake(800, 0.006);
    await g.say([
      { text: 'ゴゴゴゴゴ……' },
      { who: 'ガレンの声', text: '（リオ……岩の巨人に剣は通らぬ……落ちてくる岩を、打ち返せ……）' },
    ]);
    g.startBoss();
  },

  boss_rockqueen: async (g) => {
    await g.wait(600);
    await g.say('女王の巣の奥に、古いブーツが落ちている。履いてみると、体が羽のように軽くなった。');
    await g.giveAbility('doubleJump', '跳躍のブーツ', '空中でもう一度 Z を押すと、二段ジャンプができる。\n天井の穴から上へ行けそうだ。');
  },

  boss_golem: async (g) => {
    await g.wait(900);
    await g.say('崩れたゴーレムの胸から、まばゆい光のかけらが転がり出た。');
    await g.giveFragment();
    await g.say([
      { who: 'ガレンの声', text: 'よくやった、リオ……暁の欠片だ。' },
      { who: 'リオ', text: '師匠！ 本当に、師匠なんですね！' },
      { who: 'ガレンの声', text: '欠片が戻り、少しだけ力が戻った……ひとつ、技を教えよう。' },
      { who: 'ガレンの声', text: '剣を振りかぶったまま、灯を溜めろ。放てば、硬い守りも砕ける。' },
    ]);
    await g.giveAbility('charge', '溜め斬り', 'X を長押しして、光ったら離す。\n強力な一撃で、盾や硬い殻も破れる。');
    await g.say([
      { who: 'ガレンの声', text: '次の欠片は……風の吹く高みに……' },
      { who: 'ガレンの声', text: '……リオ。影を……見るな……' },
      { text: '第2章　空の祠' },
    ]);
    g.setFlag('ch2');
    g.toast('ドルムの崖の上（二段ジャンプ）から、風の高原へ行ける');
  },

  ...CH2_EVENTS,
};
