'use strict';
/* =========================================================
   ÉTHER BRAVE — mini RPG roguelike mobile
   Combat au tour par tour façon "gacha RPG" : chaînes de coups,
   jauge de Limite, buffs/débuffs, équipements à rareté ★1–★5.
   ========================================================= */

// ---------- utilitaires ----------
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, b) => clamp((a / b) * 100, 0, 100);
const alive = u => u.hp > 0;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wpick = list => {
  const tot = list.reduce((s, x) => s + x[1], 0);
  let r = Math.random() * tot;
  for (const [v, w] of list) if ((r -= w) < 0) return v;
  return list[list.length - 1][0];
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};
let UID = 1;

// ---------- données ----------
const EL = {
  fire: { n: 'Feu', i: '🔥' }, ice: { n: 'Glace', i: '❄️' }, thunder: { n: 'Foudre', i: '⚡' },
  light: { n: 'Lumière', i: '☀️' }, dark: { n: 'Ténèbres', i: '🌑' },
};
const STAT = { hp: 'PV', mp: 'PM', atk: 'ATT', def: 'DÉF', mag: 'MAG', spr: 'PSY' };
const STATUS = {
  poison: { i: '☠️', n: 'Poison' }, regen: { i: '💚', n: 'Régén' }, taunt: { i: '🎯', n: 'Provoc.' },
  stun: { i: '💫', n: 'Étourdi' }, defend: { i: '🛡️', n: 'Défense' },
};
const TG = { enemy: '1 ennemi', enemies: 'Tous les ennemis', ally: '1 allié', allies: 'Équipe', self: 'Soi', deadAlly: '1 allié KO' };

const SK = {
  attack: { n: 'Attaque', i: '⚔️', mp: 0, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1 }] },
  // Chevalier
  provoke: { n: 'Provocation', i: '🎯', mp: 6, tg: 'self', fx: [{ t: 'status', s: 'taunt', d: 2 }, { t: 'buff', s: 'def', v: 0.5, d: 2 }] },
  holyblade: { n: 'Lame Sacrée', i: '✝️', mp: 10, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 2.2, hits: 2, el: 'light' }] },
  ironwall: { n: 'Mur de Fer', i: '🧱', mp: 14, tg: 'allies', fx: [{ t: 'buff', s: 'def', v: 0.4, d: 3 }, { t: 'buff', s: 'spr', v: 0.4, d: 3 }] },
  aegis: { n: 'Égide', i: '💠', mp: 22, tg: 'allies', fx: [{ t: 'healPct', p: 0.15 }, { t: 'status', s: 'regen', d: 3 }] },
  lbKnight: { n: 'Forteresse Sacrée', i: '🏰', tg: 'allies', fx: [{ t: 'healPct', p: 0.3 }, { t: 'buff', s: 'def', v: 1, d: 3 }, { t: 'buff', s: 'spr', v: 1, d: 3 }] },
  // Mage noir
  fire: { n: 'Brasier', i: '🔥', mp: 10, tg: 'enemy', fx: [{ t: 'dmg', k: 'mag', p: 2.0, el: 'fire' }] },
  blizzard: { n: 'Glaciation', i: '❄️', mp: 16, tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 1.1, el: 'ice' }] },
  thunder: { n: 'Foudre', i: '⚡', mp: 12, tg: 'enemy', fx: [{ t: 'dmg', k: 'mag', p: 2.1, hits: 3, el: 'thunder' }] },
  meteor: { n: 'Météore', i: '☄️', mp: 34, tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 1.7, hits: 4 }] },
  lbBlack: { n: 'Ultima', i: '🌌', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 4.2, hits: 6 }] },
  // Mage blanc
  cure: { n: 'Soin', i: '💚', mp: 8, tg: 'ally', fx: [{ t: 'heal', p: 1.8 }] },
  curaga: { n: 'Soin Total', i: '💖', mp: 18, tg: 'allies', fx: [{ t: 'heal', p: 1.0 }] },
  raise: { n: 'Vie', i: '🪽', mp: 20, tg: 'deadAlly', fx: [{ t: 'revive', p: 0.4 }] },
  barrier: { n: 'Barrière', i: '🔰', mp: 16, tg: 'allies', fx: [{ t: 'cleanse' }, { t: 'buff', s: 'def', v: 0.3, d: 3 }, { t: 'buff', s: 'spr', v: 0.3, d: 3 }] },
  lbWhite: { n: 'Bénédiction', i: '🌟', tg: 'allies', fx: [{ t: 'revive', p: 0.5 }, { t: 'healPct', p: 1 }, { t: 'status', s: 'regen', d: 3 }] },
  // Voleur
  steal: { n: 'Larcin', i: '💰', mp: 4, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 0.9 }, { t: 'steal' }] },
  poisonblade: { n: 'Lame Toxique', i: '🧪', mp: 8, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.2 }, { t: 'status', s: 'poison', d: 3, ch: 0.85 }] },
  flurry: { n: 'Rafale', i: '🌪️', mp: 12, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 2.1, hits: 5 }] },
  armorbreak: { n: 'Brise-Armure', i: '🔨', mp: 14, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.0 }, { t: 'debuff', s: 'def', v: 0.4, d: 3 }, { t: 'debuff', s: 'spr', v: 0.4, d: 3 }] },
  lbThief: { n: 'Mille Lames', i: '🗡️', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 6, hits: 12 }] },
  // Samouraï
  iai: { n: 'Iaijutsu', i: '🌙', mp: 9, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 2.4 }] },
  focus: { n: 'Concentration', i: '🧘', mp: 8, tg: 'self', fx: [{ t: 'buff', s: 'atk', v: 0.7, d: 3 }, { t: 'lb', v: 25 }] },
  guardbreak: { n: 'Brise-Garde', i: '💢', mp: 10, tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.3 }, { t: 'debuff', s: 'atk', v: 0.35, d: 3 }, { t: 'debuff', s: 'mag', v: 0.35, d: 3 }] },
  zantetsu: { n: 'Zantetsu', i: '⚔️', mp: 24, tg: 'enemies', fx: [{ t: 'dmg', k: 'phys', p: 1.7, hits: 2 }] },
  lbSamurai: { n: 'Lame Céleste', i: '🌠', tg: 'enemies', fx: [{ t: 'dmg', k: 'phys', p: 3.6, hits: 8, el: 'light' }] },
  // Barde
  warsong: { n: 'Chant de Guerre', i: '🎺', mp: 14, tg: 'allies', fx: [{ t: 'buff', s: 'atk', v: 0.4, d: 3 }, { t: 'buff', s: 'mag', v: 0.4, d: 3 }] },
  requiem: { n: 'Requiem', i: '🎻', mp: 12, tg: 'enemies', fx: [{ t: 'debuff', s: 'atk', v: 0.3, d: 3 }, { t: 'debuff', s: 'mag', v: 0.3, d: 3 }] },
  lullaby: { n: 'Berceuse', i: '🎶', mp: 10, tg: 'enemies', fx: [{ t: 'status', s: 'stun', ch: 0.35 }] },
  serenade: { n: 'Sérénade', i: '🎼', mp: 16, tg: 'allies', fx: [{ t: 'status', s: 'regen', d: 3 }, { t: 'mp', v: 12 }] },
  lbBard: { n: 'Symphonie Éthérée', i: '🎇', tg: 'allies', fx: [{ t: 'buff', s: 'atk', v: 0.8, d: 3 }, { t: 'buff', s: 'def', v: 0.8, d: 3 }, { t: 'buff', s: 'mag', v: 0.8, d: 3 }, { t: 'buff', s: 'spr', v: 0.8, d: 3 }, { t: 'lb', v: 20 }] },
  // Ennemis
  eSlash: { n: 'Coup Bas', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.5 }] },
  eBite: { n: 'Morsure', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.1 }, { t: 'status', s: 'poison', d: 3, ch: 0.5 }] },
  eAcid: { n: 'Acide', tg: 'enemy', fx: [{ t: 'dmg', k: 'mag', p: 1.2 }, { t: 'debuff', s: 'def', v: 0.25, d: 2 }] },
  eSpores: { n: 'Spores', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 0.6 }, { t: 'status', s: 'stun', ch: 0.2 }] },
  eRoar: { n: 'Cri de Guerre', tg: 'self', fx: [{ t: 'buff', s: 'atk', v: 0.5, d: 3 }], cond: u => !hasBuff(u, 'atk') },
  eSmash: { n: 'Fracas', tg: 'enemies', fx: [{ t: 'dmg', k: 'phys', p: 0.9 }] },
  eRoots: { n: 'Racines', tg: 'enemies', fx: [{ t: 'dmg', k: 'phys', p: 0.9 }, { t: 'status', s: 'stun', ch: 0.2 }] },
  eHeal: { n: 'Photosynthèse', tg: 'self', fx: [{ t: 'healPct', p: 0.1 }], cond: u => u.hp < maxHP(u) * 0.7 },
  ePollen: { n: 'Pollen', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 0.4 }, { t: 'status', s: 'poison', d: 3, ch: 0.6 }] },
  eDrain: { n: 'Drain', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.2, drain: 0.5 }] },
  eCrush: { n: 'Écrasement', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.7 }] },
  eBlizzard: { n: 'Blizzard', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 0.9, el: 'ice' }] },
  eBreath: { n: 'Souffle Ardent', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 1.0, el: 'fire' }] },
  ePrism: { n: 'Rayon Prismatique', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 1.1, el: 'light' }] },
  eShell: { n: 'Carapace', tg: 'self', fx: [{ t: 'buff', s: 'def', v: 0.6, d: 3 }, { t: 'buff', s: 'spr', v: 0.6, d: 3 }], cond: u => !hasBuff(u, 'def') },
  eQuake: { n: 'Séisme', tg: 'enemies', fx: [{ t: 'dmg', k: 'phys', p: 1.0 }] },
  eGhost: { n: 'Lame Spectrale', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 1.6, el: 'dark' }] },
  eDarkFlame: { n: 'Flamme Noire', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 0.9, el: 'dark' }] },
  eLaser: { n: 'Laser', tg: 'enemy', fx: [{ t: 'dmg', k: 'mag', p: 1.9, el: 'thunder' }] },
  eDoom: { n: 'Malédiction', tg: 'enemy', fx: [{ t: 'dmg', k: 'mag', p: 1.0, el: 'dark' }, { t: 'status', s: 'poison', d: 3 }] },
  eTerror: { n: 'Rugissement', tg: 'enemies', fx: [{ t: 'debuff', s: 'atk', v: 0.3, d: 3 }, { t: 'debuff', s: 'mag', v: 0.3, d: 3 }], cond: u => !aliveFoes(u).some(h => hasDebuff(h, 'atk')) },
  eClaw: { n: 'Griffe du Néant', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 2.0, hits: 2, el: 'dark' }] },
  eMegaflare: { n: 'Méga Brasier', tg: 'enemies', fx: [{ t: 'dmg', k: 'mag', p: 1.6, el: 'fire' }] },
  eRegen: { n: 'Régénération', tg: 'self', fx: [{ t: 'status', s: 'regen', d: 3 }], cond: u => !u.status.regen && u.hp < maxHP(u) * 0.8 },
  eCharge: { n: 'Charge Furieuse', tg: 'enemy', fx: [{ t: 'dmg', k: 'phys', p: 2.2 }] },
};

