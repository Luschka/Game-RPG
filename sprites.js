'use strict';
/* =========================================================
   Pixel art procédural — héros & monstres
   Chaque sprite est dessiné sur une petite grille (32×32, 48×48
   ou 64×64) avec des formes ombrées en 4 tons (lumière en haut à
   gauche) puis un contour coloré automatique ("sel-out").
   ========================================================= */
const PIXEL = (() => {
  const hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mix = (c, t, k) => c.map((v, i) => Math.round(v + (t[i] - v) * k));
  const SHADOW = [24, 12, 48], LIGHT = [255, 248, 225];
  const ramp = h => { const c = hex(h); return [mix(c, SHADOW, 0.55), mix(c, SHADOW, 0.28), c, mix(c, LIGHT, 0.38)]; };

  class G {
    constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
    set(x, y, c, a = 1) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.px[y * this.w + x] = [c[0], c[1], c[2], a];
    }
    clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = null; }
    fill(test, box, col, o = {}) {
      const r = ramp(col), base = hex(col);
      const [x0, y0, x1, y1] = box;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, (y1 - y0) / 2);
      const L = o.light || [-0.55, -0.83];
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
          if (!test(x + 0.5, y + 0.5)) continue;
          let c = base;
          if (!o.flat) {
            const l = ((x + 0.5 - cx) / rx) * L[0] + ((y + 0.5 - cy) / ry) * L[1];
            c = l > 0.5 ? r[3] : l > -0.2 ? r[2] : l > -0.65 ? r[1] : r[0];
          }
          this.set(x, y, c, o.a ?? 1);
        }
      }
      return this;
    }
    // ellipse
    e(cx, cy, rx, ry, col, o) { return this.fill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, [cx - rx, cy - ry, cx + rx, cy + ry], col, o); }
    // rectangle
    r(x, y, w, h, col, o) { return this.fill((px, py) => px >= x && px < x + w && py >= y && py < y + h, [x, y, x + w, y + h], col, o); }
    // polygone
    p(pts, col, o) {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const inside = (x, y) => {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      return this.fill(inside, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], col, o);
    }
    // ligne (épaisseur t)
    l(x0, y0, x1, y1, col, t = 1, a = 1) {
      const c = hex(col);
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
        for (let dx = 0; dx < t; dx++) for (let dy = 0; dy < t; dy++) this.set(x + dx, y + dy, c, a);
      }
      return this;
    }
    // pixel isolé
    d(x, y, col, a = 1) { this.set(x, y, hex(col), a); return this; }
    // contour coloré : chaque pixel vide qui touche la forme prend une teinte très sombre de son voisin
    outline() {
      const out = this.px.slice();
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.px[y * this.w + x]) continue;
        let nb = null;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
          const c = this.px[Y * this.w + X];
          if (c) { nb = c; break; }
        }
        if (nb) { const m = mix(nb, [16, 8, 28], 0.72); out[y * this.w + x] = [m[0], m[1], m[2], Math.max(0.85, nb[3])]; }
      }
      this.px = out;
      return this;
    }
    toURL() {
      const cv = document.createElement('canvas');
      cv.width = this.w; cv.height = this.h;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(this.w, this.h);
      this.px.forEach((c, i) => { if (c) { img.data.set([c[0], c[1], c[2], Math.round(c[3] * 255)], i * 4); } });
      ctx.putImageData(img, 0, 0);
      return cv.toDataURL();
    }
  }
  const mirror = (pts, W) => pts.map(([x, y]) => [W - x, y]);

  // ---------- palette ----------
  const SKIN = '#f2c49a', SKIN2 = '#e0a878', GOLD = '#f0c75e', STEEL = '#c3cee2', LEATHER = '#7a4e2c', DARK = '#1c1424';

  // ---------- HÉROS (32×32, tournés vers la gauche) ----------
  const D = {};
  D.knight = [32, 32, g => {
    g.p([[17, 14], [24, 14], [28, 30], [16, 30]], '#b3283c');                // cape
    g.r(12, 24, 3, 5, '#5f6b84'); g.r(17, 24, 3, 5, '#5f6b84');             // jambes
    g.r(10, 28, 5, 3, '#4a5168'); g.r(16, 28, 5, 3, '#4a5168');             // bottes
    g.r(20, 16, 3, 7, '#9aa6bc');                                           // bras arrière
    g.r(11, 15, 10, 10, STEEL);                                            // plastron
    g.r(11, 22, 10, 2, LEATHER, { flat: true }); g.d(15, 22, GOLD); g.d(16, 22, GOLD);
    g.e(15, 9, 6, 6, '#d2dbec');                                            // heaume
    g.p([[15, 3], [21, 0], [27, 3], [23, 6], [17, 5]], '#3d6fe0');          // panache
    g.r(9, 9, 7, 1, DARK, { flat: true }); g.r(10, 11, 4, 1, '#6a7590', { flat: true }); // visière
    g.d(11, 9, '#7fd4ff'); g.d(14, 9, '#7fd4ff');
    g.r(5, 2, 2, 15, '#eef4fc'); g.d(5, 1, '#eef4fc'); g.l(6, 3, 6, 15, '#9fb0c8');   // épée
    g.r(3, 16, 6, 1, GOLD, { flat: true }); g.r(5, 17, 2, 3, LEATHER, { flat: true });
    g.e(11, 21, 4.5, 6, '#3555b8');                                          // bouclier
    g.r(11, 16, 1, 10, GOLD, { flat: true }); g.r(8, 19, 7, 1, GOLD, { flat: true }); g.d(11, 19, '#ff6070');
  }];
  D.blackmage = [32, 32, g => {
    g.l(5, 7, 8, 30, '#8a5a30', 2);                                         // bâton
    g.p([[11, 14], [21, 14], [25, 29], [7, 29]], '#2f56c0');                // robe
    g.r(8, 27, 17, 2, '#24408f', { flat: true });
    g.r(9, 29, 5, 2, '#5a3a20'); g.r(17, 29, 5, 2, '#5a3a20');              // bottes
    g.e(10, 19, 3.5, 2.5, '#2f56c0'); g.e(7, 20, 1.6, 1.6, '#6a4a2a');       // manche + gant
    g.e(15, 12, 5.5, 4.5, '#120c1a', { flat: true });                       // visage d'ombre
    g.r(11, 11, 1, 2, '#ffe04a', { flat: true }); g.r(15, 11, 1, 2, '#ffe04a', { flat: true }); // yeux
    g.e(16, 8, 10.5, 2.2, '#c9a250');                                         // bord du chapeau
    g.p([[11, 8], [21, 8], [21, 4], [26, 0], [20, 1], [16, 3]], '#d6b060');   // pointe
    g.r(11, 6, 10, 1, '#8a6a30', { flat: true });
    g.e(5, 6, 2.5, 2.5, '#e8304a'); g.d(4, 5, '#ffd0d8');                   // orbe
  }];
  D.whitemage = [32, 32, g => {
    g.l(5, 6, 5, 30, '#c8a060', 2);                                         // bâton
    g.e(6, 5, 3, 3.5, GOLD); g.clear(6, 5); g.clear(6, 4); g.d(6, 8, '#ff5a7a');
    g.p([[11, 14], [21, 14], [25, 29], [7, 29]], '#f4f2f8');                // robe
    for (let x = 7; x < 25; x += 4) g.p([[x, 29], [x + 4, 29], [x + 2, 25.5]], '#d6304a', { flat: true }); // triangles rouges
    g.r(9, 29, 5, 2, '#a07850'); g.r(17, 29, 5, 2, '#a07850');
    g.e(9, 19, 3, 2.5, '#f4f2f8'); g.p([[6, 19], [9, 17.5], [9, 21.5]], '#d6304a', { flat: true }); g.e(6, 20, 1.5, 1.5, SKIN);
    g.e(16, 10, 7, 7, '#f4f2f8');                                           // capuche
    g.p([[10, 6], [11, 0], [14, 5]], '#f4f2f8'); g.p([[17, 4], [20, 0], [21, 6]], '#f4f2f8'); // oreilles
    g.d(11, 1, '#d6304a'); g.d(20, 1, '#d6304a');
    g.e(13, 11, 4, 4, SKIN);                                                 // visage
    g.r(10, 7, 7, 2, '#a86a3a'); g.d(9, 9, '#a86a3a');                       // mèche
    g.r(11, 11, 1, 2, '#3a2a6a', { flat: true }); g.r(14, 11, 1, 2, '#3a2a6a', { flat: true });
    g.d(12, 14, '#e07a7a');
    g.p([[9, 15], [12, 15], [10.5, 17.5]], '#d6304a', { flat: true }); g.p([[13, 15], [16, 15], [14.5, 17.5]], '#d6304a', { flat: true });
  }];
  D.thief = [32, 32, g => {
    g.p([[20, 13], [29, 15], [27, 19], [21, 16]], '#d84040');               // écharpe flottante
    g.r(12, 23, 3, 5, '#4a3a5a'); g.r(17, 23, 3, 5, '#4a3a5a');
    g.r(10, 27, 5, 4, '#6a4a2a'); g.r(17, 27, 5, 4, '#6a4a2a');
    g.r(20, 16, 3, 6, '#2e6a3a');
    g.r(11, 15, 10, 9, '#3f8a4a');                                           // tunique
    g.r(11, 21, 10, 2, LEATHER, { flat: true }); g.r(18, 22, 3, 3, '#8a6a3a'); // ceinture + bourse
    g.r(10, 13, 12, 3, '#d84040');                                           // écharpe
    g.e(15, 9, 5.5, 5.5, SKIN);
    g.p([[15, 2], [23, 3], [25, 9], [21, 13], [18, 6]], '#c0c8d8');          // cheveux argentés
    g.p([[21, 3], [27, 1], [24, 5]], '#c0c8d8'); g.p([[22, 8], [28, 8], [23, 11]], '#c0c8d8');
    g.e(15, 5, 6, 2.2, '#2d6a38');                                           // bandeau
    g.p([[20, 5], [26, 7], [24, 9], [20, 7]], '#2d6a38');
    g.r(10, 9, 1, 2, DARK, { flat: true }); g.r(13, 9, 1, 2, DARK, { flat: true });
    g.d(9, 12, SKIN2);
    g.e(9, 20, 2.5, 2, '#3f8a4a'); g.e(7, 20, 1.5, 1.5, SKIN);               // main
    g.l(2, 18, 6, 19, '#e6eef8', 1); g.l(2, 17, 5, 18, '#ffffff', 1); g.d(7, 19, GOLD); // dague
  }];
  D.samurai = [32, 32, g => {
    g.p([[11, 23], [21, 23], [24, 30], [8, 30]], '#2a3560');                // hakama
    g.r(9, 30, 5, 1, '#e8e0d0', { flat: true }); g.r(18, 30, 5, 1, '#e8e0d0', { flat: true });
    g.r(20, 15, 3, 7, '#8a2420');
    g.r(10, 14, 12, 10, '#c0302c');                                          // armure laquée
    for (let y = 16; y < 24; y += 3) g.r(10, y, 12, 1, GOLD, { flat: true });
    g.e(10, 15, 3, 2.2, '#a82824'); g.e(22, 15, 3, 2.2, '#a82824');           // épaulières
    g.e(15, 10, 5, 5, SKIN);
    g.e(16, 7, 7, 4, '#2a2a36'); g.r(18, 7, 6, 6, '#2a2a36');                // kabuto
    g.p([[14, 4], [7, 0], [9, 0], [16, 3]], GOLD); g.p([[16, 4], [22, 0], [20, 0], [15, 3]], GOLD); // croissant
    g.r(10, 9, 2, 1, DARK, { flat: true }); g.r(10, 10, 1, 1, DARK, { flat: true }); g.r(13, 10, 1, 1, DARK, { flat: true });
    g.r(11, 13, 3, 1, '#4a3a3a', { flat: true });
    g.l(1, 2, 11, 19, '#eef4fc', 1); g.l(2, 2, 12, 19, '#a8b8d0', 1);       // katana
    g.e(12, 20, 1.8, 1.2, GOLD); g.l(12, 21, 15, 26, '#3a2a3a', 2);
    g.e(13, 22, 2, 2, '#c0302c');
  }];
  D.bard = [32, 32, g => {
    g.p([[18, 14], [24, 14], [26, 26], [18, 26]], '#2e8a6a');               // cape
    g.r(12, 23, 3, 5, '#3a7a8a'); g.r(17, 23, 3, 5, '#3a7a8a');
    g.r(10, 27, 5, 4, '#7a4a2a'); g.r(17, 27, 5, 4, '#7a4a2a');
    g.r(11, 15, 10, 9, '#e08a30');                                           // gilet
    g.r(14, 15, 3, 9, '#f6f0e0', { flat: true }); g.r(11, 22, 10, 1, LEATHER, { flat: true });
    g.e(15, 10, 5, 5, SKIN);
    g.e(17, 9, 5, 5.5, '#f0c060'); g.e(14, 7, 4, 2, '#f0c060');               // cheveux
    g.e(15, 10, 3.5, 3.5, SKIN);
    g.e(16, 5, 7, 2.6, '#3a9a6a'); g.e(15, 7, 8.5, 1.2, '#2a7a50');           // chapeau
    g.p([[19, 4], [29, 0], [27, 3], [21, 6]], '#e04050'); g.l(21, 4, 28, 1, '#ff9aa8');
    g.r(11, 10, 1, 2, DARK, { flat: true }); g.r(14, 10, 1, 2, DARK, { flat: true });
    g.d(12, 13, '#d0705a');
    g.l(5, 14, 4, 24, GOLD, 2); g.l(10, 14, 11, 24, GOLD, 2);                // lyre
    g.r(4, 24, 9, 2, '#c89a30'); g.e(7.5, 14, 4, 1.5, GOLD);
    for (let x = 6; x <= 9; x++) g.l(x, 15, x, 23, '#fff6d0', 1, 0.8);
    g.e(11, 19, 2, 2, SKIN);
  }];

  // ---------- MONSTRES (tournés vers la droite) ----------
  D.goblin = [32, 32, g => {
    g.r(10, 28, 4, 3, '#5a9a3a'); g.r(18, 28, 4, 3, '#5a9a3a');
    g.p([[9, 14], [23, 14], [26, 29], [6, 29]], '#7a5a3a');                 // cape
    g.r(8, 25, 18, 1, '#5a3a20', { flat: true });
    g.e(16, 11, 8, 7, '#8a6a42');                                            // capuche
    g.e(18, 12, 4.5, 4.5, '#6fbf4a');                                        // visage
    g.p([[21, 12], [27, 14], [21, 15]], '#6fbf4a');                          // nez
    g.p([[9, 9], [2, 5], [6, 11]], '#6fbf4a');                               // oreille
    g.r(17, 10, 1, 2, '#ffe04a', { flat: true }); g.r(20, 10, 1, 2, '#ffe04a', { flat: true });
    g.r(17, 15, 4, 1, '#2a1a10', { flat: true }); g.d(18, 16, '#ffffff'); g.d(20, 16, '#ffffff');
    g.e(23, 21, 2, 2, '#6fbf4a');
    g.l(24, 19, 29, 13, '#e6eef8', 1); g.l(25, 19, 29, 14, '#9fb0c8', 1); g.r(22, 20, 3, 2, LEATHER, { flat: true });
  }];
  D.wolf = [32, 32, g => {
    g.p([[6, 15], [0, 10], [1, 17], [5, 20]], '#4a5878');                   // queue
    g.r(7, 20, 3, 9, '#3e4a66'); g.r(19, 21, 3, 8, '#3e4a66');             // pattes arrière-plan
    g.e(14, 18, 9.5, 5.5, '#5a6a8a');                                       // corps
    g.e(15, 21, 6, 2, '#8a9ab8', { flat: true });
    g.r(10, 21, 3, 8, '#5a6a8a'); g.r(22, 20, 3, 9, '#5a6a8a');
    g.r(9, 28, 4, 2, '#2a3048'); g.r(21, 28, 5, 2, '#2a3048');
    g.p([[19, 12], [24, 8], [28, 11], [26, 17], [20, 18]], '#6a7a9a');     // tête
    g.p([[25, 12], [31, 14], [31, 16], [25, 17]], '#6a7a9a');               // museau
    g.p([[20, 10], [21, 4], [24, 9]], '#5a6a8a'); g.p([[23, 9], [26, 4], [27, 11]], '#5a6a8a');
    g.d(25, 12, '#ff3040'); g.d(26, 12, '#ff9a60');
    g.d(31, 14, '#0a0a10'); g.r(26, 16, 5, 1, '#1a1a2a', { flat: true }); g.d(28, 17, '#ffffff');
    g.p([[13, 13], [15, 10], [17, 13]], '#3e4a66'); g.p([[9, 14], [11, 11], [13, 14]], '#3e4a66'); // fourrure
  }];
  D.slime = [32, 32, g => {
    g.e(16, 23, 12, 7.5, '#4fc860');
    g.e(16, 17, 7.5, 7, '#4fc860');
    g.p([[15, 10], [17, 5], [19, 11]], '#4fc860');
    g.e(11, 15, 2.2, 1.4, '#e8ffe8', { flat: true }); g.d(9, 18, '#e8ffe8'); g.d(22, 24, '#9af0a0');
    g.r(12, 19, 2, 3, '#123018', { flat: true }); g.r(19, 19, 2, 3, '#123018', { flat: true });
    g.d(12, 19, '#ffffff'); g.d(19, 19, '#ffffff');
    g.r(14, 24, 5, 1, '#123018', { flat: true }); g.d(15, 25, '#ff7a8a');
  }];
  D.shroom = [32, 32, g => {
    g.r(10, 28, 4, 3, '#7a5a3a'); g.r(18, 28, 4, 3, '#7a5a3a');
    g.e(16, 22, 6.5, 7, '#f0dcb0');                                          // pied
    g.e(8.5, 22, 2.2, 1.5, '#f0dcb0'); g.e(23.5, 22, 2.2, 1.5, '#f0dcb0');
    g.e(16, 12, 13, 7.5, '#d83a3a');                                         // chapeau
    g.r(4, 16, 24, 2, '#8a2028', { flat: true });
    g.e(10, 9, 2.4, 2, '#fff6ee', { flat: true }); g.e(19, 7, 2.6, 1.6, '#fff6ee', { flat: true });
    g.e(24, 12, 1.6, 1.6, '#fff6ee', { flat: true }); g.e(15, 13, 1.4, 1.2, '#fff6ee', { flat: true }); g.d(7, 13, '#fff6ee');
    g.r(13, 20, 1, 2, DARK, { flat: true }); g.r(18, 20, 1, 2, DARK, { flat: true });
    g.r(15, 24, 2, 1, DARK, { flat: true }); g.d(12, 23, '#f0a0a0'); g.d(19, 23, '#f0a0a0');
  }];
  D.orc = [48, 48, g => {
    g.r(15, 36, 6, 9, '#4a3a2a'); g.r(26, 36, 6, 9, '#4a3a2a');
    g.r(13, 43, 8, 4, '#2a2018'); g.r(26, 43, 9, 4, '#2a2018');
    g.e(10, 27, 4, 8, '#5a7a44');                                            // bras arrière
    g.e(23, 27, 11, 10, '#6a8a50');                                          // torse
    g.l(14, 19, 31, 35, LEATHER, 2);
    g.p([[16, 34], [30, 34], [32, 41], [14, 41]], '#9a2a2a');                // pagne
    g.r(14, 34, 18, 2, '#5a3a20', { flat: true }); g.e(23, 35, 2, 1.5, GOLD);
    g.e(29, 15, 7.5, 7, '#6a8a50');                                          // tête
    g.e(32, 20, 5.5, 3.5, '#7a9a5a');
    g.r(29, 11, 9, 2, '#3a4a2a', { flat: true });
    g.r(30, 13, 2, 2, '#ff3030', { flat: true }); g.r(35, 13, 2, 2, '#ff3030', { flat: true });
    g.p([[31, 21], [32, 16], [33, 21]], '#f6f0dc'); g.p([[36, 21], [37, 16], [38, 21]], '#f6f0dc'); // défenses
    g.e(28, 10, 8, 4, '#7a7a8a'); g.p([[22, 9], [16, 2], [24, 7]], '#e8dcc0'); g.p([[33, 7], [37, 0], [35, 8]], '#e8dcc0');
    g.l(40, 44, 41, 8, '#6a4a2a', 2);                                        // hache
    g.p([[41, 6], [47, 3], [47, 20], [42, 16]], '#c8d0dc'); g.l(46, 4, 46, 19, '#ffffff');
    g.e(37, 28, 4.5, 6, '#6a8a50'); g.e(39, 33, 3, 3, '#7a9a5a');            // bras avant
  }];
  D.treant = [64, 64, g => {
    g.p([[16, 52], [3, 63], [12, 63], [24, 56]], '#5a3a20'); g.p([[48, 52], [61, 63], [52, 63], [40, 56]], '#5a3a20');
    g.p([[28, 56], [26, 63], [36, 63], [34, 56]], '#5a3a20');
    g.l(20, 30, 5, 40, '#6a4a2a', 4); g.l(5, 40, 1, 36, '#6a4a2a', 2); g.l(5, 40, 3, 46, '#6a4a2a', 2); // bras
    g.l(44, 30, 59, 37, '#6a4a2a', 4); g.l(59, 37, 63, 33, '#6a4a2a', 2); g.l(59, 37, 62, 44, '#6a4a2a', 2);
    g.p([[20, 22], [44, 22], [49, 58], [15, 58]], '#7a5232');                // tronc
    for (const x of [22, 30, 38, 44]) g.l(x, 26, x - 2, 56, '#5a3a20', 1);
    g.e(32, 14, 22, 12, '#3a8a3a'); g.e(13, 22, 10, 8, '#347a34'); g.e(51, 22, 10, 8, '#347a34');
    g.e(32, 6, 14, 6, '#4aa04a'); g.e(22, 10, 8, 6, '#4aa04a');
    for (const [x, y] of [[20, 8], [34, 4], [44, 12], [12, 20], [52, 18], [28, 16], [40, 20]]) g.e(x, y, 2, 1.5, '#8ad86a', { flat: true });
    g.d(30, 3, '#ff6a8a'); g.d(46, 9, '#ff6a8a'); g.d(14, 18, '#ff6a8a');
    g.e(25, 34, 4, 2.5, '#1a0f08', { flat: true }); g.e(39, 34, 4, 2.5, '#1a0f08', { flat: true });
    g.r(25, 34, 2, 1, '#ffe04a', { flat: true }); g.r(39, 34, 2, 1, '#ffe04a', { flat: true });
    g.l(21, 30, 28, 32, '#3a2410', 1); g.l(43, 30, 36, 32, '#3a2410', 1);
    g.e(32, 45, 7, 4, '#1a0f08', { flat: true });
    for (let x = 27; x <= 37; x += 3) g.p([[x, 41], [x + 2, 41], [x + 1, 44]], '#c8b080', { flat: true });
    g.e(20, 50, 3, 2, '#5aa04a'); g.e(44, 48, 2.5, 1.6, '#5aa04a');
  }];
  D.bat = [32, 32, g => {
    const wing = [[14, 14], [1, 7], [0, 19], [4, 16], [6, 21], [9, 17], [12, 22], [15, 18]];
    g.p(wing, '#6a3a8a'); g.p(mirror(wing, 32), '#6a3a8a');
    g.l(14, 14, 2, 8, '#3a1a4a'); g.l(18, 14, 30, 8, '#3a1a4a');
    g.e(16, 17, 4.5, 5.5, '#4a2a6a');
    g.p([[13, 13], [12, 7], [15, 12]], '#4a2a6a'); g.p([[17, 12], [20, 7], [19, 13]], '#4a2a6a');
    g.d(14, 15, '#ff2a3a'); g.d(18, 15, '#ff2a3a');
    g.d(15, 19, '#ffffff'); g.d(17, 19, '#ffffff');
    g.r(14, 22, 1, 2, '#3a1a4a'); g.r(17, 22, 1, 2, '#3a1a4a');
  }];
  D.golem = [32, 32, g => {
    g.r(8, 24, 6, 7, '#6a6058'); g.r(18, 24, 6, 7, '#6a6058');
    g.r(1, 13, 6, 11, '#7a7066'); g.r(0, 23, 7, 5, '#6a6058');
    g.r(6, 11, 20, 14, '#8a8076');
    g.r(12, 3, 10, 9, '#9a9086');
    g.r(25, 13, 6, 11, '#8a8076'); g.r(25, 23, 7, 5, '#7a7066');
    g.l(9, 14, 12, 19, '#4a4038'); g.l(20, 15, 23, 21, '#4a4038'); g.l(14, 4, 16, 7, '#4a4038');
    g.e(9, 23, 2, 1, '#5a8a4a', { flat: true }); g.e(20, 5, 2, 1, '#5a8a4a', { flat: true }); g.d(3, 14, '#5a8a4a');
    g.r(17, 7, 4, 2, '#6ff0ff', { flat: true }); g.d(21, 7, '#ffffff');
    g.p([[16, 15], [18, 17], [16, 19], [14, 17]], '#6ff0ff', { flat: true });
  }];
  D.icelem = [32, 32, g => {
    g.p([[11, 21], [21, 21], [16, 31]], '#8ad0f0', { a: 0.9 });
    g.p([[11, 12], [21, 12], [21, 22], [11, 22]], '#bfeeff');
    g.l(11, 14, 5, 20, '#bfeeff', 2); g.l(21, 14, 26, 18, '#bfeeff', 2);
    g.p([[26, 15], [29, 18], [26, 21], [23, 18]], '#e0faff');
    g.e(16, 8, 4.5, 5, '#e6faff');
    g.p([[12, 6], [8, 0], [14, 4]], '#9fdcff'); g.p([[15, 4], [16, -1], [18, 4]], '#9fdcff'); g.p([[18, 5], [24, 0], [20, 8]], '#9fdcff');
    g.p([[12, 9], [9, 16], [13, 13]], '#9fdcff');
    g.d(16, 8, '#2050c0'); g.d(19, 8, '#2050c0'); g.d(16, 7, '#2050c0'); g.d(19, 7, '#2050c0');
    for (const [x, y] of [[4, 6], [27, 9], [3, 26], [28, 27]]) g.p([[x, y - 2], [x + 1.5, y], [x, y + 2], [x - 1.5, y]], '#e0faff', { flat: true });
    g.l(16, 13, 16, 21, '#ffffff', 1, 0.7);
  }];
  D.spider = [32, 32, g => {
    const legs = (c, t) => {
      for (let i = 0; i < 4; i++) {
        const by = 16 + i * 2, kx = 8 - i * 1.5, ky = 8 + i * 4, fx = 3 - i * 0.8, fy = 19 + i * 4;
        g.l(13, by, kx, ky, c, t); g.l(kx, ky, fx, fy, c, t);
        g.l(19, by, 32 - kx - t, ky, c, t); g.l(32 - kx - t, ky, 32 - fx - t, fy, c, t);
      }
    };
    legs('#2a1638', 2);
    g.e(16, 11, 8, 7, '#4a2a5a');                                            // abdomen
    g.p([[16, 6], [19, 10], [16, 14], [13, 10]], '#e03040', { flat: true });
    g.d(15, 8, '#ff8a9a');
    g.e(16, 20, 5.5, 4.5, '#3a2048');                                        // tête
    g.d(14, 19, '#ff3040'); g.d(18, 19, '#ff3040'); g.d(15, 18, '#ff8040'); g.d(17, 18, '#ff8040');
    g.d(13, 20, '#ff3040'); g.d(19, 20, '#ff3040');
    g.p([[14, 23], [15, 26], [16, 23]], '#f6f0dc', { flat: true }); g.p([[16, 23], [17, 26], [18, 23]], '#f6f0dc', { flat: true });
  }];
  D.wyvern = [48, 48, g => {
    g.p([[20, 26], [8, 4], [13, 9], [16, 3], [21, 11], [25, 5], [29, 22]], '#a83a3a');
    g.l(20, 26, 8, 4, '#4a6a3a', 1); g.l(22, 24, 16, 3, '#4a6a3a', 1); g.l(24, 23, 25, 5, '#4a6a3a', 1);
    g.p([[18, 29], [2, 24], [1, 27], [5, 28], [18, 34]], '#3a8a5a');
    g.r(17, 34, 4, 9, '#2e7048'); g.r(26, 34, 4, 9, '#2e7048');
    g.r(16, 42, 6, 2, '#e8dcc0', { flat: true }); g.r(25, 42, 6, 2, '#e8dcc0', { flat: true });
    g.e(23, 30, 10, 7.5, '#3a8a5a');
    g.e(25, 33, 6, 4, '#c8d890');
    g.p([[26, 27], [33, 15], [38, 17], [31, 31]], '#3a8a5a');
    g.e(37, 15, 6, 4.5, '#3a8a5a');
    g.p([[39, 12], [47, 14], [47, 17], [39, 19]], '#3a8a5a');
    g.r(40, 17, 7, 1, '#1a2a1a', { flat: true }); g.d(42, 18, '#ffffff'); g.d(45, 18, '#ffffff');
    g.p([[34, 11], [28, 5], [36, 10]], '#e8dcc0'); g.p([[37, 11], [36, 4], [39, 10]], '#e8dcc0');
    g.r(39, 13, 2, 1, '#ffe04a', { flat: true });
    g.p([[24, 20], [30, 22], [26, 26], [22, 25]], '#c04848');
  }];
  D.crystalgolem = [64, 64, g => {
    g.p([[20, 44], [29, 44], [28, 62], [17, 62]], '#5a6ad0'); g.p([[35, 44], [44, 44], [47, 62], [36, 62]], '#5a6ad0');
    const arm = [[4, 28], [14, 28], [13, 48], [2, 46]];
    g.p(arm, '#7a6ad8'); g.p(mirror(arm, 64), '#7a6ad8');
    g.p([[0, 46], [8, 44], [14, 50], [6, 56]], '#b8a8ff'); g.p(mirror([[0, 46], [8, 44], [14, 50], [6, 56]], 64), '#b8a8ff');
    g.p([[16, 22], [48, 22], [44, 46], [20, 46]], '#8a9ef0');
    g.l(32, 22, 32, 46, '#c8d8ff'); g.l(16, 22, 24, 46, '#6a7ad0'); g.l(48, 22, 40, 46, '#6a7ad0');
    const sh = [[8, 12], [21, 16], [23, 30], [6, 31], [2, 20]];
    g.p(sh, '#a98ef0'); g.p(mirror(sh, 64), '#a98ef0');
    g.p([[8, 13], [6, 2], [12, 12]], '#d8c8ff'); g.p([[14, 14], [15, 5], [18, 15]], '#d8c8ff');
    g.p(mirror([[8, 13], [6, 2], [12, 12]], 64), '#d8c8ff'); g.p(mirror([[14, 14], [15, 5], [18, 15]], 64), '#d8c8ff');
    g.p([[25, 6], [39, 6], [41, 17], [32, 22], [23, 17]], '#c6d4ff');
    g.p([[30, 6], [32, 0], [34, 6]], '#e8f0ff');
    g.r(27, 12, 10, 2, '#ff4af0', { flat: true }); g.r(30, 12, 4, 2, '#ffffff', { flat: true });
    g.p([[32, 27], [38, 33], [32, 41], [26, 33]], '#ff5ad0'); g.p([[30, 30], [32, 28], [33, 31]], '#ffffff', { flat: true });
    for (const [x, y] of [[20, 26], [44, 30], [24, 40]]) g.d(x, y, '#ffffff');
  }];
  D.specter = [32, 32, g => {
    g.p([[9, 12], [23, 12], [25, 24], [22, 31], [19, 26], [16, 31], [13, 26], [10, 31], [7, 24]], '#7a6ab8', { a: 0.82 });
    g.p([[8, 13], [3, 25], [6, 24], [5, 29], [10, 22]], '#4a3a78', { a: 0.85 });
    g.r(11, 13, 10, 8, '#5a5a7a');
    g.r(11, 17, 10, 1, '#9a9ac0', { flat: true });
    g.e(17, 8, 5, 5, '#6a6a8e');
    g.p([[14, 5], [10, 0], [16, 4]], '#9a9ac0'); g.p([[19, 4], [23, -1], [21, 5]], '#9a9ac0');
    g.r(16, 8, 6, 2, DARK, { flat: true }); g.d(18, 8, '#6ff0ff'); g.d(21, 8, '#6ff0ff');
    g.l(22, 25, 30, 4, '#d0d8ff', 2); g.l(23, 25, 31, 5, '#8a90c0', 1);
    g.r(20, 21, 5, 1, GOLD, { flat: true }); g.e(22, 22, 2, 2, '#5a5a7a');
  }];
  D.demon = [32, 32, g => {
    g.p([[12, 13], [1, 4], [3, 11], [0, 18], [7, 16], [12, 21]], '#4a1a2a');
    g.p([[20, 13], [31, 4], [29, 11], [31, 18], [25, 16], [20, 21]], '#4a1a2a');
    g.l(12, 13, 1, 4, '#2a0a18'); g.l(20, 13, 31, 4, '#2a0a18');
    g.l(12, 24, 6, 28, '#a02838', 1); g.p([[4, 27], [7, 26], [6, 30]], '#a02838');
    g.r(13, 24, 2, 6, '#a02838'); g.r(17, 24, 2, 6, '#a02838');
    g.r(12, 29, 4, 2, '#2a1a1a'); g.r(16, 29, 4, 2, '#2a1a1a');
    g.e(16, 19, 5.5, 6, '#c83040');
    g.e(16, 10, 4.5, 4.5, '#c83040');
    g.p([[13, 8], [9, 1], [14, 6]], '#e8dcc0'); g.p([[19, 8], [23, 1], [18, 6]], '#e8dcc0');
    g.r(15, 9, 1, 2, '#ffe04a', { flat: true }); g.r(18, 9, 1, 2, '#ffe04a', { flat: true });
    g.r(15, 13, 4, 1, '#3a0a10', { flat: true }); g.d(16, 13, '#ffffff');
    g.e(23, 19, 2, 2, '#c83040');
    g.e(25, 15, 2.5, 3.5, '#ff7a20', { flat: true }); g.e(25, 16, 1.4, 2, '#ffe04a', { flat: true }); g.d(25, 11, '#ff7a20');
  }];
  D.sentinel = [32, 32, g => {
    g.p([[7, 21], [12, 21], [10, 30], [4, 30]], '#5a5a6a'); g.p([[20, 21], [25, 21], [28, 30], [22, 30]], '#5a5a6a');
    g.r(3, 29, 9, 2, '#3a3a48'); g.r(20, 29, 10, 2, '#3a3a48');
    g.r(23, 14, 9, 4, '#4a4a5a'); g.r(30, 14, 2, 4, '#ff6a30', { flat: true });
    g.e(15, 16, 10, 7.5, '#8a8a9e');
    g.e(15, 10, 6.5, 4, '#5a5a6e');
    g.l(5, 16, 25, 16, '#5a5a6e');
    for (const x of [8, 12, 18, 22]) g.d(x, 19, '#d0d0e0');
    g.e(20, 15, 2.6, 2.6, '#ff2a2a'); g.d(19, 14, '#ffd0d0');
    g.l(12, 6, 10, 1, '#5a5a6e'); g.d(10, 0, '#ff3030');
    g.p([[4, 18], [1, 22], [5, 22]], '#6a6a7a');
  }];
  D.lich = [32, 32, g => {
    g.l(25, 4, 25, 31, '#3a2a2a', 2);
    g.e(25, 4, 2.6, 2.6, '#5aff8a'); g.d(24, 3, '#e0ffe8');
    g.e(16, 10, 6.5, 6.5, '#2a1a3a');
    g.p([[10, 13], [22, 13], [25, 31], [7, 31]], '#4a2a6a');
    for (let x = 7; x < 25; x += 3) g.p([[x, 31], [x + 3, 31], [x + 1.5, 28.5]], '#2a1a3a', { flat: true });
    g.r(15, 14, 2, 15, GOLD, { flat: true });
    g.e(16, 9, 4.5, 4.5, '#e8e0c8');
    g.e(15, 9, 1.2, 1.2, DARK, { flat: true }); g.e(18.5, 9, 1.2, 1.2, DARK, { flat: true });
    g.d(15, 9, '#ff3040'); g.d(18, 9, '#ff3040');
    g.r(15, 12, 4, 1, DARK, { flat: true }); g.d(16, 12, '#e8e0c8'); g.d(18, 12, '#e8e0c8');
    g.p([[11, 6], [21, 6], [22, 1], [19, 3], [16, 0], [13, 3], [10, 1]], GOLD);
    g.d(16, 3, '#ff3a6a');
    g.e(23, 18, 2, 1.5, '#e8e0c8');
  }];
  D.behemoth = [48, 48, g => {
    g.p([[9, 24], [1, 14], [3, 13], [11, 21]], '#5a3a8a'); g.e(2, 14, 2, 2, '#2a1a4a');
    g.r(10, 30, 6, 13, '#4a2e7a'); g.r(28, 31, 6, 12, '#4a2e7a');
    g.e(22, 27, 15, 10, '#6a4a9a');
    for (let x = 10; x <= 30; x += 4) g.p([[x, 19], [x + 2, 13], [x + 4, 19]], '#3a2060');
    g.r(16, 32, 6, 12, '#6a4a9a'); g.r(34, 31, 6, 13, '#6a4a9a');
    for (const x of [10, 16, 28, 34]) { g.d(x, 44, '#f6f0dc'); g.d(x + 3, 44, '#f6f0dc'); g.d(x + 5, 44, '#f6f0dc'); }
    g.e(38, 22, 7.5, 7, '#7a5aaa');
    g.p([[41, 23], [48, 25], [47, 31], [40, 31]], '#7a5aaa');
    g.r(41, 28, 7, 1, '#1a0a2a', { flat: true });
    g.p([[42, 28], [43, 24], [44, 28]], '#f6f0dc', { flat: true }); g.p([[46, 28], [47, 25], [47, 28]], '#f6f0dc', { flat: true });
    g.p([[34, 17], [27, 5], [31, 2], [38, 15]], '#e8dcc0'); g.p([[40, 16], [44, 3], [47, 5], [43, 17]], '#e8dcc0');
    g.r(40, 20, 2, 2, '#ff2a2a', { flat: true }); g.r(37, 19, 5, 1, '#3a2060', { flat: true });
  }];
  D.voiddragon = [64, 64, g => {
    g.p([[24, 30], [4, 2], [10, 11], [12, 4], [19, 14], [23, 6], [32, 24]], '#3a1a5a');
    g.l(24, 30, 4, 2, '#1a0a2a', 2); g.l(26, 28, 12, 4, '#1a0a2a'); g.l(28, 27, 23, 6, '#1a0a2a');
    g.p([[18, 40], [4, 46], [0, 58], [6, 54], [8, 50], [20, 46]], '#2a2a4a');
    g.p([[0, 58], [-2, 62], [4, 60]], '#ff4af0');
    g.r(20, 46, 7, 14, '#22223e'); g.r(19, 59, 9, 3, '#1a1a2e');
    g.e(29, 40, 14, 10.5, '#2e2e52');
    g.e(32, 44, 7, 6, '#6a5a8a');
    for (let y = 40; y <= 48; y += 3) g.r(27, y, 10, 1, '#4a3a6a', { flat: true });
    for (let x = 16; x <= 36; x += 5) g.p([[x, 32], [x + 2, 26], [x + 4, 31]], '#ff4af0');
    g.r(33, 48, 7, 12, '#2e2e52'); g.r(32, 59, 10, 3, '#1a1a2e');
    for (const x of [32, 35, 38, 41]) g.d(x, 62, '#f6f0dc');
    g.p([[34, 34], [43, 18], [49, 20], [43, 38]], '#2e2e52');
    g.e(48, 17, 7.5, 5.5, '#34345a');
    g.p([[50, 13], [63, 16], [63, 20], [50, 22]], '#34345a');
    g.r(52, 20, 11, 1, '#ff4af0', { flat: true }); g.d(54, 21, '#ffffff'); g.d(58, 21, '#ffffff'); g.d(61, 21, '#ffffff');
    g.p([[44, 13], [37, 3], [46, 10]], '#c8b8e8'); g.p([[48, 12], [47, 1], [51, 10]], '#c8b8e8');
    g.r(50, 15, 3, 2, '#ff4af0', { flat: true }); g.d(52, 15, '#ffffff');
    g.p([[40, 30], [54, 6], [58, 14], [62, 10], [62, 22], [56, 30], [48, 36]], '#4a2470', { a: 0.95 });
    g.l(40, 30, 54, 6, '#1a0a2a', 2); g.l(44, 32, 58, 14, '#1a0a2a'); g.l(47, 34, 62, 22, '#1a0a2a');
  }];

  const cache = {};
  function url(key) {
    if (cache[key]) return cache[key];
    const def = D[key];
    if (!def) return null;
    const [w, h, draw] = def;
    const g = new G(w, h);
    draw(g);
    g.outline();
    return (cache[key] = g.toURL());
  }
  const size = key => (D[key] ? D[key][0] : 32);
  return { url, size, keys: Object.keys(D) };
})();

// Balise <img> pixelisée prête à l'emploi
function spr(key, scale = 1, cls = '') {
  const u = PIXEL.url(key);
  if (!u) return '';
  return `<img class="px ${cls}" src="${u}" width="${PIXEL.size(key) * scale}" alt="" draggable="false">`;
}
