// Ported from the GatherSpace template (pure canvas drawing, no engine dependency).
import { seatKind } from '../assets/seats.ts';
import type { Character, Dir } from '../types.ts';
import { emotePose, type Pose } from './pose.ts';
import { drawReaction } from './reaction.ts';

const TAU = Math.PI * 2;

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** One arm, hanging from the shoulder and rotated by `raise` (0 down, PI/2 out to the side, PI up, negative in). */
function drawArm(g: CanvasRenderingContext2D, char: Character, side: -1 | 1, raise: number) {
  g.save();
  g.translate(side * 10, -6);
  g.rotate(-side * raise);
  g.fillStyle = char.shirt;
  g.fillRect(-2, 0, 4, 7);
  g.fillStyle = char.skin;
  g.fillRect(-2, 6.5, 4, 3.5);
  g.restore();
}

/** Parts of the hair that sit BEHIND the head (drawn before the face): the afro's cloud, a ponytail, the hood. */
function drawHairBehind(g: CanvasRenderingContext2D, char: Character) {
  g.fillStyle = char.hairColor;
  if (char.hairStyle === 'afro') {
    g.beginPath();
    g.arc(0, -21, 15.5, 0, TAU);
    g.fill();
  } else if (char.hairStyle === 'ponytail') {
    const side = char.dir === 'left' ? 1 : -1; // the tail swings out the side you are not facing
    if (char.dir === 'up') {
      g.beginPath();
      g.roundRect(-3.5, -24, 7, 17, 3.5);
      g.fill();
    } else {
      g.beginPath();
      g.roundRect(side === 1 ? 8 : -15, -24, 7, 15, 3.5);
      g.fill();
    }
  } else if (char.hairStyle === 'pigtails') {
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.roundRect(sx * 12.5 - 3, -24, 6, 13, 3);
      g.fill();
    }
  } else if (char.hairStyle === 'curly') {
    // the curls sit around and behind the face (they used to be painted over it, hiding the eyes)
    g.beginPath();
    for (const [cx, cy, r] of [[0, -26, 12.5], [-10, -19, 5.5], [10, -19, 5.5], [-8, -29, 5], [8, -29, 5]] as const) {
      g.moveTo(cx + r, cy); // a fresh start for each curl, or the path draws a line between them
      g.arc(cx, cy, r, 0, TAU);
    }
    g.fill();
  }
}

/** The shirt's pattern on top of the plain body shape. */
function drawShirtStyle(g: CanvasRenderingContext2D, char: Character) {
  const style = char.shirtStyle;
  if (!style || style === 'tee') return;
  if (char.dir === 'up' && (style === 'hoodie' || style === 'jacket')) {
    // from behind: no pocket, strings or zip. A hoodie shows its hood, a jacket its hem.
    g.fillStyle = shade(char.shirt, -0.16);
    if (style === 'hoodie') {
      g.beginPath();
      g.roundRect(-7, -8, 14, 7, 4);
      g.fill();
    } else {
      g.fillRect(-9, 4.5, 18, 1.8);
    }
    return;
  }
  g.save();
  g.beginPath();
  g.roundRect(-9, -8, 18, 14, 4);
  g.clip();
  if (style === 'stripes') {
    g.fillStyle = 'rgba(255, 255, 255, 0.42)';
    for (const y of [-5, -0.5, 4]) g.fillRect(-9, y, 18, 2.2);
  } else if (style === 'hoodie') {
    g.fillStyle = shade(char.shirt, -0.2);
    g.beginPath();
    g.roundRect(-6.5, 0.5, 13, 5, 2);
    g.fill();
    g.fillRect(-9, 5, 18, 1.5);
    g.fillStyle = 'rgba(255, 255, 255, 0.7)';
    g.fillRect(-3, -7, 1.2, 5);
    g.fillRect(1.8, -7, 1.2, 5);
  } else if (style === 'jacket') {
    g.fillStyle = shade(char.shirt, -0.28);
    g.fillRect(-0.7, -8, 1.4, 14);
    g.fillRect(-9, 4.5, 18, 1.8);
    g.fillStyle = 'rgba(255, 255, 255, 0.34)';
    g.beginPath();
    g.moveTo(-0.7, -8);
    g.lineTo(-6, -8);
    g.lineTo(-0.7, -2);
    g.closePath();
    g.moveTo(0.7, -8);
    g.lineTo(6, -8);
    g.lineTo(0.7, -2);
    g.closePath();
    g.fill();
  }
  g.restore();
}