const CLASSES = {
  knight: {
    n: 'Chevalier', i: '🛡️', role: 'Tank · Protection', col: '#6aa8ff',
    base: { hp: 470, mp: 40, atk: 34, def: 34, mag: 12, spr: 22 }, g: { hp: 46, mp: 3, atk: 4, def: 4.2, mag: 1, spr: 2.2 },
    skills: [['provoke', 1], ['holyblade', 1], ['ironwall', 1], ['aegis', 5]], lb: 'lbKnight', start: 'Épée',
    names: ['Aldric', 'Bérénice', 'Gauvain', 'Ysolde'],
  },
  blackmage: {
    n: 'Mage Noir', i: '🔮', role: 'Magie élémentaire', col: '#b57bff',
    base: { hp: 300, mp: 90, atk: 14, def: 14, mag: 40, spr: 24 }, g: { hp: 28, mp: 8, atk: 1, def: 1.5, mag: 5, spr: 2.5 },
    skills: [['fire', 1], ['blizzard', 1], ['thunder', 1], ['meteor', 5]], lb: 'lbBlack', start: 'Bâton',
    names: ['Zéphyr', 'Morgane', 'Iliane', 'Corvin'],
  },
  whitemage: {
    n: 'Mage Blanc', i: '✨', role: 'Soins · Réanimation', col: '#ffe08a',
    base: { hp: 320, mp: 100, atk: 16, def: 16, mag: 32, spr: 34 }, g: { hp: 30, mp: 9, atk: 1, def: 2, mag: 3.5, spr: 4 },
    skills: [['cure', 1], ['curaga', 1], ['raise', 1], ['barrier', 5]], lb: 'lbWhite', start: 'Sceptre',
    names: ['Séléna', 'Aurore', 'Elio', 'Clémence'],
  },
  thief: {
    n: 'Voleur', i: '🗡️', role: 'Multi-coups · Poison', col: '#7ee0a4',
    base: { hp: 340, mp: 50, atk: 32, def: 20, mag: 14, spr: 16 }, g: { hp: 34, mp: 4, atk: 4.2, def: 2, mag: 1, spr: 2 },
    skills: [['steal', 1], ['poisonblade', 1], ['flurry', 1], ['armorbreak', 5]], lb: 'lbThief', start: 'Dague',
    names: ['Kael', 'Nyx', 'Lilou', 'Sacha'],
  },
  samurai: {
    n: 'Samouraï', i: '⚔️', role: 'Gros dégâts physiques', col: '#ff8a7a',
    base: { hp: 380, mp: 45, atk: 40, def: 24, mag: 10, spr: 16 }, g: { hp: 38, mp: 3.5, atk: 5, def: 2.5, mag: 1, spr: 1.5 },
    skills: [['iai', 1], ['focus', 1], ['guardbreak', 1], ['zantetsu', 5]], lb: 'lbSamurai', start: 'Katana',
    names: ['Kenshi', 'Ayame', 'Ryūji', 'Hana'],
  },
  bard: {
    n: 'Barde', i: '🎵', role: 'Buffs · Débuffs', col: '#ff9ad5',
    base: { hp: 330, mp: 85, atk: 22, def: 18, mag: 28, spr: 28 }, g: { hp: 32, mp: 7, atk: 2, def: 2, mag: 3, spr: 3 },
    skills: [['warsong', 1], ['requiem', 1], ['lullaby', 1], ['serenade', 5]], lb: 'lbBard', start: 'Harpe',
    names: ['Mélodie', 'Orphée', 'Calypso', 'Lyre'],
  },
};

const ENEMIES = {
  // Étage 1
  goblin: { n: 'Gobelin', i: '👺', hp: 150, atk: 34, def: 14, mag: 8, spr: 10, spd: 9, weak: ['fire'], sk: [['attack', 3], ['eSlash', 1]], xp: 14, gil: 12 },
  wolf: { n: 'Loup Sombre', i: '🐺', hp: 130, atk: 38, def: 12, mag: 6, spr: 10, spd: 14, weak: ['fire'], sk: [['attack', 2], ['eBite', 1]], xp: 15, gil: 10 },
  slime: { n: 'Gelée Verte', i: '🟢', hp: 190, atk: 28, def: 26, mag: 26, spr: 8, spd: 6, weak: ['thunder', 'fire'], res: ['ice'], sk: [['attack', 2], ['eAcid', 1]], xp: 15, gil: 11 },
  shroom: { n: 'Myconide', i: '🍄', hp: 140, atk: 24, def: 16, mag: 30, spr: 14, spd: 7, weak: ['fire'], sk: [['attack', 2], ['eSpores', 1]], xp: 16, gil: 13 },
  orc: { n: 'Chef Orc', i: '👹', hp: 620, atk: 46, def: 26, mag: 12, spr: 16, spd: 10, weak: ['light'], sk: [['attack', 2], ['eRoar', 1], ['eSmash', 2]], xp: 60, gil: 60, elite: true },
  treant: { n: 'Tréant Ancien', i: '🌳', hp: 2400, atk: 52, def: 32, mag: 46, spr: 32, spd: 8, weak: ['fire'], res: ['thunder', 'ice'], sk: [['attack', 2], ['eRoots', 2], ['eHeal', 1], ['ePollen', 1]], xp: 220, gil: 250, boss: true, acts: 2 },
  // Étage 2
  bat: { n: 'Vampyr', i: '🦇', hp: 230, atk: 56, def: 24, mag: 20, spr: 22, spd: 18, weak: ['light'], sk: [['attack', 2], ['eDrain', 1]], xp: 28, gil: 22 },
  golem: { n: 'Golem de Pierre', i: '🗿', hp: 440, atk: 64, def: 60, mag: 10, spr: 20, spd: 5, weak: ['thunder'], res: ['fire'], sk: [['attack', 2], ['eCrush', 1]], xp: 34, gil: 26 },
  icelem: { n: 'Esprit du Givre', i: '🧊', hp: 260, atk: 30, def: 26, mag: 64, spr: 46, spd: 11, weak: ['fire'], res: ['ice'], sk: [['attack', 1], ['eBlizzard', 1]], xp: 32, gil: 24 },
  spider: { n: 'Arachnide', i: '🕷️', hp: 250, atk: 58, def: 30, mag: 22, spr: 24, spd: 15, weak: ['fire', 'ice'], sk: [['attack', 2], ['eBite', 2]], xp: 30, gil: 22 },
  wyvern: { n: 'Wyverne', i: '🐲', hp: 1300, atk: 70, def: 40, mag: 66, spr: 36, spd: 13, weak: ['ice'], res: ['fire'], sk: [['attack', 2], ['eBreath', 2], ['eRoar', 1]], xp: 120, gil: 120, elite: true },
  crystalgolem: { n: 'Golem de Cristal', i: '💎', hp: 5200, atk: 78, def: 60, mag: 74, spr: 50, spd: 7, weak: ['thunder', 'dark'], res: ['light'], sk: [['attack', 2], ['ePrism', 2], ['eShell', 1], ['eQuake', 2]], xp: 420, gil: 500, boss: true, acts: 2 },
  // Étage 3
  specter: { n: 'Chevalier Spectral', i: '👻', hp: 480, atk: 92, def: 50, mag: 30, spr: 44, spd: 12, weak: ['light'], res: ['dark', 'ice'], sk: [['attack', 2], ['eGhost', 1]], xp: 55, gil: 40 },
  demon: { n: 'Démon Ailé', i: '😈', hp: 440, atk: 60, def: 40, mag: 96, spr: 56, spd: 14, weak: ['light', 'ice'], res: ['fire', 'dark'], sk: [['attack', 1], ['eDarkFlame', 1]], xp: 58, gil: 44 },
  sentinel: { n: 'Sentinelle', i: '🤖', hp: 560, atk: 88, def: 70, mag: 60, spr: 40, spd: 9, weak: ['thunder'], sk: [['attack', 2], ['eLaser', 1]], xp: 60, gil: 46 },
  lich: { n: 'Liche', i: '💀', hp: 420, atk: 40, def: 36, mag: 100, spr: 66, spd: 11, weak: ['light', 'fire'], res: ['dark', 'ice'], sk: [['eDarkFlame', 2], ['eDoom', 1], ['eTerror', 1]], xp: 62, gil: 50 },
  behemoth: { n: 'Béhémoth', i: '🐗', hp: 2600, atk: 110, def: 60, mag: 60, spr: 50, spd: 12, weak: ['ice'], sk: [['attack', 2], ['eCharge', 2], ['eRoar', 1]], xp: 220, gil: 220, elite: true },
  voiddragon: { n: 'Dragon du Néant', i: '🐉', hp: 11000, atk: 118, def: 70, mag: 120, spr: 66, spd: 13, weak: ['light'], res: ['dark', 'fire'], sk: [['eClaw', 2], ['eMegaflare', 1], ['eTerror', 1], ['eRegen', 1], ['attack', 1]], xp: 0, gil: 0, boss: true, acts: 2 },
};

const FLOORS = [
  { n: "Forêt d'Émeraude", short: 'Forêt', bg: 'radial-gradient(ellipse at 50% 0%, #2f7d55 0%, #0f3324 45%, #06140f 100%)', normal: ['goblin', 'wolf', 'slime', 'shroom'], elite: 'orc', boss: 'treant' },
  { n: 'Cavernes de Cristal', short: 'Cavernes', bg: 'radial-gradient(ellipse at 50% 0%, #3b5bc4 0%, #17224f 45%, #070a1f 100%)', normal: ['bat', 'golem', 'icelem', 'spider'], elite: 'wyvern', boss: 'crystalgolem' },
  { n: 'Citadelle Céleste', short: 'Citadelle', bg: 'radial-gradient(ellipse at 50% 0%, #8a4fc2 0%, #331a57 45%, #110820 100%)', normal: ['specter', 'demon', 'sentinel', 'lich'], elite: 'behemoth', boss: 'voiddragon' },
];
const ROWS = 8;

const ITEMS = {
  potion: { n: 'Potion', i: '🧪', d: 'Rend 35% des PV + 120' },
  ether: { n: 'Éther', i: '💧', d: 'Rend 40 PM' },
  phoenix: { n: 'Queue de Phénix', i: '🪶', d: 'Réanime un allié (40% PV)' },
  elixir: { n: 'Élixir', i: '⚗️', d: 'Restaure tous les PV/PM' },
};

const NODES = {
  combat: { n: 'Combat', i: '⚔️', d: 'Affronte des monstres' },
  elite: { n: 'Élite', i: '💀', d: 'Ennemi redoutable · butin rare' },
  treasure: { n: 'Trésor', i: '💰', d: "Un coffre t'attend" },
  rest: { n: 'Feu de camp', i: '🔥', d: 'Repos ou entraînement' },
  shop: { n: 'Marchand', i: '🛒', d: 'Objets et équipements' },
  event: { n: 'Mystère', i: '❓', d: 'Qui sait ce qui se cache ici…' },
  boss: { n: 'Gardien', i: '👑', d: "Le boss de l'étage" },
};

// ---------- équipements ----------
const SLOTS = { weapon: { n: 'Arme', i: '🗡️' }, armor: { n: 'Armure', i: '🥋' }, acc: { n: 'Accessoire', i: '💍' } };
const GEAR = {
  weapon: [
    ['Épée', '⚔️', { atk: 1 }], ['Katana', '🗡️', { atk: 1.15 }], ['Dague', '🔪', { atk: 0.8 }, 'crit'],
    ['Lance', '🔱', { atk: 0.85, def: 0.3 }], ['Bâton', '🪄', { mag: 1 }], ['Sceptre', '🔮', { mag: 0.7, spr: 0.5 }],
    ['Arc', '🏹', { atk: 0.9, mag: 0.2 }], ['Harpe', '🪕', { atk: 0.45, mag: 0.6 }],
  ],
  armor: [
    ['Armure', '🛡️', { def: 1, hp: 4 }], ['Robe', '👘', { spr: 0.9, mag: 0.3, hp: 2.5 }],
    ['Cotte', '🦺', { def: 0.7, spr: 0.4, hp: 3 }], ['Plastron', '🥋', { def: 0.6, atk: 0.3, hp: 3.5 }],
  ],
  acc: [
    ['Anneau', '💍', { mag: 0.4, spr: 0.4 }], ['Amulette', '📿', { hp: 5, spr: 0.3 }], ['Bracelet', '🔗', { atk: 0.4, def: 0.3 }],
    ['Ruban', '🎀', { def: 0.3, spr: 0.3, hp: 2 }], ['Médaillon', '🏅', { atk: 0.3, mag: 0.3 }],
  ],
};
const MATS = ['', 'de Bronze', 'de Fer', 'de Mithril', "d'Adamantite", 'Arc-en-ciel'];
const RMULT = [0, 1, 1.3, 1.65, 2.1, 2.7];
const PASSIVES = {
  el: { slots: ['weapon'], gen: () => ({ k: 'el', v: pick(Object.keys(EL)) }) },
  crit: { slots: ['weapon', 'acc'], gen: r => ({ k: 'crit', v: +(0.06 + 0.03 * r).toFixed(2) }) },
  lb: { slots: ['acc', 'armor'], gen: r => ({ k: 'lb', v: +(0.2 + 0.1 * r).toFixed(2) }) },
  regen: { slots: ['armor', 'acc'], gen: () => ({ k: 'regen' }) },
  mpr: { slots: ['acc', 'armor', 'weapon'], gen: r => ({ k: 'mpr', v: 2 + r }) },
  hpPct: { slots: ['armor', 'acc'], gen: r => ({ k: 'hpPct', v: +(0.05 + 0.03 * r).toFixed(2) }) },
  startAtk: { slots: ['weapon', 'acc'], gen: () => ({ k: 'startAtk' }) },
};
function pasLabel(p) {
  switch (p.k) {
    case 'el': return `${EL[p.v].i} Arme de ${EL[p.v].n}`;
    case 'crit': return `💥 Critique +${Math.round(p.v * 100)}%`;
    case 'lb': return `🌈 Jauge Limite +${Math.round(p.v * 100)}%`;
    case 'regen': return '💚 Régénération auto';
    case 'mpr': return `💧 +${p.v} PM / tour`;
    case 'hpPct': return `❤️ PV +${Math.round(p.v * 100)}%`;
    case 'startAtk': return '🔥 Début de combat : ATT/MAG +30%';
  }
  return '';
}

