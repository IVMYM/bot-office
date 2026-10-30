// Motion Prompt #001-024 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#001
//
// Kit for pack "motion" — shared helpers for elements #006 and #010 in this project.

export const MOTION_CARD = { w: 539, h: 208, cycle: 4.7 };

const C = {
  navy: "#0F1A3D", navy2: "#1B2A5E", blue: "#3B7BFF", coral: "#FF6B5C", yel: "#FFC83D", mint: "#2EDBA8",
};
const JP = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const mod = (a, n) => ((a % n) + n) % n;
const spring = (t, w = 14, d = 7) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(w * t));

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function txt(ctx, s, x, y, font, col, align = "left", base = "alphabetic") {
  ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
}

/** Motion Prompt #010 — spring value toward `target` (0–1), play-once entrance timing from spec. */
export function overshootSpringValue(localU, target) {
  if (localU < 0.25) return 0;
  const t = localU - 0.25;
  if (t >= 3.45) return target;
  return target * (1 - Math.exp(-4.6 * t) * Math.cos(10.5 * t));
}

// Motion Prompt #010 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#010
export function drawOvershootGauge(ctx, w, h, v, target) {
  const TG = target;
  const X = w / 2, Y = h - 26, R = Math.min(128, w * 0.45);
  const ang = (x) => Math.PI + x * Math.PI;
  ctx.lineCap = "round";
  ctx.strokeStyle = C.navy2; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(X, Y, R, ang(0), ang(1)); ctx.stroke();
  if (v > 0.005) {
    const g = ctx.createLinearGradient(X - R, 0, X + R, 0);
    g.addColorStop(0, C.blue); g.addColorStop(1, C.mint);
    ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(X, Y, R, ang(0), ang(v)); ctx.stroke();
  }
  if (v > TG + 0.004) {
    ctx.strokeStyle = C.coral; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.arc(X, Y, R, ang(TG), ang(v)); ctx.stroke(); ctx.lineCap = "round";
  }
  const ta = ang(TG);
  ctx.strokeStyle = C.yel; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(X + Math.cos(ta) * (R - 22), Y + Math.sin(ta) * (R - 22));
  ctx.lineTo(X + Math.cos(ta) * (R + 30), Y + Math.sin(ta) * (R + 30)); ctx.stroke();
  ctx.fillStyle = C.yel; ctx.beginPath(); ctx.arc(X + Math.cos(ta) * (R + 38), Y + Math.sin(ta) * (R + 38), 8, 0, 7); ctx.fill();
  const a = ang(v);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * (R - 26), Y + Math.sin(a) * (R - 26)); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X, Y, 17, 0, 7); ctx.fill();
  ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(X, Y, 8, 0, 7); ctx.fill();
}

/** Motion Prompt #006 — typewriter timing constants from spec. */
export const TYPEWRITER = { t0: 0.3, dt: 0.24, popK: 16, popA: 0.35, blinkPeriod: 0.94, blinkOn: 0.5 };

export function typewriterCharCount(u, len) {
  const { t0, dt } = TYPEWRITER;
  const done = t0 + len * dt;
  if (u < t0) return 0;
  if (u >= done) return len;
  return clamp(Math.floor((u - t0) / dt) + 1, 0, len);
}

export function typewriterCharScale(u, charIndex) {
  const age = u - (TYPEWRITER.t0 + charIndex * TYPEWRITER.dt);
  if (age < 0) return 0;
  return 1 + TYPEWRITER.popA * Math.exp(-age * TYPEWRITER.popK);
}

export function typewriterCursorVisible(u, len) {
  const { t0, dt, blinkPeriod, blinkOn } = TYPEWRITER;
  const done = t0 + len * dt;
  const typing = u >= t0 - 0.05 && u < done + 0.1;
  return typing ? 1 : (mod(u, blinkPeriod) < blinkOn ? 1 : 0);
}

// Motion Prompt #006 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#006
export function drawTypewriter(ctx, w, h, u, text) {
  ctx.fillStyle = C.navy; ctx.fillRect(0, 0, w, h);
  const S = text, N = [...S].length, { t0, dt } = TYPEWRITER;
  const done = t0 + N * dt;
  const BX = 34, BY = 58, BW = w - 68, BH = 92;
  const sendT = done + 0.55, clr = P(u, sendT + 0.12, sendT + 0.4);
  ctx.fillStyle = "#fff"; rr(ctx, BX, BY, BW, BH, 30); ctx.fill();
  const f = `600 36px ${JP}`; ctx.font = f;
  let n = typewriterCharCount(u, N);
  let x = BX + 32; const y = BY + BH / 2 + 2;
  ctx.save(); rr(ctx, BX, BY, BW - 86, BH, 30); ctx.clip();
  [...S].slice(0, n).forEach((ch, i) => {
    const pop = typewriterCharScale(u, i), cw = ctx.measureText(ch).width;
    ctx.save(); ctx.translate(x + cw / 2, y - clr * 70); ctx.scale(pop, pop); ctx.globalAlpha = 1 - clr;
    txt(ctx, ch, 0, 0, f, C.navy, "center", "middle"); ctx.restore(); ctx.font = f; x += cw + 1;
  });
  ctx.restore();
  if (clr > 0.5) x = BX + 32;
  if (typewriterCursorVisible(u, N)) {
    ctx.fillStyle = C.coral; rr(ctx, x + 4, y - 23, 5, 44, 2.5); ctx.fill();
  }
  const on = spring(u - done - 0.12, 15, 6.5) * (1 - P(u, sendT + 0.5, sendT + 0.8));
  const press = 1 - 0.2 * Math.sin(Math.PI * P(u, sendT - 0.05, sendT + 0.2));
  const bx = BX + BW - 48, by = BY + BH / 2;
  ctx.fillStyle = "#DDE3F3"; ctx.beginPath(); ctx.arc(bx, by, 30, 0, 7); ctx.fill();
  if (on > 0.01) {
    ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(bx, by, 30 * Math.min(on, 1.25) * press, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(bx, by + 12); ctx.lineTo(bx, by - 12);
  ctx.moveTo(bx - 11, by - 2); ctx.lineTo(bx, by - 13); ctx.lineTo(bx + 11, by - 2); ctx.stroke();
}
