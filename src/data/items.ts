// Equipment, consumables and shop prices (docs/03_game_system.md §6-7).

export type Slot = 'sword' | 'armor' | 'charm';

export interface Equipment {
  id: string;
  name: string;
  slot: Slot;
  desc: string;
  atk?: number;
  def?: number;
  price?: number;
}

export const EQUIPMENT: Record<string, Equipment> = {
  // Swords
  apprentice: { id: 'apprentice', name: '見習いの剣', slot: 'sword', atk: 0, desc: 'ガレンに鍛えてもらった練習用の剣。' },
  machete: { id: 'machete', name: '鉱夫の鉈', slot: 'sword', atk: 2, price: 300, desc: '重い刃。岩の敵に 1.5 倍のダメージ。' },
  windblade: { id: 'windblade', name: '風切りの刃', slot: 'sword', atk: 4, desc: '軽い刃。振る速さが上がる。' },
  tideblade: { id: 'tideblade', name: '潮騒の剣', slot: 'sword', atk: 6, price: 1800, desc: '当てると MP が 2 回復する。' },
  kaiDagger: { id: 'kaiDagger', name: 'カイの短剣', slot: 'sword', atk: 7, desc: 'カイから託された短剣。3段目が2回攻撃になる。' },
  luminablade: { id: 'luminablade', name: 'ルミナブレード', slot: 'sword', atk: 10, desc: '人々の灯で打ち直された剣。虚に 2 倍。溜め斬りで光の波を放つ。' },
  // Armor
  cloth: { id: 'cloth', name: '布の服', slot: 'armor', def: 0, desc: 'ふだん着。' },
  leather: { id: 'leather', name: '革のベスト', slot: 'armor', def: 1, price: 150, desc: '受けるダメージ -1。' },
  minerPlate: { id: 'minerPlate', name: '鉱夫の胸当て', slot: 'armor', def: 2, price: 600, desc: '受けるダメージ -2。' },
  scaleMail: { id: 'scaleMail', name: '鱗の鎧', slot: 'armor', def: 3, desc: '受けるダメージ -3。' },
  dragonCloak: { id: 'dragonCloak', name: '竜皮の外套', slot: 'armor', def: 4, price: 3000, desc: '受けるダメージ -4。溶岩の床でダメージを受けない。' },
  // Charms
  magnet: { id: 'magnet', name: '磁石の石', slot: 'charm', price: 200, desc: '灯貨を遠くから吸い寄せる。' },
  wolfFang: { id: 'wolfFang', name: '狼の牙', slot: 'charm', desc: '3段目の威力 +30%。' },
  firefly: { id: 'firefly', name: '蛍の小瓶', slot: 'charm', desc: '暗い場所を明るく照らす。' },
  feather: { id: 'feather', name: '羽根飾り', slot: 'charm', desc: 'ジャンプボタンを押し続けると、ゆっくり落ちる。' },
  fullMoon: { id: 'fullMoon', name: '満月の輪', slot: 'charm', desc: 'HP が満タンのとき攻撃力 +2。' },
  vigor: { id: 'vigor', name: '生命の種', slot: 'charm', price: 900, desc: '最大 HP +4。' },
  greed: { id: 'greed', name: '欲張りの指輪', slot: 'charm', desc: '灯貨 +50%、受けるダメージ +1。' },
};

export interface Consumable {
  id: 'potion' | 'bigPotion' | 'ether';
  name: string;
  desc: string;
  max: number;
  price: number;
}

export const CONSUMABLES: Record<Consumable['id'], Consumable> = {
  potion: { id: 'potion', name: '灯の雫', desc: 'HP を 5 回復（Q）', max: 5, price: 40 },
  bigPotion: { id: 'bigPotion', name: '大きな灯の雫', desc: 'HP を全回復（Q）', max: 3, price: 200 },
  ether: { id: 'ether', name: '星の粉', desc: 'MP を全回復（E）', max: 3, price: 120 },
};

export type ShopEntry = { kind: 'equip'; id: string } | { kind: 'item'; id: Consumable['id'] };

export const SHOPS: Record<string, ShopEntry[]> = {
  village: [
    { kind: 'item', id: 'potion' },
    { kind: 'equip', id: 'leather' },
    { kind: 'equip', id: 'magnet' },
  ],
  dorm: [
    { kind: 'item', id: 'potion' },
    { kind: 'item', id: 'ether' },
    { kind: 'equip', id: 'machete' },
    { kind: 'equip', id: 'minerPlate' },
  ],
  aqualia: [
    { kind: 'item', id: 'potion' },
    { kind: 'item', id: 'bigPotion' },
    { kind: 'item', id: 'ether' },
    { kind: 'equip', id: 'tideblade' },
    { kind: 'equip', id: 'vigor' },
  ],
  forge: [
    { kind: 'item', id: 'bigPotion' },
    { kind: 'item', id: 'ether' },
    { kind: 'equip', id: 'dragonCloak' },
  ],
};

export type SpellId = 'bolt' | 'rift' | 'bomb' | 'ward';

export const SPELLS: Record<SpellId, { name: string; cost: number; desc: string }> = {
  bolt: { name: '灯弾', cost: 3, desc: 'まっすぐ飛ぶ光の弾。離れた灯の玉を点ける。' },
  rift: { name: '灯渡り', cost: 5, desc: '前へ瞬間移動。光の格子をすり抜ける。' },
  bomb: { name: '灯爆', cost: 8, desc: '置いて少し後に爆発。ひびの入った壁を壊す。' },
  ward: { name: '灯守り', cost: 12, desc: '3秒間、光の盾で身を守り、弾を打ち返す。' },
};

export const SPELL_ORDER: SpellId[] = ['bolt', 'rift', 'bomb', 'ward'];