function genEquip(boost = 0, minRar = 1, forced = null) {
  const f = run.floor;
  let rar = forced ? forced.rar : wpick([[1, Math.max(6, 46 - f * 10 - boost * 15)], [2, 30], [3, 12 + f * 4 + boost * 8], [4, 3 + f * 2.5 + boost * 6], [5, 0.5 + f * 0.7 + boost * 2]]);
  rar = Math.max(rar, minRar);
  const slot = forced ? forced.slot : pick(Object.keys(GEAR));
  const tpl = forced ? GEAR[slot].find(g => g[0] === forced.base) : pick(GEAR[slot]);
  const [base, icon, coef, special] = tpl;
  const power = (5 + f * 8 + (run.row || 0)) * RMULT[rar];
  const st = {};
  for (const k in coef) st[k] = Math.round(coef[k] * power);
  const pas = [];
  let nPas = rar >= 5 ? 2 : rar >= 3 ? (Math.random() < 0.65 ? 1 : 0) : rar === 2 && Math.random() < 0.2 ? 1 : 0;
  if (special === 'crit') { pas.push(PASSIVES.crit.gen(rar)); nPas = Math.max(0, nPas - 1); }
  const pool = shuffle(Object.keys(PASSIVES).filter(k => PASSIVES[k].slots.includes(slot) && !pas.some(p => p.k === k)));
  for (let i = 0; i < nPas && i < pool.length; i++) pas.push(PASSIVES[pool[i]].gen(rar));
  return {
    uid: UID++, name: rar === 5 ? `${base} ${MATS[5]}` : `${base} ${MATS[rar]}`, i: icon, slot, rar, st, pas,
    price: Math.round((20 + power * 3) * rar * 0.8),
  };
}

// ---------- état de la partie ----------
let run = null;
let B = null; // combat en cours
const elMap = new Map();
let muted = store.get('eb.muted', false);
const records = store.get('eb.records', { bestFloor: 0, wins: 0, bestChain: 0, runs: 0 });

function newHero(cls) {
  const c = CLASSES[cls];
  const h = { uid: UID++, isHero: true, cls, n: pick(c.names), lvl: 1, xp: 0, hp: 0, mp: 0, lb: 0, eq: { weapon: null, armor: null, acc: null }, buffs: [], status: {}, q: { k: 'attack' } };
  h.eq.weapon = genEquip(0, 1, { rar: 1, slot: 'weapon', base: c.start });
  h.hp = maxHP(h); h.mp = maxMP(h);
  return h;
}

function heroStat(h, s) {
  const c = CLASSES[h.cls];
  let v = c.base[s] + c.g[s] * (h.lvl - 1);
  for (const sl in h.eq) { const e = h.eq[sl]; if (e && e.st[s]) v += e.st[s]; }
  if (s === 'hp') v *= 1 + pasSum(h, 'hpPct');
  return Math.round(v);
}
function pasSum(h, k) {
  let t = 0;
  for (const sl in h.eq) { const e = h.eq[sl]; if (e) for (const p of e.pas) if (p.k === k) t += (p.v ?? 1); }
  return t;
}
function weaponEl(h) { const w = h.eq.weapon; const p = w && w.pas.find(x => x.k === 'el'); return p ? p.v : null; }
const maxHP = u => (u.isHero ? heroStat(u, 'hp') : u.st.hp);
const maxMP = u => (u.isHero ? heroStat(u, 'mp') : 0);
function stat(u, s) {
  const b = u.isHero ? heroStat(u, s) : u.st[s];
  let m = 1;
  for (const x of u.buffs) if (x.s === s) m += x.v;
  return Math.max(1, b * clamp(m, 0.25, 3));
}
const hasBuff = (u, s) => u.buffs.some(b => b.s === s && b.v > 0);
const hasDebuff = (u, s) => u.buffs.some(b => b.s === s && b.v < 0);
const xpNeed = lvl => 40 + lvl * 30;
const unlocked = h => CLASSES[h.cls].skills.filter(([, l]) => h.lvl >= l).map(([id]) => id);
function applyBuff(t, s, v, d) {
  const ex = t.buffs.find(b => b.s === s && Math.sign(b.v) === Math.sign(v));
  if (ex) { if (Math.abs(v) > Math.abs(ex.v)) ex.v = v; ex.d = Math.max(ex.d, d); }
  else t.buffs.push({ s, v, d });
}
function gainXP(h, xp) {
  h.xp += xp;
  while (h.xp >= xpNeed(h.lvl)) { h.xp -= xpNeed(h.lvl); levelUp(h); }
}
function levelUp(h) {
  const oh = maxHP(h), om = maxMP(h);
  h.lvl++;
  if (h.hp > 0) h.hp += maxHP(h) - oh;
  h.mp += maxMP(h) - om;
}

function saveRun() { if (run) store.set('eb.run', run); }
function loadRun() {
  const r = store.get('eb.run', null);
  if (!r || !r.party) return null;
  let max = 0;
  const scan = o => { if (o && typeof o === 'object') { if (typeof o.uid === 'number') max = Math.max(max, o.uid); for (const k in o) scan(o[k]); } };
  scan(r);
  UID = max + 1;
  return r;
}
function saveRecords() { store.set('eb.records', records); }

// ---------- effets visuels & son ----------
let AC = null;
function sfx(type) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const cfg = {
      hit: [240, 110, 'square', 0.06], crit: [520, 160, 'sawtooth', 0.12], mag: [700, 300, 'triangle', 0.14],
      heal: [520, 900, 'sine', 0.2], buff: [400, 820, 'triangle', 0.16], ko: [220, 40, 'sawtooth', 0.3],
      lb: [260, 1300, 'sawtooth', 0.45], coin: [900, 1500, 'square', 0.09], ui: [620, 640, 'sine', 0.05], weak: [380, 120, 'square', 0.1],
    }[type] || [440, 440, 'sine', 0.05];
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = cfg[2];
    o.frequency.setValueAtTime(cfg[0], t);
    o.frequency.exponentialRampToValueAtTime(cfg[1], t + cfg[3]);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + cfg[3]);
    o.connect(g).connect(AC.destination);
    o.start(t); o.stop(t + cfg[3] + 0.02);
  } catch { /* audio indisponible */ }
}
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* rien */ } }

function float(u, text, cls = '') {
  const el = elMap.get(u.uid); if (!el) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float ' + cls;
  f.textContent = text;
  f.style.left = (r.left + r.width / 2 + rnd(-r.width * 0.22, r.width * 0.22)) + 'px';
  f.style.top = (r.top + r.height * 0.35 + rnd(-14, 14)) + 'px';
  $('#fx').appendChild(f);
  setTimeout(() => f.remove(), 1100);
}
function banner(text, kind = 'hero') {
  const b = document.createElement('div');
  b.className = 'banner ' + kind;
  b.innerHTML = `<span>${text}</span>`;
  $('#fx').appendChild(b);
  setTimeout(() => b.remove(), 1200);
}
function pulse(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
}
let chainT = 0;
function showChain(mult) {
  const c = $('#chain'); if (!c || B.chain < 2) return;
  c.innerHTML = `<b>${B.chain}</b> COUPS <small>×${mult.toFixed(2)}</small>`;
  c.classList.add('show');
  pulse(c, 'pop');
  clearTimeout(chainT); chainT = setTimeout(() => c.classList.remove('show'), 1300);
}
async function lbFlash(h) {
  const f = document.createElement('div');
  f.className = 'lbflash';
  f.innerHTML = `<div class="lbt">LIMITE</div><div class="lbn">${SK[CLASSES[h.cls].lb].n}</div>`;
  $('#fx').appendChild(f);
  sfx('lb'); buzz([30, 40, 60]);
  await sleep(750);
  setTimeout(() => f.remove(), 500);
}

// ---------- combat ----------
const alliesOf = u => (u.isHero ? run.party : B.enemies);
const aliveFoes = u => (u.isHero ? B.enemies : run.party).filter(alive);

function makeEnemy(k, scale) {
  const d = ENEMIES[k];
  const st = {};
  for (const s of ['hp', 'atk', 'def', 'mag', 'spr', 'spd']) st[s] = Math.round(d[s] * (s === 'spd' ? 1 : scale));
  return {
    uid: UID++, isHero: false, key: k, n: d.n, i: d.i, st, hp: st.hp, buffs: [], status: {},
    weak: d.weak || [], res: d.res || [], sk: d.sk, boss: !!d.boss, elite: !!d.elite, acts: d.acts || 1,
    xp: Math.round(d.xp * scale), gil: Math.round(d.gil * scale),
  };
}

function startBattle(kind) {
  const F = FLOORS[run.floor - 1];
  const scale = kind === 'boss' ? 1 : 1 + 0.07 * run.row;
  let keys;
  if (kind === 'boss') keys = [F.boss];
  else if (kind === 'elite') keys = [F.elite, ...(run.row >= 4 ? [pick(F.normal)] : [])];
  else { const n = run.row < 2 ? ri(1, 2) : ri(2, 3); keys = Array.from({ length: n }, () => pick(F.normal)); }
  const enemies = keys.map(k => makeEnemy(k, scale));
  const count = {};
  enemies.forEach(e => { count[e.key] = (count[e.key] || 0) + 1; });
  const idx = {};
  enemies.forEach(e => { if (count[e.key] > 1) { idx[e.key] = (idx[e.key] || 0) + 1; e.n += ' ' + 'ABC'[idx[e.key] - 1]; } });
  B = { kind, enemies, phase: 'player', turn: 1, busy: 0, chain: 0, lastHit: 0, auto: store.get('eb.auto', false), over: false, target: enemies[0] };
  for (const h of run.party) {
    h.buffs = []; h.status = {}; h.acted = false; h.skip = false;
    if (h.hp > 0 && pasSum(h, 'startAtk')) { applyBuff(h, 'atk', 0.3, 3); applyBuff(h, 'mag', 0.3, 3); }
  }
  run.st.battles++;
  buildBattle();
  banner(kind === 'boss' ? `${enemies[0].n} !` : kind === 'elite' ? "Ennemi d'élite !" : 'Combat !', kind === 'normal' ? 'hero' : 'enemy');
  if (B.auto) setTimeout(launchAll, 1000);
}