function drawHairFront(g: CanvasRenderingContext2D, char: Character) {
  g.fillStyle = char.hairColor;
  switch (char.hairStyle) {
    case 'spiky':
      g.beginPath();
      g.roundRect(-11, -28, 22, 8, 4);
      g.fill();
      g.fillRect(-11, -24, 3, 7);
      g.fillRect(8, -24, 3, 7);
      break;
    case 'bob':
      g.beginPath();
      g.roundRect(-11, -28, 22, 8, 5);
      g.fill();
      g.fillRect(-12, -24, 4, 13);
      g.fillRect(8, -24, 4, 13);
      break;
    case 'long':
      g.beginPath();
      g.roundRect(-11, -28, 22, 8, 5);
      g.fill();
      g.fillRect(-12, -24, 4, 18);
      g.fillRect(8, -24, 4, 18);
      if (char.dir === 'up') g.fillRect(-10, -22, 20, 16);
      break;
    case 'curly':
      // a row of curls across the forehead; the rest is behind the head (drawHairBehind)
      g.beginPath();
      for (const cx of [-7.5, -2.5, 2.5, 7.5]) {
        g.moveTo(cx + 3.6, -25.5);
        g.arc(cx, -25.5, 3.6, 0, TAU);
      }
      g.fill();
      if (char.dir === 'up') {
        g.beginPath();
        g.arc(0, -17, 11, 0, TAU);
        g.fill();
      }
      break;
    case 'bun':
      g.beginPath();
      g.arc(0, -31, 5.5, 0, TAU);
      g.fill();
      g.beginPath();
      g.roundRect(-11, -27, 22, 7, 4);
      g.fill();
      break;
    case 'buzz':
      g.beginPath();
      g.roundRect(-10.5, -27, 21, 6, 4);
      g.fill();
      g.fillRect(-10.5, -23, 2, 4);
      g.fillRect(8.5, -23, 2, 4);
      if (char.dir === 'up') g.fillRect(-10, -23, 20, 7);
      break;
    case 'mohawk':
      g.beginPath();
      g.moveTo(-3.5, -25);
      g.lineTo(-2.5, -35);
      g.lineTo(-0.5, -28.5);
      g.lineTo(1, -37);
      g.lineTo(2.6, -29);
      g.lineTo(4, -34);
      g.lineTo(3.5, -25);
      g.closePath();
      g.fill();
      g.fillStyle = shade(char.hairColor, -0.35);
      g.fillRect(-10, -26, 20, 2.4);
      break;
    case 'ponytail':
      g.beginPath();
      g.roundRect(-11, -28, 22, 8, 5);
      g.fill();
      g.fillRect(-11.5, -24, 3.5, 8);
      g.fillRect(8, -24, 3.5, 8);
      break;
    case 'afro':
      g.beginPath();
      g.roundRect(-10.5, -28, 21, 6, 4);
      g.fill();
      break;
    case 'pigtails':
      g.beginPath();
      g.roundRect(-11, -28, 22, 8, 5);
      g.fill();
      g.fillRect(-11.5, -24, 3.5, 6);
      g.fillRect(8, -24, 3.5, 6);
      g.fillStyle = '#f43f5e';
      for (const sx of [-1, 1]) g.fillRect(sx * 12.5 - 3, -24.5, 6, 2.4);
      break;
    case 'bald':
      g.fillStyle = 'rgba(255, 255, 255, 0.22)';
      g.beginPath();
      g.ellipse(-3, -23.5, 3.2, 1.6, -0.3, 0, TAU);
      g.fill();
      break;
  }
}