function buildBattle() {
  elMap.clear();
  const F = FLOORS[run.floor - 1];
  app.className = 'battle-wrap';
  app.innerHTML = `
  <div class="battle ${B.kind}" style="--bg:${F.bg}">
    <div class="btop">
      <div class="bt-l"><b>${F.short}</b> · ${run.row + 1}/${ROWS}</div>
      <div id="bturn" class="bt-c">Tour 1</div>
      <button class="chip ${B.auto ? 'on' : ''}" id="autoBtn" data-act="toggleAuto">AUTO</button>
    </div>
    <div id="chain" class="chain"></div>
    <div class="enemies n${B.enemies.length}" id="enemies"></div>
    <div class="hint">Touche un ennemi pour le cibler · un héros pour agir · <b>▾</b> pour ses compétences</div>
    <div class="heroes" id="heroes"></div>
    <div class="bbar">
      <button class="btn ghost" data-act="launchAll">⚡ Tout lancer</button>
      <button class="btn" data-act="endTurn">⏭ Fin du tour</button>
    </div>
  </div>`;
  const ew = $('#enemies');
  for (const e of B.enemies) {
    const d = document.createElement('div');
    d.className = 'enemy' + (e.boss ? ' boss' : '') + (e.elite ? ' elite' : '');
    d.dataset.act = 'target'; d.dataset.uid = e.uid;
    d.innerHTML = `<div class="reticle"></div><div class="esprite">${e.i}</div>
      <div class="ename">${e.n}</div><div class="bar ehp"><i></i></div>
      <div class="eweak">${e.weak.length ? '<span title="Faiblesses">' + e.weak.map(w => EL[w].i).join('') + '</span>' : ''}${e.res.length ? '<s title="Résistances">' + e.res.map(w => EL[w].i).join('') + '</s>' : ''}</div>
      <div class="stx"></div>`;
    ew.appendChild(d); elMap.set(e.uid, d);
  }
  const hw = $('#heroes');
  run.party.forEach((h, i) => {
    const c = CLASSES[h.cls];
    const d = document.createElement('div');
    d.className = 'hcard'; d.dataset.act = 'hero'; d.dataset.i = i;
    d.style.setProperty('--cc', c.col);
    d.innerHTML = `
      <div class="hc-top"><span class="hc-ic">${c.i}</span><span class="hc-name">${h.n}</span><span class="hc-lv">Nv${h.lvl}</span></div>
      <div class="bar hp"><i></i><b></b></div>
      <div class="bar mp"><i></i><b></b></div>
      <div class="bar lb"><i></i></div>
      <div class="stx"></div>
      <button class="hc-act" data-act="heroMenu" data-i="${i}"></button>`;
    hw.appendChild(d); elMap.set(h.uid, d);
  });
  updateBattle();
}

function statusHTML(u) {
  let s = '';
  for (const k in u.status) if (STATUS[k]) s += `<span class="st">${STATUS[k].i}</span>`;
  if (u.skip) s += `<span class="st">💫</span>`;
  for (const b of u.buffs) s += `<span class="bf ${b.v > 0 ? 'up' : 'down'}">${STAT[b.s]}${b.v > 0 ? '↑' : '↓'}</span>`;
  return s;
}
function qLabel(h) {
  const q = validQ(h);
  if (q.k === 'skill') return `${SK[q.id].i} ${SK[q.id].n}`;
  if (q.k === 'lb') return '🌈 LIMITE';
  if (q.k === 'item') return `${ITEMS[q.id].i} ${ITEMS[q.id].n}`;
  if (q.k === 'defend') return '🛡️ Défense';
  return '⚔️ Attaque';
}

function updateBattle() {
  if (!B || !$('#heroes')) return;
  $('#bturn').textContent = B.phase === 'enemy' ? '⚠ Tour ennemi' : `Tour ${B.turn}`;
  $('.battle').classList.toggle('eturn', B.phase === 'enemy');
  for (const e of B.enemies) {
    const d = elMap.get(e.uid); if (!d) continue;
    d.querySelector('.ehp i').style.width = pct(e.hp, e.st.hp) + '%';
    d.classList.toggle('dead', e.hp <= 0);
    d.classList.toggle('targeted', B.target === e && e.hp > 0);
    d.querySelector('.stx').innerHTML = statusHTML(e);
  }
  for (const h of run.party) {
    const d = elMap.get(h.uid); if (!d) continue;
    const mh = maxHP(h), mm = maxMP(h);
    d.querySelector('.hp i').style.width = pct(h.hp, mh) + '%';
    d.querySelector('.hp b').textContent = `${h.hp}/${mh}`;
    d.querySelector('.mp i').style.width = pct(h.mp, mm) + '%';
    d.querySelector('.mp b').textContent = `${h.mp} PM`;
    d.querySelector('.lb i').style.width = h.lb + '%';
    d.classList.toggle('ko', h.hp <= 0);
    d.classList.toggle('done', !!h.acted && h.hp > 0);
    d.classList.toggle('lbfull', h.lb >= 100 && h.hp > 0);
    d.classList.toggle('low', h.hp > 0 && h.hp < mh * 0.3);
    d.querySelector('.stx').innerHTML = statusHTML(h);
    d.querySelector('.hc-act').innerHTML = `<span>${qLabel(h)}</span><b>▾</b>`;
  }
}

function hasDeadAlly() { return run.party.some(a => a.hp <= 0); }
function canUseItem(id) {
  if (!run.items[id]) return false;
  if (id === 'phoenix') return hasDeadAlly();
  return run.party.some(alive);
}
function validQ(h) {
  const q = h.q || { k: 'attack' };
  if (q.k === 'skill') {
    const sk = SK[q.id];
    if (!sk || !unlocked(h).includes(q.id) || h.mp < sk.mp) return { k: 'attack' };
    if (sk.tg === 'deadAlly' && !hasDeadAlly()) return { k: 'attack' };
  }
  if (q.k === 'lb' && h.lb < 100) return { k: 'attack' };
  if (q.k === 'item' && !canUseItem(q.id)) return { k: 'attack' };
  return q;
}
function autoQ(h) {
  if (h.lb >= 100) return { k: 'lb' };
  const dead = run.party.filter(a => a.hp <= 0);
  const low = run.party.filter(a => a.hp > 0 && a.hp < maxHP(a) * 0.5);
  const has = id => unlocked(h).includes(id) && h.mp >= SK[id].mp;
  if (dead.length && has('raise')) return { k: 'skill', id: 'raise' };
  if (low.length >= 2 && has('curaga')) return { k: 'skill', id: 'curaga' };
  if (low.length && has('cure')) return { k: 'skill', id: 'cure' };
  const q = validQ(h);
  if (q.k !== 'attack') return q;
  if (h.mp > maxMP(h) * 0.35) {
    const off = unlocked(h).filter(id => has(id) && SK[id].fx.some(f => f.t === 'dmg'));
    if (off.length) return { k: 'skill', id: pick(off) };
  }
  return { k: 'attack' };
}

async function heroAct(h) {
  if (!B || B.over) return;
  if (B.phase !== 'player') return toast('Patiente, tour ennemi…');
  if (h.hp <= 0) return toast(`${h.n} est KO`);
  if (h.skip) return toast(`${h.n} est étourdi·e`);
  if (h.acted) return;
  h.acted = true; B.busy++;
  const q = B.auto ? autoQ(h) : validQ(h);
  updateBattle();
  try { await performAction(h, q); } catch (err) { console.error(err); }
  if (q.k === 'lb' || q.k === 'item') h.q = { k: 'attack' };
  if (B) { B.busy--; updateBattle(); maybeEndTurn(); }
}
function maybeEndTurn() {
  if (!B || B.over || B.phase !== 'player' || B.busy) return;
  if (run.party.every(h => h.hp <= 0 || h.acted)) setTimeout(enemyPhase, 350);
}
async function launchAll() {
  if (!B || B.phase !== 'player' || B.over) return;
  for (const h of run.party) {
    if (!B || B.over || B.phase !== 'player') return;
    if (h.hp > 0 && !h.acted) { heroAct(h); await sleep(260); }
  }
}
async function endTurnBtn() {
  if (!B || B.phase !== 'player' || B.over) return;
  run.party.forEach(h => { h.acted = true; });
  updateBattle();
  while (B && B.busy) await sleep(50);
  enemyPhase();
}

async function performAction(h, q) {
  pulse(elMap.get(h.uid), 'acting');
  if (q.k === 'defend') { h.status.defend = 1; float(h, 'Défense', 'info'); sfx('buff'); await sleep(200); return; }
  if (q.k === 'item') { await useItemBattle(h, q.id); return; }
  if (q.k === 'lb') { h.lb = 0; updateBattle(); await lbFlash(h); await useSkill(h, SK[CLASSES[h.cls].lb], true); return; }
  if (q.k === 'skill') { const sk = SK[q.id]; h.mp -= sk.mp; await useSkill(h, sk); return; }
  await useSkill(h, SK.attack);
}

function targetsFor(u, sk) {
  switch (sk.tg) {
    case 'self': return [u];
    case 'enemies': return aliveFoes(u);
    case 'allies': return alliesOf(u).slice();
    case 'ally': {
      const a = alliesOf(u).filter(alive).sort((x, y) => x.hp / maxHP(x) - y.hp / maxHP(y));
      return a.slice(0, 1);
    }
    case 'deadAlly': return alliesOf(u).filter(x => x.hp <= 0).slice(0, 1);
    default: { const t = pickFoe(u); return t ? [t] : []; }
  }
}
function pickFoe(u) {
  const foes = aliveFoes(u);
  if (!foes.length) return null;
  if (u.isHero) return foes.includes(B.target) ? B.target : foes[0];
  const t = foes.find(h => h.status.taunt);
  return t || pick(foes);
}

async function useSkill(u, sk, isLB = false) {
  if (sk !== SK.attack) {
    banner(`${sk.i ? sk.i + ' ' : ''}${sk.n}`, isLB ? 'lb' : u.isHero ? 'hero' : 'enemy');
    if (!isLB) await sleep(u.isHero ? 150 : 300);
  }
  let tg = targetsFor(u, sk);
  if (!tg.length) return;
  for (const fx of sk.fx) {
    if (!B || B.over) return;
    if (fx.t === 'dmg') tg = await doDamage(u, tg, fx, sk);
    else applyFx(u, tg, fx);
    updateBattle();
  }
  await sleep(140);
}

async function doDamage(u, tg, fx, sk) {
  const hits = fx.hits || 1;
  const per = fx.p / hits;
  let list = tg;
  for (let i = 0; i < hits; i++) {
    if (!B || B.over) break;
    let cur = list.filter(alive);
    if (!cur.length) {
      if (sk.tg !== 'enemy') break;
      const nt = pickFoe(u);
      if (!nt) break;
      list = [nt]; cur = list;
    }
    for (const t of cur) hit(u, t, fx, per);
    updateBattle();
    await sleep(hits > 1 ? 95 : 60);
  }
  return list;
}

function hit(u, t, fx, p) {
  const phys = fx.k === 'phys';
  const a = stat(u, phys ? 'atk' : 'mag'), d = stat(t, phys ? 'def' : 'spr');
  let dmg = (p * a * a) / (d + 0.3 * a);
  const el = fx.el || (phys && u.isHero ? weaponEl(u) : null);
  let tag = '';
  if (el) {
    if (t.weak && t.weak.includes(el)) { dmg *= 1.5; tag = 'weak'; }
    else if (t.res && t.res.includes(el)) { dmg *= 0.5; tag = 'res'; }
  }
  dmg *= rnd(0.92, 1.08);
  const crit = Math.random() < 0.05 + (u.isHero ? pasSum(u, 'crit') : 0);
  if (crit) dmg *= 1.5;
  if (t.status.defend) dmg *= 0.5;
  if (u.isHero) {
    const now = performance.now();
    B.chain = now - B.lastHit < 1100 ? B.chain + 1 : 1;
    B.lastHit = now;
    const mult = Math.min(1 + 0.08 * (B.chain - 1), 2.5);
    dmg *= mult;
    showChain(mult);
    if (B.chain > run.st.chain) run.st.chain = B.chain;
    u.lb = Math.min(100, u.lb + 3 * (1 + pasSum(u, 'lb')));
  }
  dmg = Math.max(1, Math.round(dmg));
  t.hp = Math.max(0, t.hp - dmg);
  if (t.isHero) {
    t.lb = Math.min(100, t.lb + 7 * (1 + pasSum(t, 'lb')));
    pulse($('.battle'), 'shake');
  }
  float(t, crit ? `${dmg}!` : dmg, crit ? 'crit' : tag || (t.isHero ? 'hurt' : ''));
  if (tag === 'weak') float(t, 'FAIBLE', 'tagw');
  pulse(elMap.get(t.uid), 'hit');
  sfx(crit ? 'crit' : tag === 'weak' ? 'weak' : phys ? 'hit' : 'mag');
  if (crit && t.boss) buzz(15);
  if (fx.drain && u.hp > 0) healUnit(u, Math.round(dmg * fx.drain));
  if (t.hp <= 0) onKO(t);
}

function healUnit(t, amt) {
  if (t.hp <= 0) return;
  t.hp = Math.min(maxHP(t), t.hp + amt);
  float(t, `+${amt}`, 'heal');
}

function applyFx(u, tg, fx) {
  const live = tg.filter(alive);
  switch (fx.t) {
    case 'heal': {
      const base = stat(u, 'mag') * 0.5 + stat(u, 'spr');
      for (const t of live) healUnit(t, Math.round(base * fx.p * rnd(0.95, 1.05) + 20));
      sfx('heal'); break;
    }
    case 'healPct':
      for (const t of live) healUnit(t, Math.round(maxHP(t) * fx.p));
      sfx('heal'); break;
    case 'buff':
      for (const t of live) { applyBuff(t, fx.s, fx.v, fx.d); float(t, `${STAT[fx.s]}↑`, 'buff'); }
      sfx('buff'); break;
    case 'debuff':
      for (const t of live) { applyBuff(t, fx.s, -fx.v, fx.d); float(t, `${STAT[fx.s]}↓`, 'debuff'); }
      sfx('buff'); break;
    case 'status':
      for (const t of live) {
        let ch = fx.ch ?? 1;
        if (fx.s === 'stun' && t.boss) ch *= 0.3;
        if (Math.random() < ch) { t.status[fx.s] = fx.d || 1; float(t, `${STATUS[fx.s].i} ${STATUS[fx.s].n}`, fx.s === 'regen' ? 'buff' : 'info'); }
        else if (fx.s !== 'taunt' && fx.s !== 'regen') float(t, 'Raté', 'info');
      }
      break;
    case 'revive':
      for (const t of tg.filter(x => x.hp <= 0)) {
        t.hp = Math.max(1, Math.round(maxHP(t) * fx.p)); t.buffs = []; t.status = {};
        float(t, 'Réanimé·e !', 'heal');
      }
      sfx('heal'); break;
    case 'mp':
      for (const t of live) if (t.isHero) { t.mp = Math.min(maxMP(t), t.mp + fx.v); float(t, `+${fx.v} PM`, 'mpf'); }
      break;
    case 'lb':
      for (const t of live) if (t.isHero) t.lb = Math.min(100, t.lb + fx.v);
      break;
    case 'steal': {
      if (!u.isHero) break;
      const g = ri(8, 20) * run.floor;
      run.gil += g; run.st.gil += g;
      float(u, `+${g} 💰`, 'gold'); sfx('coin'); break;
    }
    case 'cleanse':
      for (const t of live) { delete t.status.poison; t.buffs = t.buffs.filter(b => b.v > 0); }
      break;
  }
}

async function useItemBattle(h, id) {
  if (!canUseItem(id)) { await useSkill(h, SK.attack); return; }
  const target = itemTarget(id);
  if (!target) { await useSkill(h, SK.attack); return; }
  run.items[id]--;
  banner(`${ITEMS[id].i} ${ITEMS[id].n}`, 'hero');
  await sleep(200);
  applyItem(target, id);
  updateBattle();
  await sleep(200);
}
function itemTarget(id) {
  const live = run.party.filter(alive);
  if (id === 'phoenix') return run.party.find(a => a.hp <= 0);
  if (id === 'ether') return live.sort((a, b) => a.mp / maxMP(a) - b.mp / maxMP(b))[0];
  return live.sort((a, b) => a.hp / maxHP(a) - b.hp / maxHP(b))[0];
}
function applyItem(t, id) {
  if (id === 'potion') { if (B) healUnit(t, Math.round(maxHP(t) * 0.35 + 120)); else t.hp = Math.min(maxHP(t), t.hp + Math.round(maxHP(t) * 0.35 + 120)); }
  else if (id === 'ether') { t.mp = Math.min(maxMP(t), t.mp + 40); if (B) float(t, '+40 PM', 'mpf'); }
  else if (id === 'phoenix') { t.hp = Math.round(maxHP(t) * 0.4); t.buffs = []; t.status = {}; if (B) float(t, 'Réanimé·e !', 'heal'); }
  else if (id === 'elixir') { t.hp = maxHP(t); t.mp = maxMP(t); if (B) float(t, 'Restauré !', 'heal'); }
  sfx('heal');
}

function onKO(u) {
  u.hp = 0; u.buffs = []; u.status = {};
  if (u.isHero) { u.lb = 0; float(u, 'KO', 'ko'); }
  else {
    run.st.kills++;
    if (B.target === u) B.target = B.enemies.find(alive) || null;
  }
  sfx('ko');
  checkEnd();
}
function checkEnd() {
  if (!B || B.over) return;
  if (!B.enemies.some(alive)) { B.over = true; setTimeout(victory, 1100); }
  else if (!run.party.some(alive)) { B.over = true; setTimeout(defeat, 1400); }
}

function enemyChoose(e) {
  const opts = e.sk.filter(([id]) => !SK[id].cond || SK[id].cond(e));
  return SK[wpick(opts.length ? opts : [['attack', 1]])];
}
async function enemyPhase() {
  if (!B || B.over || B.phase !== 'player') return;
  B.phase = 'enemy';
  updateBattle();
  await sleep(450);
  const order = B.enemies.filter(alive).sort((a, b) => b.st.spd - a.st.spd);
  for (const e of order) {
    for (let a = 0; a < e.acts; a++) {
      if (!B || B.over || e.hp <= 0) break;
      if (e.status.stun) {
        delete e.status.stun;
        float(e, '💫 Étourdi', 'info');
        updateBattle(); await sleep(450);
        break;
      }
      pulse(elMap.get(e.uid), 'eact');
      await useSkill(e, enemyChoose(e));
      updateBattle();
      await sleep(360);
    }
  }
  if (!B || B.over) return;
  endRound();
  if (!B || B.over) return;
  startPlayerPhase();
}
function endRound() {
  for (const u of [...run.party, ...B.enemies]) {
    if (u.hp <= 0) continue;
    const mh = maxHP(u);
    if (u.status.poison) {
      let d = Math.round(mh * 0.06);
      if (!u.isHero) d = Math.min(d, 90 * run.floor);
      u.hp = Math.max(0, u.hp - d);
      float(u, d, 'poison');
      if (u.hp <= 0) { onKO(u); continue; }
    }
    const regen = u.status.regen ? (u.isHero ? 0.08 : 0.03) : u.isHero && pasSum(u, 'regen') ? 0.04 : 0;
    if (regen) healUnit(u, Math.round(mh * regen));
    if (u.isHero) u.mp = Math.min(maxMP(u), u.mp + Math.round(maxMP(u) * 0.04) + pasSum(u, 'mpr'));
    u.buffs.forEach(b => { b.d--; });
    u.buffs = u.buffs.filter(b => b.d > 0);
    for (const k of ['poison', 'regen', 'taunt']) if (u.status[k] && --u.status[k] <= 0) delete u.status[k];
    delete u.status.defend;
  }
  B.turn++;
  checkEnd();
  updateBattle();
}
function startPlayerPhase() {
  B.phase = 'player';
  for (const h of run.party) {
    h.acted = false; h.skip = false;
    if (h.hp > 0 && h.status.stun) { h.acted = true; h.skip = true; delete h.status.stun; }
  }
  updateBattle();
  if (run.party.every(h => h.hp <= 0 || h.acted)) { setTimeout(() => { if (B) { run.party.forEach(h => { h.skip = false; }); enemyPhase(); } }, 900); return; }
  if (B.auto) setTimeout(launchAll, 350);
}

function openHeroMenu(i) {
  if (!B || B.over) return;
  const h = run.party[i];
  if (h.hp <= 0) return toast(`${h.n} est KO`);
  const c = CLASSES[h.cls];
  const row = (k, id, ic, name, sub, cost, ok, cls = '') =>
    `<button class="opt ${cls}" data-act="chooseQ" data-i="${i}" data-k="${k}" data-id="${id}" ${ok ? '' : 'disabled'}>
      <span class="o-ic">${ic}</span><span class="o-b"><b>${name}</b><small>${sub}</small></span><span class="o-c">${cost}</span></button>`;
  let html = `<div class="sh-head"><span>${c.i} ${h.n}</span><small>PM ${h.mp}/${maxMP(h)} · Limite ${Math.floor(h.lb)}%</small></div><div class="sh-list">`;
  const lb = SK[c.lb];
  html += row('lb', '', '🌈', lb.n, skillDesc(lb), 'LIMITE', h.lb >= 100, 'lbopt');
  html += row('attack', '', '⚔️', 'Attaque', `Physique ×1${weaponEl(h) ? ' ' + EL[weaponEl(h)].i : ''} · 1 ennemi`, '', true);
  for (const [id, lvl] of c.skills) {
    const sk = SK[id];
    if (h.lvl < lvl) { html += row('skill', id, '🔒', sk.n, `Débloqué au niveau ${lvl}`, '', false); continue; }
    const ok = h.mp >= sk.mp && (sk.tg !== 'deadAlly' || hasDeadAlly());
    html += row('skill', id, sk.i, sk.n, skillDesc(sk), `${sk.mp} PM`, ok);
  }
  html += row('defend', '', '🛡️', 'Défense', 'Divise les dégâts reçus par 2 ce tour', '', true);
  for (const id in ITEMS) if (run.items[id] > 0) html += row('item', id, ITEMS[id].i, ITEMS[id].n, ITEMS[id].d, `×${run.items[id]}`, canUseItem(id));
  html += `</div><button class="btn ghost wide" data-act="closeSheet">Fermer</button>`;
  openSheet(html);
}

function skillDesc(sk) {
  const parts = [];
  const fxs = sk.fx;
  for (let i = 0; i < fxs.length; i++) {
    const f = fxs[i];
    if (f.t === 'dmg') parts.push(`${f.k === 'phys' ? 'Physique' : 'Magie'} ×${f.p}${f.hits > 1 ? ` (${f.hits} coups)` : ''}${f.el ? ' ' + EL[f.el].i : ''}${f.drain ? ' · Drain' : ''}`);
    else if (f.t === 'heal') parts.push(`Soin ×${f.p}`);
    else if (f.t === 'healPct') parts.push(`Soin ${Math.round(f.p * 100)}%`);
    else if (f.t === 'buff' || f.t === 'debuff') {
      const group = [STAT[f.s]];
      while (fxs[i + 1] && fxs[i + 1].t === f.t && fxs[i + 1].v === f.v && fxs[i + 1].d === f.d) { i++; group.push(STAT[fxs[i].s]); }
      parts.push(`${group.join('/')} ${f.t === 'buff' ? '+' : '−'}${Math.round(f.v * 100)}% (${f.d}t)`);
    } else if (f.t === 'status') parts.push(`${STATUS[f.s].n}${f.ch && f.ch < 1 ? ` ${Math.round(f.ch * 100)}%` : ''}${f.d ? ` (${f.d}t)` : ''}`);
    else if (f.t === 'revive') parts.push(`Réanime (${Math.round(f.p * 100)}% PV)`);
    else if (f.t === 'mp') parts.push(`+${f.v} PM`);
    else if (f.t === 'lb') parts.push(`Limite +${f.v}`);
    else if (f.t === 'steal') parts.push('Vole des gils');
    else if (f.t === 'cleanse') parts.push('Purifie');
  }
  return `${parts.join(' · ')} — ${TG[sk.tg]}`;
}