function drawAccessory(g: CanvasRenderingContext2D, char: Character) {
  const front = char.dir !== 'up';
  const ox = char.dir === 'left' ? -2 : char.dir === 'right' ? 2 : 0;
  switch (char.accessory) {
    case 'glasses':
      if (!front) break;
      g.strokeStyle = '#38bdf8';
      g.lineWidth = 1.5;
      g.strokeRect(-7 + ox, -18, 5, 4.5);
      g.strokeRect(2 + ox, -18, 5, 4.5);
      g.beginPath();
      g.moveTo(-2 + ox, -16);
      g.lineTo(2 + ox, -16);
      g.stroke();
      break;
    case 'sunglasses':
      if (!front) break;
      g.fillStyle = '#0b1020';
      g.beginPath();
      g.roundRect(-7.5 + ox, -18.5, 6.5, 5, 1.5);
      g.roundRect(1 + ox, -18.5, 6.5, 5, 1.5);
      g.fill();
      g.fillRect(-1.5 + ox, -17.5, 3, 1.4);
      g.fillStyle = 'rgba(255, 255, 255, 0.6)';
      g.fillRect(-6.2 + ox, -17.6, 1.6, 1);
      g.fillRect(2.3 + ox, -17.6, 1.6, 1);
      break;
    case 'headphones':
      g.strokeStyle = '#f43f5e';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, -19, 12, Math.PI, 0);
      g.stroke();
      g.fillStyle = '#f43f5e';
      g.fillRect(-13, -19, 3.5, 7);
      g.fillRect(9.5, -19, 3.5, 7);
      break;
    case 'sunhat':
      g.fillStyle = '#fcd34d';
      g.beginPath();
      g.ellipse(0, -26, 15, 4, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#f59e0b';
      g.beginPath();
      g.roundRect(-8, -32, 16, 6, 3);
      g.fill();
      break;
    case 'crown': {
      const colors = ['#f472b6', '#facc15', '#60a5fa', '#f472b6'];
      for (let i = 0; i < 4; i++) {
        g.fillStyle = colors[i]!;
        g.beginPath();
        g.arc(-7.5 + i * 5, -26, 2.8, 0, TAU);
        g.fill();
      }
      break;
    }
    case 'catEars':
      for (const sx of [-1, 1]) {
        g.fillStyle = char.hairStyle === 'bald' ? char.skin : char.hairColor;
        g.beginPath();
        g.moveTo(sx * 10.5, -25);
        g.lineTo(sx * 9, -35);
        g.lineTo(sx * 3, -27);
        g.closePath();
        g.fill();
        g.fillStyle = '#f9a8d4';
        g.beginPath();
        g.moveTo(sx * 8.8, -27);
        g.lineTo(sx * 8.2, -32.5);
        g.lineTo(sx * 5, -27.5);
        g.closePath();
        g.fill();
      }
      break;
    case 'headband':
      g.fillStyle = '#f43f5e';
      g.fillRect(-10.5, -25, 21, 3);
      g.beginPath();
      g.moveTo(10.5, -25.5);
      g.arc(7.5, -25.5, 3, 0, TAU);
      g.moveTo(13.2, -27);
      g.arc(11, -27, 2.2, 0, TAU);
      g.fill();
      break;
    case 'partyHat':
      g.fillStyle = '#a855f7';
      g.beginPath();
      g.moveTo(-7, -26);
      g.lineTo(0, -41);
      g.lineTo(7, -26);
      g.closePath();
      g.fill();
      g.fillStyle = '#facc15';
      g.fillRect(-4.6, -31, 2, 2);
      g.fillRect(1.6, -35, 2, 2);
      g.fillRect(-0.4, -29, 2, 2);
      g.beginPath();
      g.arc(0, -41.5, 2.6, 0, TAU);
      g.fill();
      break;
    case 'beanie':
      g.fillStyle = '#38bdf8';
      g.beginPath();
      g.roundRect(-11, -31, 22, 10, 6);
      g.fill();
      g.fillStyle = '#0ea5e9';
      g.beginPath();
      g.roundRect(-11.5, -25, 23, 4, 2);
      g.fill();
      g.fillStyle = '#f8fafc';
      g.beginPath();
      g.arc(0, -32.5, 3.2, 0, TAU);
      g.fill();
      break;
    case 'flower':
      g.fillStyle = '#f9a8d4';
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(8.5 + Math.cos((i * TAU) / 5) * 2.8, -25 + Math.sin((i * TAU) / 5) * 2.8, 2.1, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#facc15';
      g.beginPath();
      g.arc(8.5, -25, 1.8, 0, TAU);
      g.fill();
      break;
    case 'bowtie':
      g.fillStyle = '#ef4444';
      g.beginPath();
      g.moveTo(0, -6.5);
      g.lineTo(-6, -9.5);
      g.lineTo(-6, -3.5);
      g.closePath();
      g.moveTo(0, -6.5);
      g.lineTo(6, -9.5);
      g.lineTo(6, -3.5);
      g.closePath();
      g.fill();
      g.fillStyle = '#b91c1c';
      g.fillRect(-1.6, -8.2, 3.2, 3.4);
      break;
  }
}

/** The head: skin, eyes, mouth, the front of the hair and the accessory. Drawn around (0, -16), the same for every posture. */
function drawFace(g: CanvasRenderingContext2D, char: Character, laugh: boolean, calm = false) {
  g.fillStyle = char.skin;
  g.beginPath();
  g.roundRect(-10, -25, 20, 18, 6);
  g.fill();

  if (char.dir !== 'up') {
    const eyeOffsetX = char.dir === 'left' ? -2 : char.dir === 'right' ? 2 : 0;
    g.fillStyle = 'rgba(244, 63, 94, 0.28)';
    g.fillRect(-8 + eyeOffsetX, -14, 3, 2);
    g.fillRect(5 + eyeOffsetX, -14, 3, 2);

    if (calm) {
      // resting: eyes closed, a small smile. This is also what tells a lying person from a standing one at a glance.
      g.strokeStyle = '#0f172a';
      g.lineWidth = 1.5;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(-3.7 + eyeOffsetX, -16.2, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
      g.arc(3.7 + eyeOffsetX, -16.2, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    } else {
      g.fillStyle = '#0f172a';
      g.fillRect(-5 + eyeOffsetX, -17, 2.5, 3.5);
      g.fillRect(2.5 + eyeOffsetX, -17, 2.5, 3.5);

      g.fillStyle = '#ffffff';
      g.fillRect(-4.5 + eyeOffsetX, -17, 1, 1);
      g.fillRect(3 + eyeOffsetX, -17, 1, 1);
    }

    if (calm && !laugh) {
      g.strokeStyle = '#7c2d12';
      g.lineWidth = 1.3;
      g.beginPath();
      g.arc(eyeOffsetX, -12.6, 2.6, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
    } else if (laugh) {
      g.fillStyle = '#7f1d1d';
      g.beginPath();
      g.ellipse(eyeOffsetX, -11.2, 2.8, 2.2, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#fb7185';
      g.fillRect(-1.2 + eyeOffsetX, -10.4, 2.4, 1);
    } else {
      g.fillStyle = '#7c2d12';
      g.fillRect(-2 + eyeOffsetX, -12, 4, 1.5);
    }
  }

  drawHairFront(g, char);
  drawAccessory(g, char);

}

const ease = (t: number) => t * t * (3 - 2 * t);

/** One leg-and-arm layout per posture and facing. All in the character's own frame: origin = tile centre, feet at +14 when standing. */
function drawSeatedLegs(g: CanvasRenderingContext2D, char: Character, dir: Dir, cross: boolean) {
  const pants = char.pants || '#1e293b';
  const shoe = '#0f172a';
  if (cross) {
    // sitting cross-legged: knees out to each side, the shins crossed in front
    g.fillStyle = pants;
    g.beginPath();
    g.arc(-10, 9.5, 3.8, 0, TAU);
    g.arc(10, 9.5, 3.8, 0, TAU);
    g.fill();
    g.beginPath();
    g.roundRect(-11, 8, 22, 6.5, 3.2);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.1)';
    g.fillRect(-9, 8.6, 18, 1.2);
    g.fillStyle = shoe;
    g.beginPath();
    g.roundRect(-6.5, 12, 6, 3.4, 1.6);
    g.roundRect(0.5, 12.6, 6, 3.4, 1.6);
    g.fill();
    return;
  }
  if (dir === 'up') return; // facing away: the legs are hidden behind the body
  if (dir === 'down') {
    for (const x of [-7, 1.5]) {
      g.fillStyle = pants;
      g.fillRect(x, 5, 5.5, 5.5); // thigh, foreshortened towards us
      g.fillRect(x + 0.4, 10, 4.8, 5.5); // shin hanging down
      g.fillStyle = 'rgba(0, 0, 0, 0.16)';
      g.fillRect(x, 9.6, 5.5, 1.1);
      g.fillStyle = shoe;
      g.fillRect(x - 0.6, 15, 6.4, 3);
    }
    return;
  }
  // from the side: thigh out in front, shin down
  const s = dir === 'right' ? 1 : -1;
  g.save();
  g.scale(s, 1);
  for (const [dx, dy, c] of [[0, -1.4, shade(pants, -0.22)], [0, 0, pants]] as const) {
    g.fillStyle = c;
    g.fillRect(-2 + dx, 5 + dy, 12, 5.2); // thigh
    g.fillRect(6 + dx, 9.6 + dy, 4.8, 6); // shin
    g.fillStyle = shoe;
    g.fillRect(6 + dx, 15 + dy, 7.2, 3);
  }
  g.restore();
}

function drawSeatedArms(g: CanvasRenderingContext2D, char: Character, dir: Dir) {
  if (dir === 'up') {
    g.fillStyle = char.shirt;
    g.fillRect(-12, -6, 4, 9);
    g.fillRect(8, -6, 4, 9);
    return;
  }
  if (dir === 'down') {
    // hands resting in the lap
    g.fillStyle = char.shirt;
    g.fillRect(-12, -6, 4, 10);
    g.fillRect(8, -6, 4, 10);
    g.fillStyle = char.skin;
    g.fillRect(-10.5, 3.4, 4, 3.4);
    g.fillRect(6.5, 3.4, 4, 3.4);
    return;
  }
  const s = dir === 'right' ? 1 : -1;
  g.save();
  g.scale(s, 1);
  g.fillStyle = char.shirt;
  g.fillRect(-3, -6, 4, 8); // upper arm
  g.fillRect(-1, 1, 8, 3.8); // forearm
  g.fillStyle = char.skin;
  g.fillRect(6.4, 1.2, 3.4, 3.6);
  g.restore();
}

/** Lying on a beach bed: head on the pillow, arms at the sides, feet up. Drawn with the head kept upright so the face reads. */
function drawLying(g: CanvasRenderingContext2D, char: Character, time: number, laugh: boolean, t: number) {
  const dir = char.sittingSeat?.dir ?? 'down';
  const rot = dir === 'down' ? 0 : dir === 'up' ? Math.PI : dir === 'left' ? Math.PI / 2 : -Math.PI / 2;
  // settling onto the bed: a little drop, then still. Breathing once there.
  const drop = -(1 - ease(t)) * 9 + Math.sin(time * 0.0021 + char.id.length) * 0.45 * ease(t);
  const hx = 12 * Math.sin(rot);
  const hy = -12 * Math.cos(rot);
  g.translate(0, drop);

  const head = () => {
    g.save();
    g.translate(hx, hy + 16.5);
    return () => g.restore();
  };
  // hair that sits behind the head, then the body, then the face on top
  let end = head();
  drawHairBehind(g, char);
  end();

  g.save();
  g.rotate(rot + (char.id.length % 2 ? 0.06 : -0.06)); // nobody lies perfectly straight
  g.scale(1, 0.8); // lying on the back: the body is foreshortened, which is what makes it read as lying
  g.fillStyle = char.pants || '#1e293b';
  g.beginPath();
  g.roundRect(-6.6, 6, 5.6, 14, 2);
  g.roundRect(1, 6, 5.6, 14, 2);
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.1)';
  g.fillRect(-6.4, 6, 1.2, 14);
  g.fillRect(1.2, 6, 1.2, 14);
  g.fillStyle = '#0f172a';
  g.beginPath();
  g.roundRect(-8.2, 19.4, 7, 4.2, 2);
  g.roundRect(1.2, 19.4, 7, 4.2, 2);
  g.fill();
  g.save();
  g.translate(0, 3.4);
  g.fillStyle = char.shirt;
  g.beginPath();
  g.roundRect(-9.6, -8, 19.2, 15, 4);
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.22)';
  g.fillRect(-4, -8, 8, 2);
  drawShirtStyle(g, { ...char, dir: 'down' });
  g.restore();
  g.fillStyle = char.shirt;
  g.fillRect(-13.4, -3, 3.8, 10);
  g.fillRect(9.6, -3, 3.8, 10);
  g.fillStyle = char.skin;
  g.fillRect(-13.4, 6.6, 3.8, 3.4);
  g.fillRect(9.6, 6.6, 3.8, 3.4);
  g.restore();

  end = head();
  drawFace(g, { ...char, dir: dir === 'up' ? 'down' : dir }, laugh, true);
  end();
}

export function drawCharacter(
  g: CanvasRenderingContext2D,
  char: Character,
  centerX: number,
  centerY: number,
  scale = 1,
  time = 0,
) {
  g.save();
  g.translate(centerX, centerY);
  g.scale(scale, scale);

  const seat = char.sittingSeat;
  const kind = seat ? seatKind(seat.style) : null;
  const isSitting = Boolean(seat);
  const settle = ease(char.sitT ?? 1);
  const pose: Pose | null = char.emote ? emotePose(char.emote.id, char.emote.age) : null;
  // seated people can wave and clap but not leap about: keep their arms, drop the body movement
  const bodyPose = pose && !isSitting ? pose : null;

  if (isSitting && kind?.posture === 'lie') {
    if (char.isPlayer) {
      g.strokeStyle = 'rgba(52, 211, 153, 0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(0, 3, seat!.dir === 'left' || seat!.dir === 'right' ? 28 : 17, seat!.dir === 'left' || seat!.dir === 'right' ? 15 : 27, 0, 0, TAU);
      g.stroke();
    }
    drawLying(g, char, time, Boolean(pose?.laugh), char.sitT ?? 1);
    g.restore();
    return;
  }

  const cross = kind?.posture === 'cross';
  const dir = char.dir;
  // sitting: the hips are lower than standing hips (more so in a beanbag), and we hop down into it
  const seatDrop = isSitting ? (3 + (kind?.sink ?? 0)) * settle - (1 - settle) * 5 : 0;

  const bounce = char.dancing
    ? Math.abs(Math.sin(time * 0.015)) * -7
    : bodyPose
    ? bodyPose.bob
    : char.moving
    ? Math.abs(Math.sin(char.walkFrame * 0.35)) * -3
    : Math.sin(time * 0.003 + (char.id.length * 1.7)) * (isSitting ? -0.5 : -1);

  const legSwing = char.moving ? Math.sin(char.walkFrame * 0.35) * 4 : 0;

  if (!isSitting) {
    // a seat casts its own shadow
    g.fillStyle = 'rgba(15, 23, 42, 0.35)';
    g.beginPath();
    g.ellipse(0, 14, 12, 5, 0, 0, TAU);
    g.fill();
  }

  if (char.isPlayer) {
    g.strokeStyle = 'rgba(52, 211, 153, 0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 14, 15, 6.5, 0, 0, TAU);
    g.stroke();
  }

  g.translate(bodyPose ? bodyPose.sway : 0, bounce + seatDrop);
  if (bodyPose?.tilt) {
    g.translate(0, 12);
    g.rotate(bodyPose.tilt);
    g.translate(0, -12);
  }
  if (bodyPose && bodyPose.spin !== null) g.scale(Math.cos(bodyPose.spin * TAU) || 0.02, 1);

  if (isSitting) {
    drawSeatedLegs(g, char, dir, cross);
  } else {
    g.fillStyle = char.pants || '#1e293b';
    g.fillRect(-6, 4 + legSwing * 0.5, 5, 9);
    g.fillRect(1, 4 - legSwing * 0.5, 5, 9);
    g.fillStyle = '#0f172a';
    g.fillRect(-6, 11 + legSwing * 0.5, 5, 3);
    g.fillRect(1, 11 - legSwing * 0.5, 5, 3);
  }

  // hood and hair that sit behind the body/head come first
  if (char.shirtStyle === 'hoodie') {
    g.fillStyle = shade(char.shirt, -0.12);
    g.beginPath();
    g.roundRect(-10, -12, 20, 8, 5);
    g.fill();
  }
  drawHairBehind(g, char);

  g.fillStyle = char.shirt;
  g.beginPath();
  g.roundRect(-9, -8, 18, 14, 4);
  g.fill();

  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(-4, -8, 8, 2);
  drawShirtStyle(g, char);

  if (pose && (pose.armL !== null || pose.armR !== null)) {
    drawArm(g, char, -1, pose.armL ?? 0);
    drawArm(g, char, 1, pose.armR ?? 0);
  } else if (isSitting) {
    drawSeatedArms(g, char, dir);
  } else {
    const armSwing = char.dancing ? Math.sin(time * 0.02) * 6 : char.moving ? -legSwing : 0;
    g.fillStyle = char.shirt;
    g.fillRect(-12, -6 + armSwing * 0.4, 4, 10);
    g.fillRect(8, -6 - armSwing * 0.4, 4, 10);
    g.fillStyle = char.skin;
    g.fillRect(-12, 2 + armSwing * 0.4, 4, 3);
    g.fillRect(8, 2 - armSwing * 0.4, 4, 3);
  }

  drawFace(g, char, Boolean(pose?.laugh));

  g.restore();
}

/**
 * How far to slide a speech bubble sideways so it stays inside the visible area. It never slides so
 * far that the tail (which points at the speaker, at x = 0) would leave the bubble.
 * `visible` is relative to the speaker, in world units; the bubble is drawn at `scale`.
 */
export function bubbleShift(width: number, scale: number, visible?: { minX: number; maxX: number }): number {
  if (!visible) return 0;
  const lo = visible.minX / scale + 8;
  const hi = visible.maxX / scale - 8;
  let shift = 0;
  if (-width / 2 < lo) shift = lo + width / 2;
  else if (width / 2 > hi) shift = hi - width / 2;
  const limit = Math.max(0, width / 2 - 18);
  return Math.max(-limit, Math.min(limit, shift));
}

/** A bubble belongs to a person you can see: if they are off screen it would only be a clipped fragment at the edge. */
export function bubbleVisible(visible?: { minX: number; maxX: number }): boolean {
  return !visible || (visible.minX < -6 && visible.maxX > 6);
}

const UI_FONT = "'Instrument Sans Variable', Inter, system-ui, sans-serif"

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Overshoots a little before settling: the bubble "pops" into place. */
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Greedy word wrap into at most `maxLines` lines, ending the last one with an ellipsis if text is left over. */
function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  const fits = (t: string) => g.measureText(t).width <= maxW
  for (let word of words) {
    // a single very long word (a URL, keyboard mash) is cut to fit rather than overflowing the bubble
    while (!fits(word) && word.length > 1) {
      let n = word.length - 1
      while (n > 1 && !fits(word.slice(0, n))) n--
      if (line) {
        lines.push(line)
        line = ''
      }
      lines.push(word.slice(0, n))
      word = word.slice(n)
    }
    const next = line ? `${line} ${word}` : word
    if (fits(next)) line = next
    else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]!
  while (last.length > 1 && !fits(last + '…')) last = last.slice(0, -1)
  kept[maxLines - 1] = last.trimEnd() + '…'
  return kept
}

/** What a name tag shows: the first name only ("Ada Lovelace" -> "Ada"). A name that is all spaces falls back to itself. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The text on a name tag: "You" on your own character (your name is for everyone else to read), otherwise the first name plus any flair. */
export function tagLabel(char: Pick<Character, 'isPlayer' | 'name' | 'flair'>): string {
  return (char.isPlayer ? 'You' : firstName(char.name)) + (char.flair ? ' ' + char.flair : '');
}

/** Top edge of a name tag above a standing person, in px from their tile centre (negative = up). */
const TAG_Y = -62;

/** How far the head sits lower than when standing (sitting in a seat, sinking into a beanbag, lying down), so the tag follows it. */
function tagDrop(char: Character): number {
  const seat = char.sittingSeat;
  if (!seat) return 0;
  const k = seatKind(seat.style);
  const settle = ease(char.sitT ?? 1);
  return (k.posture === 'lie' ? 9 : 3 + k.sink) * settle;
}

/**
 * Name tag, speech bubble and reaction above a person. `scale` grows them when the camera is zoomed
 * out (a phone shows the whole room small) so the text stays readable.
 */
export function drawCharacterOverlays(
  g: CanvasRenderingContext2D,
  char: Character,
  time: number,
  scale = 1,
  /** the part of the screen that is visible, as x offsets from this person (world units) */
  visible?: { minX: number; maxX: number },
) {
  g.save();
  g.translate(char.x, char.y);
  g.scale(scale, scale);

  const tagText = tagLabel(char);
  g.font = `600 12px ${UI_FONT}`;
  const textWidth = g.measureText(tagText).width;
  const pillW = textWidth + 26;
  const pillH = 22;
  const pillX = -pillW / 2;
  // clear of the tallest hair, hats and crowns (they reach about 42 above the tile centre), and it follows the head down
  // when somebody sinks into a beanbag or lies on a bed
  const pillY = TAG_Y + tagDrop(char);

  g.fillStyle = 'rgba(12, 18, 38, 0.9)';
  g.beginPath();
  g.roundRect(pillX, pillY, pillW, pillH, 999);
  g.fill();
  g.strokeStyle = char.isPlayer ? 'rgba(52, 211, 153, 0.75)' : 'rgba(255, 255, 255, 0.18)';
  g.lineWidth = 1;
  g.stroke();

  if (char.status === 'vibing') {
    g.font = '10px sans-serif';
    g.fillText('🎧', pillX + 5, pillY + 14.5);
  } else {
    g.fillStyle = char.status === 'busy' ? '#fbbf24' : '#34d399';
    g.beginPath();
    g.arc(pillX + 11, pillY + pillH / 2, 3.6, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#f8fafc';
  g.font = `600 12px ${UI_FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(tagText, pillX + 20, pillY + pillH / 2 + 0.5);

  let topOffset = pillY - 8;
  const b = char.speechBubble;
  if (b && b.timer > 0 && bubbleVisible(visible)) {
    const pop = easeOutBack(clamp01(b.age / 200));
    const fade = clamp01(b.timer / 400);
    const rise = (1 - fade) * 8;

    g.save();
    g.globalAlpha *= fade;
    g.font = `500 13.5px ${UI_FONT}`;
    const lines = wrapLines(g, b.text, 200, 3);
    const lineH = 18;
    const padX = 12;
    const padY = 8;
    const labelH = b.dm ? 15 : 0;
    const widest = Math.max(...lines.map((l) => g.measureText(l).width), b.dm ? 44 : 0);
    const w = Math.max(40, widest + padX * 2);
    const h = lines.length * lineH + padY * 2 + labelH;
    const tail = 7;
    const by = topOffset - tail - h;
    // keep the whole bubble on screen; the tail still points at the speaker
    const shift = bubbleShift(w, scale, visible);

    // grow out of the tail tip, so it reads as coming from the person
    g.translate(0, topOffset - rise);
    g.scale(pop, pop);
    g.translate(0, -topOffset);

    g.shadowColor = 'rgba(8, 12, 30, 0.35)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 3;
    g.fillStyle = b.dm ? '#3454f0' : '#ffffff';
    g.beginPath();
    g.roundRect(-w / 2 + shift, by, w, h, 14);
    g.moveTo(-7, by + h - 0.5);
    g.lineTo(7, by + h - 0.5);
    g.lineTo(0, by + h + tail);
    g.closePath();
    g.fill();
    g.shadowColor = 'transparent';

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let ty = by + padY;
    if (b.dm) {
      g.font = `600 10.5px ${UI_FONT}`;
      g.fillStyle = 'rgba(255, 255, 255, 0.78)';
      g.fillText('Private', shift, ty + 7);
      ty += labelH;
    }
    g.font = `500 13.5px ${UI_FONT}`;
    g.fillStyle = b.dm ? '#ffffff' : '#0f172a';
    for (const line of lines) {
      g.fillText(line, shift, ty + lineH / 2);
      ty += lineH;
    }
    g.restore();
    topOffset = by - 8;
  }

  if (char.reaction && char.reaction.timer > 0) drawReaction(g, char.reaction, topOffset, time);

  g.restore();
}