// ---------- fin de combat ----------
let pending = null;
function victory() {
  if (!B) return;
  const kind = B.kind;
  let xp = 0, gil = 0;
  for (const e of B.enemies) { xp += e.xp; gil += e.gil; }
  gil = Math.round(gil * rnd(0.9, 1.2));
  run.gil += gil; run.st.gil += gil;
  const ups = [];
  for (const h of run.party) {
    if (h.hp <= 0) h.hp = Math.max(1, Math.round(maxHP(h) * 0.1));
    h.buffs = []; h.status = {}; h.acted = false; h.skip = false;
    const before = h.lvl;
    gainXP(h, xp);
    if (h.lvl > before) {
      const newSk = CLASSES[h.cls].skills.filter(([, l]) => l > before && l <= h.lvl).map(([id]) => SK[id].n);
      ups.push(`${CLASSES[h.cls].i} ${h.n} → Nv ${h.lvl}${newSk.length ? ` · apprend <b>${newSk.join(', ')}</b>` : ''}`);
    }
  }
  if (run.st.chain > records.bestChain) { records.bestChain = run.st.chain; saveRecords(); }
  B = null;
  sfx('coin');
  const opts = genLoot(kind);
  pending = { kind, opts };
  render(`
    <div class="screen center reward">
      <h1 class="vic">VICTOIRE</h1>
      <div class="gains"><span>💰 +${gil} gils</span><span>✨ +${xp} EXP</span></div>
      ${ups.length ? `<div class="ups">${ups.map(u => `<div>⬆️ ${u}</div>`).join('')}</div>` : ''}
      <h3>Choisis ton butin</h3>
      <div class="loot">${opts.map((o, i) => `<div class="pickable" data-act="takeLoot" data-i="${i}">${o.type === 'eq' ? eqCard(o.eq) : itemCard(o.id, o.n)}</div>`).join('')}</div>
      <button class="btn ghost" data-act="skipLoot">Passer (+${15 * run.floor} gils)</button>
    </div>`);
}
function genLoot(kind) {
  const boost = kind === 'boss' ? 2 : kind === 'elite' ? 1 : 0;
  const opts = [
    { type: 'eq', eq: genEquip(boost, kind === 'boss' ? 4 : kind === 'elite' ? 3 : 1) },
    { type: 'eq', eq: genEquip(boost) },
  ];
  if (Math.random() < 0.5) opts.push({ type: 'eq', eq: genEquip(boost) });
  else { const id = wpick([['potion', 5], ['ether', 3], ['phoenix', 2], ['elixir', 1]]); opts.push({ type: 'item', id, n: id === 'potion' ? 3 : id === 'elixir' ? 1 : 2 }); }
  return opts;
}
function afterNode(kind) {
  if (kind === 'boss') floorClear();
  else advance();
}
function defeat() {
  B = null;
  records.runs++;
  records.bestFloor = Math.max(records.bestFloor, run.floor);
  saveRecords();
  store.del('eb.run');
  render(`
    <div class="screen center over">
      <h1 class="lose">DÉFAITE</h1>
      <p class="sub">Les cristaux s'éteignent… mais l'aventure peut recommencer.</p>
      ${statsHTML()}
      <button class="btn big" data-act="newRun">Nouvelle aventure</button>
      <button class="btn ghost" data-act="title">Écran titre</button>
    </div>`);
}
function statsHTML() {
  return `<div class="stats">
    <div><b>${run.floor}</b><small>Étage</small></div>
    <div><b>${run.st.battles}</b><small>Combats</small></div>
    <div><b>${run.st.kills}</b><small>Ennemis</small></div>
    <div><b>${run.st.chain}</b><small>Chaîne max</small></div>
    <div><b>${run.st.gil}</b><small>Gils gagnés</small></div>
    <div><b>${Math.max(...run.party.map(h => h.lvl))}</b><small>Niveau max</small></div>
  </div>`;
}
function floorClear() {
  if (run.floor >= FLOORS.length) {
    records.wins++; records.runs++; records.bestFloor = FLOORS.length; saveRecords();
    store.del('eb.run');
    render(`
      <div class="screen center over">
        <div class="crystal big"></div>
        <h1 class="vic">LÉGENDE !</h1>
        <p class="sub">Le Dragon du Néant est vaincu. Les Cristaux d'Éther brillent à nouveau !</p>
        <div class="party-row">${run.party.map(h => `<span>${CLASSES[h.cls].i}<small>${h.n} Nv${h.lvl}</small></span>`).join('')}</div>
        ${statsHTML()}
        <button class="btn big" data-act="newRun">Nouvelle aventure</button>
        <button class="btn ghost" data-act="title">Écran titre</button>
      </div>`);
    return;
  }
  run.floor++; run.row = 0;
  for (const h of run.party) { h.hp = maxHP(h); h.mp = maxMP(h); }
  run.options = genOptions();
  records.bestFloor = Math.max(records.bestFloor, run.floor); saveRecords();
  saveRun();
  const F = FLOORS[run.floor - 1];
  render(`
    <div class="screen center floorT" style="--bg:${F.bg}">
      <p class="sub">Gardien vaincu ! L'équipe est entièrement soignée.</p>
      <div class="crystal"></div>
      <h2>Étage ${run.floor}</h2>
      <h1 class="fname">${F.n}</h1>
      <button class="btn big" data-act="map">Continuer</button>
    </div>`);
}

// ---------- carte ----------
function genOptions() {
  const r = run.row;
  if (r === ROWS - 1) return ['boss'];
  if (r === 0) return ['combat', 'event'];
  if (r === ROWS - 2) return shuffle(['rest', 'shop', 'elite']);
  const pool = [['combat', 40], ['elite', r >= 2 ? 14 : 0], ['treasure', 10], ['rest', 9], ['shop', 9], ['event', 16]];
  const n = Math.random() < 0.3 ? 2 : 3;
  const out = new Set();
  let guard = 0;
  while (out.size < n && guard++ < 50) out.add(wpick(pool));
  return [...out];
}
function advance() {
  run.row++;
  run.options = genOptions();
  saveRun();
  showMap();
}

function showMap() {
  B = null;
  closeSheet();
  saveRun();
  const F = FLOORS[run.floor - 1];
  const dots = Array.from({ length: ROWS }, (_, i) => `<i class="${i < run.row ? 'done' : i === run.row ? 'cur' : ''} ${i === ROWS - 1 ? 'boss' : ''}"></i>`).join('');
  render(`
    <div class="screen map" style="--bg:${F.bg}">
      <header class="mhead">
        <div><small>Étage ${run.floor} / ${FLOORS.length}</small><h2>${F.n}</h2></div>
        <div class="gil">💰 ${run.gil}</div>
      </header>
      <div class="progress">${dots}</div>
      <div class="pmini">${run.party.map(h => {
        const c = CLASSES[h.cls];
        return `<div class="pm ${h.hp <= 0 ? 'ko' : ''}" style="--cc:${c.col}"><span>${c.i}</span><div><b>${h.n}</b><small>Nv${h.lvl}</small><div class="bar hp sm"><i style="width:${pct(h.hp, maxHP(h))}%"></i></div><div class="bar mp sm"><i style="width:${pct(h.mp, maxMP(h))}%"></i></div></div></div>`;
      }).join('')}</div>
      <h3 class="choose">${run.row === ROWS - 1 ? 'Le gardien vous attend…' : 'Choisis ta voie'}</h3>
      <div class="paths">${run.options.map((o, i) => `
        <button class="path ${o}" data-act="go" data-i="${i}">
          <span class="p-ic">${NODES[o].i}</span><span class="p-b"><b>${NODES[o].n}</b><small>${NODES[o].d}</small></span><span class="p-go">›</span>
        </button>`).join('')}</div>
      <nav class="mnav">
        <button data-act="party">🛡️<small>Équipe</small></button>
        <button data-act="bag">🎒<small>Sac</small></button>
        <button data-act="menu">☰<small>Menu</small></button>
      </nav>
    </div>`, 'scroll');
}

function goNode(type) {
  if (type === 'combat') startBattle('normal');
  else if (type === 'elite') startBattle('elite');
  else if (type === 'boss') startBattle('boss');
  else if (type === 'treasure') nodeTreasure();
  else if (type === 'rest') nodeRest();
  else if (type === 'shop') nodeShop();
  else if (type === 'event') nodeEvent();
}

function nodeTreasure() {
  const gil = ri(30, 60) * run.floor;
  run.gil += gil; run.st.gil += gil;
  const eq = genEquip(1, 2);
  run.bag.push(eq);
  let extra = '';
  if (Math.random() < 0.5) {
    const id = wpick([['potion', 4], ['ether', 3], ['phoenix', 2], ['elixir', 1]]);
    run.items[id]++;
    extra = itemCard(id, 1);
  }
  sfx('coin');
  saveRun();
  render(`
    <div class="screen center">
      <div class="chest">💰</div>
      <h2>Trésor !</h2>
      <div class="gains"><span>💰 +${gil} gils</span></div>
      <div class="loot">${eqCard(eq)}${extra}</div>
      <p class="sub">Ajouté au sac. Équipe-le depuis l'écran <b>Équipe</b>.</p>
      <button class="btn big" data-act="advance">Continuer</button>
    </div>`, 'scroll');
}

function nodeRest() {
  render(`
    <div class="screen center">
      <div class="camp">🔥</div>
      <h2>Feu de camp</h2>
      <p class="sub">Les flammes crépitent. Que faire ?</p>
      <div class="paths">
        <button class="path rest" data-act="restHeal"><span class="p-ic">😴</span><span class="p-b"><b>Se reposer</b><small>Soigne 50% PV/PM · réanime les KO</small></span></button>
        <button class="path elite" data-act="restTrain"><span class="p-ic">🏋️</span><span class="p-b"><b>S'entraîner</b><small>Un héros gagne 1 niveau</small></span></button>
      </div>
    </div>`, 'scroll');
}

function nodeShop() {
  const f = run.floor;
  run.shop = {
    items: [['potion', 30 + 10 * f], ['ether', 55 + 15 * f], ['phoenix', 90 + 20 * f], ['elixir', 220 + 40 * f]],
    gear: [genEquip(1, 2), genEquip(0), genEquip(1)],
  };
  showShop();
}
function showShop() {
  render(`
    <div class="screen shop">
      <header class="mhead"><div><small>Boutique</small><h2>🛒 Marchand</h2></div><div class="gil">💰 ${run.gil}</div></header>
      <p class="sub">« Bienvenue, voyageur ! Jette un œil à mes merveilles. »</p>
      <h3>Objets</h3>
      <div class="shoplist">${run.shop.items.map(([id, price], i) => `
        <div class="srow">${itemCard(id, run.items[id], 'possédé')}<button class="btn sm" data-act="buyItem" data-i="${i}" ${run.gil < price ? 'disabled' : ''}>${price} 💰</button></div>`).join('')}</div>
      <h3>Équipements</h3>
      <div class="shoplist">${run.shop.gear.length ? run.shop.gear.map((e, i) => `
        <div class="srow">${eqCard(e)}<button class="btn sm" data-act="buyGear" data-i="${i}" ${run.gil < e.price ? 'disabled' : ''}>${e.price} 💰</button></div>`).join('') : '<p class="sub">Tout est vendu !</p>'}</div>
      <div class="row2"><button class="btn ghost" data-act="party">🛡️ Équipe</button><button class="btn" data-act="advance">Partir ›</button></div>
    </div>`, 'scroll');
}

const EVENTS = [
  {
    t: 'Fontaine de Cristal', i: '⛲', d: "Une eau scintillante jaillit d'un cristal fêlé.",
    c: [
      ['Boire', () => {
        if (Math.random() < 0.7) { run.party.forEach(h => { if (h.hp > 0) { h.hp = Math.min(maxHP(h), h.hp + Math.round(maxHP(h) * 0.6)); h.mp = Math.min(maxMP(h), h.mp + Math.round(maxMP(h) * 0.5)); } }); return "L'eau est pure ! L'équipe récupère 60% PV et 50% PM."; }
        run.party.forEach(h => { if (h.hp > 0) h.hp = Math.max(1, h.hp - Math.round(maxHP(h) * 0.15)); });
        return "Beurk, l'eau est croupie… L'équipe perd 15% PV.";
      }],
      ['Ignorer', () => 'Tu passes ton chemin, prudent·e.'],
    ],
  },
  {
    t: 'Autel Ancien', i: '🗿', d: 'Un autel couvert de runes pulse doucement.',
    c: [
      ['Prier', () => { run.party.forEach(h => { if (h.hp > 0) h.lb = 100; }); return 'Une lumière arc-en-ciel enveloppe l\'équipe : jauges de Limite au maximum !'; }],
      ['Offrir son sang (−25% PV)', () => {
        run.party.forEach(h => { if (h.hp > 0) h.hp = Math.max(1, h.hp - Math.round(maxHP(h) * 0.25)); });
        const eq = genEquip(2, 4); run.bag.push(eq);
        return `L'autel accepte l'offrande et fait apparaître : <b class="r${eq.rar}">${eq.name}</b> ${'★'.repeat(eq.rar)} !`;
      }],
    ],
  },
  {
    t: 'Marchand Masqué', i: '🎭', d: '« Psst… Un trésor rare, pour une poignée de gils ? »',
    c: [
      [() => `Payer ${80 * run.floor} gils`, () => {
        const cost = 80 * run.floor;
        if (run.gil < cost) return "Pas assez de gils… le marchand s'évapore dans un nuage de fumée.";
        run.gil -= cost;
        const eq = genEquip(2, 3); run.bag.push(eq);
        return `Marché conclu ! Tu obtiens <b class="r${eq.rar}">${eq.name}</b> ${'★'.repeat(eq.rar)}.`;
      }],
      ['Refuser', () => '« Dommage… » Il disparaît.'],
    ],
  },
  {
    t: 'Embuscade !', i: '⚠️', d: 'Des grognements… Des monstres surgissent des ombres !',
    c: [['Combattre !', () => 'FIGHT']],
  },
  {
    t: 'Coffre Suspect', i: '📦', d: 'Un coffre trône seul au milieu du chemin. Trop facile ?',
    c: [
      ['Ouvrir', () => {
        if (Math.random() < 0.6) { const g = ri(40, 80) * run.floor; run.gil += g; run.st.gil += g; run.items.potion += 2; return `Jackpot ! +${g} gils et 2 Potions.`; }
        run.party.forEach(h => { if (h.hp > 0) h.hp = Math.max(1, h.hp - Math.round(maxHP(h) * 0.2)); });
        return "C'était un piège ! Une explosion blesse l'équipe (−20% PV).";
      }],
      ['Laisser', () => 'Mieux vaut ne pas tenter le diable.'],
    ],
  },
  {
    t: 'Esprit Errant', i: '👤', d: "Le fantôme d'un ancien héros veut partager son savoir.",
    c: [
      ['Écouter', () => { const xp = 50 * run.floor; run.party.forEach(h => gainXP(h, xp)); return `Ses récits sont inspirants. Toute l'équipe gagne ${xp} EXP !`; }],
      ['Lui donner une Potion', () => {
        if (run.items.potion < 1) return "Tu n'as pas de Potion… l'esprit s'efface tristement.";
        run.items.potion--; run.items.phoenix += 2; return "Reconnaissant, l'esprit t'offre 2 Queues de Phénix !";
      }],
    ],
  },
];
function nodeEvent() {
  const ev = pick(EVENTS);
  pending = { ev };
  render(`
    <div class="screen center">
      <div class="evic">${ev.i}</div>
      <h2>${ev.t}</h2>
      <p class="sub">${ev.d}</p>
      <div class="paths">${ev.c.map(([label], i) => `<button class="path event" data-act="evChoice" data-i="${i}"><span class="p-b"><b>${typeof label === 'function' ? label() : label}</b></span><span class="p-go">›</span></button>`).join('')}</div>
    </div>`, 'scroll');
}

// ---------- équipe & sac ----------
let partyIdx = 0, partyBack = 'map';
function showParty() {
  const h = run.party[partyIdx];
  const c = CLASSES[h.cls];
  const stats = ['hp', 'mp', 'atk', 'def', 'mag', 'spr'];
  const pas = Object.values(h.eq).filter(Boolean).flatMap(e => e.pas.map(pasLabel));
  render(`
    <div class="screen party">
      <header class="mhead"><div><small>Équipe</small><h2>Gestion</h2></div><div class="gil">💰 ${run.gil}</div></header>
      <div class="tabs">${run.party.map((x, i) => `<button class="${i === partyIdx ? 'on' : ''}" data-act="ptab" data-i="${i}" style="--cc:${CLASSES[x.cls].col}">${CLASSES[x.cls].i}<small>${x.n}</small></button>`).join('')}</div>
      <div class="hero-sheet" style="--cc:${c.col}">
        <div class="hs-top"><div class="hs-ic">${c.i}</div><div><h2>${h.n}</h2><small>${c.n} · ${c.role}</small>
          <div class="lvl">Niveau ${h.lvl} <div class="bar xp"><i style="width:${pct(h.xp, xpNeed(h.lvl))}%"></i></div><small>${h.xp}/${xpNeed(h.lvl)} EXP</small></div></div></div>
        <div class="hs-stats">${stats.map(s => `<div><small>${STAT[s]}</small><b>${s === 'hp' ? `${h.hp}/${heroStat(h, s)}` : s === 'mp' ? `${h.mp}/${heroStat(h, s)}` : heroStat(h, s)}</b></div>`).join('')}</div>
        ${pas.length ? `<div class="pas">${pas.map(p => `<span>${p}</span>`).join('')}</div>` : ''}
        <h3>Équipement</h3>
        <div class="slots">${Object.keys(SLOTS).map(sl => `
          <button class="slot" data-act="slot" data-s="${sl}">
            <span class="sl-l">${SLOTS[sl].i} ${SLOTS[sl].n}</span>
            ${h.eq[sl] ? eqCard(h.eq[sl]) : '<div class="empty">— vide —</div>'}
          </button>`).join('')}</div>
        <h3>Compétences</h3>
        <div class="skills">
          <div class="sk lbk"><b>🌈 ${SK[c.lb].n}</b><small>${skillDesc(SK[c.lb])}</small></div>
          ${c.skills.map(([id, l]) => `<div class="sk ${h.lvl < l ? 'locked' : ''}"><b>${h.lvl < l ? '🔒' : SK[id].i} ${SK[id].n} <em>${SK[id].mp} PM</em></b><small>${h.lvl < l ? `Niveau ${l}` : skillDesc(SK[id])}</small></div>`).join('')}
        </div>
      </div>
      <h3>Sac d'équipements (${run.bag.length})</h3>
      <div class="baglist">${run.bag.length ? run.bag.map((e, i) => `<div class="srow">${eqCard(e)}<button class="btn sm ghost" data-act="sell" data-i="${i}">Vendre ${Math.round(e.price / 2)}💰</button></div>`).join('') : '<p class="sub">Vide.</p>'}</div>
      <button class="btn wide back" data-act="partyBack">‹ Retour</button>
    </div>`, 'scroll');
}
function openSlot(sl) {
  const h = run.party[partyIdx];
  const cur = h.eq[sl];
  const list = run.bag.map((e, i) => [e, i]).filter(([e]) => e.slot === sl).sort((a, b) => b[0].rar - a[0].rar);
  const delta = e => {
    const keys = new Set([...Object.keys(e.st), ...(cur ? Object.keys(cur.st) : [])]);
    return [...keys].map(k => { const d = (e.st[k] || 0) - (cur ? cur.st[k] || 0 : 0); return d ? `<span class="${d > 0 ? 'up' : 'down'}">${STAT[k]} ${d > 0 ? '+' : ''}${d}</span>` : ''; }).join(' ');
  };
  let html = `<div class="sh-head"><span>${SLOTS[sl].i} ${SLOTS[sl].n} — ${h.n}</span></div><div class="sh-list">`;
  if (cur) html += `<button class="opt" data-act="unequip" data-s="${sl}"><span class="o-ic">✖</span><span class="o-b"><b>Retirer</b><small>${cur.name}</small></span></button>`;
  if (!list.length) html += '<p class="sub">Aucun équipement de ce type dans le sac.</p>';
  for (const [e, i] of list) html += `<div class="pickable" data-act="equip" data-i="${i}">${eqCard(e, `<div class="delta">${delta(e)}</div>`)}</div>`;
  html += `</div><button class="btn ghost wide" data-act="closeSheet">Fermer</button>`;
  openSheet(html);
}
function equip(i) {
  const h = run.party[partyIdx];
  const e = run.bag[i]; if (!e) return;
  const old = h.eq[e.slot];
  run.bag.splice(i, 1);
  if (old) run.bag.push(old);
  h.eq[e.slot] = e;
  h.hp = Math.min(h.hp, maxHP(h)); h.mp = Math.min(h.mp, maxMP(h));
  sfx('buff'); closeSheet(); saveRun(); showParty();
}
function showBag() {
  render(`
    <div class="screen bag">
      <header class="mhead"><div><small>Inventaire</small><h2>🎒 Sac</h2></div><div class="gil">💰 ${run.gil}</div></header>
      <h3>Objets</h3>
      <div class="shoplist">${Object.keys(ITEMS).map(id => `<div class="srow">${itemCard(id, run.items[id])}<button class="btn sm" data-act="useItem" data-id="${id}" ${run.items[id] > 0 ? '' : 'disabled'}>Utiliser</button></div>`).join('')}</div>
      <h3>Équipe</h3>
      <div class="pmini">${run.party.map(h => `<div class="pm ${h.hp <= 0 ? 'ko' : ''}" style="--cc:${CLASSES[h.cls].col}"><span>${CLASSES[h.cls].i}</span><div><b>${h.n}</b><small>${h.hp}/${maxHP(h)} PV · ${h.mp}/${maxMP(h)} PM</small><div class="bar hp sm"><i style="width:${pct(h.hp, maxHP(h))}%"></i></div></div></div>`).join('')}</div>
      <button class="btn wide back" data-act="map">‹ Retour</button>
    </div>`, 'scroll');
}
function chooseHeroSheet(title, act, extra = '', filter = () => true) {
  let html = `<div class="sh-head"><span>${title}</span></div><div class="sh-list">`;
  run.party.forEach((h, i) => {
    const ok = filter(h);
    html += `<button class="opt" data-act="${act}" data-i="${i}" ${extra} ${ok ? '' : 'disabled'}><span class="o-ic">${CLASSES[h.cls].i}</span><span class="o-b"><b>${h.n} · Nv${h.lvl}</b><small>${h.hp}/${maxHP(h)} PV · ${h.mp}/${maxMP(h)} PM</small></span></button>`;
  });
  html += `</div><button class="btn ghost wide" data-act="closeSheet">Annuler</button>`;
  openSheet(html);
}

// ---------- cartes UI ----------
function eqCard(e, extra = '') {
  const st = Object.entries(e.st).map(([k, v]) => `${STAT[k]} +${v}`).join(' · ');
  return `<div class="eq r${e.rar}"><div class="eq-ic">${e.i}</div><div class="eq-b">
    <div class="eq-n">${e.name}</div><div class="eq-r">${'★'.repeat(e.rar)}<span>${SLOTS[e.slot].n}</span></div>
    <div class="eq-s">${st}</div>${e.pas.map(p => `<div class="eq-p">${pasLabel(p)}</div>`).join('')}${extra}</div></div>`;
}
function itemCard(id, n, label = '') {
  return `<div class="eq item"><div class="eq-ic">${ITEMS[id].i}</div><div class="eq-b"><div class="eq-n">${ITEMS[id].n} <span class="cnt">×${n}${label ? ' ' + label : ''}</span></div><div class="eq-s">${ITEMS[id].d}</div></div></div>`;
}

// ---------- écrans ----------
const app = $('#app');
function render(html, cls = '') {
  app.innerHTML = html;
  app.className = cls;
  app.scrollTop = 0;
}
function openSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sh-bg" data-act="closeSheet"></div><div class="sh-panel">${html}</div>`;
  s.classList.remove('hidden');
}
function closeSheet() { const s = $('#sheet'); s.classList.add('hidden'); s.innerHTML = ''; }

function showTitle() {
  B = null; run = null; closeSheet();
  const saved = loadRun();
  render(`
    <div class="screen title">
      <div class="stars"></div>
      <div class="crystal big"></div>
      <h1 class="logo">ÉTHER<span>BRAVE</span></h1>
      <p class="tag">RPG Roguelike des Cristaux</p>
      <div class="menu">
        ${saved ? `<button class="btn big" data-act="continue">▶ Continuer <small>Étage ${saved.floor} · ${saved.row + 1}/${ROWS}</small></button>` : ''}
        <button class="btn ${saved ? 'ghost' : 'big'}" data-act="newRun">✦ Nouvelle aventure</button>
        <button class="btn ghost" data-act="howto">📖 Comment jouer</button>
      </div>
      <div class="rec">🏆 Victoires ${records.wins} · Étage max ${records.bestFloor} · Chaîne max ${records.bestChain}</div>
    </div>`);
}
let selected = [];
function showSelect() {
  render(`
    <div class="screen select">
      <h2>Forme ton équipe</h2>
      <p class="sub">Choisis <b>4 héros</b> parmi 6 classes.</p>
      <div class="classes">${Object.entries(CLASSES).map(([k, c]) => `
        <button class="cls ${selected.includes(k) ? 'on' : ''}" data-act="pickCls" data-k="${k}" style="--cc:${c.col}">
          <span class="c-ic">${c.i}</span><b>${c.n}</b><small>${c.role}</small>
          <em>${c.skills.slice(0, 3).map(([id]) => SK[id].n).join(' · ')}</em>
          <span class="c-lb">🌈 ${SK[c.lb].n}</span>
        </button>`).join('')}</div>
      <div class="row2">
        <button class="btn ghost" data-act="title">‹ Retour</button>
        <button class="btn" data-act="startRun" ${selected.length === 4 ? '' : 'disabled'}>Partir (${selected.length}/4)</button>
      </div>
    </div>`, 'scroll');
}
function showHowto() {
  render(`
    <div class="screen howto">
      <h2>📖 Comment jouer</h2>
      <div class="help">
        <p>🗺️ <b>Exploration</b> — Chaque étage compte ${ROWS} salles. Choisis ta voie : combats, élites, trésors, feux de camp, marchands ou mystères. Le <b>gardien</b> attend au bout. Survis aux 3 étages !</p>
        <p>⚔️ <b>Combat</b> — Touche un ennemi pour le cibler. Touche la carte d'un héros pour lancer son action. Le bouton <b>▾</b> ouvre ses compétences, sa Limite, la défense et les objets. L'action choisie est mémorisée pour les tours suivants.</p>
        <p>🔗 <b>Chaînes</b> — Enchaîne les coups de plusieurs héros rapidement : chaque coup augmente le multiplicateur de dégâts (jusqu'à ×2,5). Les compétences multi-coups sont parfaites pour ça ! Utilise <b>⚡ Tout lancer</b> pour une chaîne express.</p>
        <p>🌈 <b>Limite</b> — La jauge se remplit en frappant et en encaissant. Pleine, la carte du héros scintille : déchaîne une attaque ultime !</p>
        <p>🔥 <b>Éléments</b> — Les faiblesses d'un ennemi sont affichées sous son nom (barrées = résistances). Une faiblesse inflige ×1,5.</p>
        <p>📈 <b>Buffs & débuffs</b> — Chants, murs et brise-armures modifient ATT/DÉF/MAG/PSY pendant quelques tours. Combine-les !</p>
        <p>🛡️ <b>Équipement</b> — Armes, armures et accessoires de ★1 à ★5 (arc-en-ciel). Les plus rares ont des effets passifs : élément, critique, régénération…</p>
        <p>💀 <b>Roguelike</b> — Si toute l'équipe tombe, l'aventure est terminée. La partie est sauvegardée automatiquement sur la carte.</p>
      </div>
      <button class="btn wide" data-act="${run ? 'map' : 'title'}">‹ Retour</button>
    </div>`, 'scroll');
}
function showMenu() {
  openSheet(`<div class="sh-head"><span>☰ Menu</span></div><div class="sh-list">
    <button class="opt" data-act="toggleSound"><span class="o-ic">${muted ? '🔇' : '🔊'}</span><span class="o-b"><b>Son : ${muted ? 'désactivé' : 'activé'}</b></span></button>
    <button class="opt" data-act="howto"><span class="o-ic">📖</span><span class="o-b"><b>Comment jouer</b></span></button>
    <button class="opt" data-act="title"><span class="o-ic">🏠</span><span class="o-b"><b>Écran titre</b><small>La partie est sauvegardée</small></span></button>
    <button class="opt danger" data-act="abandon"><span class="o-ic">🏳️</span><span class="o-b"><b>Abandonner l'aventure</b><small>Supprime la sauvegarde</small></span></button>
  </div><button class="btn ghost wide" data-act="closeSheet">Fermer</button>`);
}

// ---------- actions (délégation d'événements) ----------
const ACT = {
  title: () => showTitle(),
  howto: () => { closeSheet(); showHowto(); },
  newRun: () => { selected = []; showSelect(); },
  continue: () => { run = loadRun(); if (run) showMap(); else showTitle(); },
  pickCls: d => {
    const i = selected.indexOf(d.k);
    if (i >= 0) selected.splice(i, 1); else if (selected.length < 4) selected.push(d.k); else toast('4 héros maximum');
    showSelect();
  },
  startRun: () => {
    if (selected.length !== 4) return;
    run = { party: [], floor: 1, row: 0, options: [], gil: 100, items: { potion: 3, ether: 1, phoenix: 1, elixir: 0 }, bag: [], st: { battles: 0, kills: 0, gil: 0, chain: 0 } };
    run.party = selected.map(newHero);
    run.options = genOptions();
    const F = FLOORS[0];
    render(`
      <div class="screen center floorT" style="--bg:${F.bg}">
        <p class="sub">Les Cristaux d'Éther s'assombrissent. Votre équipe se met en route…</p>
        <div class="party-row">${run.party.map(h => `<span>${CLASSES[h.cls].i}<small>${h.n}</small></span>`).join('')}</div>
        <div class="crystal"></div>
        <h2>Étage 1</h2><h1 class="fname">${F.n}</h1>
        <button class="btn big" data-act="map">En avant !</button>
      </div>`);
    saveRun();
  },
  map: () => showMap(),
  go: d => { const t = run.options[+d.i]; if (t) { sfx('ui'); goNode(t); } },
  advance: () => advance(),
  party: () => { partyBack = $('.shop') ? 'shop' : 'map'; partyIdx = 0; showParty(); },
  partyBack: () => { if (partyBack === 'shop') showShop(); else showMap(); },
  ptab: d => { partyIdx = +d.i; showParty(); },
  slot: d => openSlot(d.s),
  equip: d => equip(+d.i),
  unequip: d => {
    const h = run.party[partyIdx];
    if (h.eq[d.s]) { run.bag.push(h.eq[d.s]); h.eq[d.s] = null; h.hp = Math.min(h.hp, maxHP(h)); h.mp = Math.min(h.mp, maxMP(h)); }
    closeSheet(); saveRun(); showParty();
  },
  sell: d => {
    const e = run.bag[+d.i]; if (!e) return;
    run.bag.splice(+d.i, 1); run.gil += Math.round(e.price / 2); sfx('coin'); saveRun(); showParty();
  },
  bag: () => showBag(),
  useItem: d => {
    const id = d.id;
    const filter = id === 'phoenix' ? h => h.hp <= 0 : h => h.hp > 0;
    chooseHeroSheet(`${ITEMS[id].i} ${ITEMS[id].n} — sur qui ?`, 'useItemOn', `data-id="${id}"`, filter);
  },
  useItemOn: d => {
    const h = run.party[+d.i];
    if (!run.items[d.id]) return;
    run.items[d.id]--; applyItem(h, d.id); closeSheet(); saveRun(); showBag();
  },
  menu: () => showMenu(),
  closeSheet: () => closeSheet(),
  toggleSound: () => { muted = !muted; store.set('eb.muted', muted); showMenu(); },
  abandon: () => {
    openSheet(`<div class="sh-head"><span>Abandonner ?</span></div><p class="sub">La sauvegarde sera supprimée.</p>
      <div class="row2"><button class="btn ghost" data-act="closeSheet">Non</button><button class="btn danger" data-act="abandonYes">Oui, abandonner</button></div>`);
  },
  abandonYes: () => { store.del('eb.run'); run = null; showTitle(); },
  // combat
  target: d => {
    if (!B) return;
    const e = B.enemies.find(x => x.uid === +d.uid);
    if (e && e.hp > 0) { B.target = e; sfx('ui'); updateBattle(); }
  },
  hero: d => { if (B) heroAct(run.party[+d.i]); },
  heroMenu: d => openHeroMenu(+d.i),
  chooseQ: d => {
    const h = run.party[+d.i];
    h.q = d.k === 'skill' || d.k === 'item' ? { k: d.k, id: d.id } : { k: d.k };
    closeSheet();
    if (B && B.phase === 'player' && !h.acted && h.hp > 0 && !h.skip) heroAct(h);
    else updateBattle();
  },
  launchAll: () => launchAll(),
  endTurn: () => endTurnBtn(),
  toggleAuto: () => {
    if (!B) return;
    B.auto = !B.auto; store.set('eb.auto', B.auto);
    $('#autoBtn').classList.toggle('on', B.auto);
    if (B.auto) launchAll();
  },
  // butin
  takeLoot: d => {
    if (!pending || !pending.opts) return;
    const o = pending.opts[+d.i];
    if (o.type === 'eq') { run.bag.push(o.eq); toast(`${o.eq.name} ajouté au sac`); }
    else { run.items[o.id] += o.n; toast(`${ITEMS[o.id].n} ×${o.n}`); }
    const kind = pending.kind; pending = null; sfx('coin');
    afterNode(kind);
  },
  skipLoot: () => {
    if (!pending) return;
    run.gil += 15 * run.floor;
    const kind = pending.kind; pending = null;
    afterNode(kind);
  },
  // camp
  restHeal: () => {
    run.party.forEach(h => {
      if (h.hp <= 0) h.hp = Math.round(maxHP(h) * 0.3);
      h.hp = Math.min(maxHP(h), h.hp + Math.round(maxHP(h) * 0.5));
      h.mp = Math.min(maxMP(h), h.mp + Math.round(maxMP(h) * 0.5));
    });
    sfx('heal'); toast("L'équipe se repose au coin du feu");
    advance();
  },
  restTrain: () => chooseHeroSheet('🏋️ Qui s\'entraîne ?', 'trainHero'),
  trainHero: d => {
    const h = run.party[+d.i];
    levelUp(h); h.xp = 0;
    closeSheet(); sfx('buff'); toast(`${h.n} passe au niveau ${h.lvl} !`);
    advance();
  },
  // boutique
  buyItem: d => {
    const [id, price] = run.shop.items[+d.i];
    if (run.gil < price) return;
    run.gil -= price; run.items[id]++; sfx('coin'); showShop();
  },
  buyGear: d => {
    const e = run.shop.gear[+d.i];
    if (!e || run.gil < e.price) return;
    run.gil -= e.price; run.bag.push(e); run.shop.gear.splice(+d.i, 1); sfx('coin'); toast('Ajouté au sac'); showShop();
  },
  // événement
  evChoice: d => {
    if (!pending || !pending.ev) return;
    const res = pending.ev.c[+d.i][1]();
    pending = null;
    if (res === 'FIGHT') { startBattle('normal'); return; }
    saveRun();
    render(`
      <div class="screen center">
        <div class="evic">📜</div>
        <p class="result">${res}</p>
        <button class="btn big" data-act="advance">Continuer</button>
      </div>`);
  },
};

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.dataset.act];
  if (fn) { ev.preventDefault(); fn(t.dataset); }
});
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

showTitle();
