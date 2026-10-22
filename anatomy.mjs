import * as k from './vendor/anatomy-kit/iso-kit.mjs';
import * as G from './vendor/anatomy-kit/lathe.mjs';
import { tubePieces, tubeSvg } from './vendor/anatomy-kit/tube.mjs';

// A fixed assembly drawing, deliberately independent of the live crank angle.
// The adjacent 3D view carries the continuous kinematic model. Coordinates here
// are relative teaching dimensions, not a manufacturing specification.
const W = 800, H = 620;
const P = k.fitProjection([
  ...k.boxCorners({ x: -77, y: -50, w: 154, d: 157 }, -5, 18),
  [-50, -35, 253], [50, 30, 253], [0, 109, 110],
], W, H, { pad: 66, azimuth: 52, elevation: 24 });
const Z = G.frameAlong([0, 0, 0], [0, 0, 1]);
const CRANK = [0, 0, 57], PIN = [21, 0, 72], WRIST = [0, 0, 141];
const Y = G.frameAlong(CRANK, [0, 1, 0]);
const SVG_LABEL = '单缸四冲程汽油机等距半剖结构定位图：气缸、气缸盖、双气门、火花塞、活塞、连杆、曲轴和飞轮。此图为固定结构姿态。';
const PART_NAMES = {
  cylinder: '气缸', head: '气缸盖', intake: '进气门', exhaust: '排气门',
  spark: '火花塞', piston: '活塞', rod: '连杆', crank: '曲轴', flywheel: '飞轮',
};

/* Physical entities in this Figure (66): bed 1, feet 4, mounting lugs 2,
 * sump 1, crankcase 1, main bearings 2, shaft 1, webs 2, crankpin 1,
 * bearing saddles 2, connecting rod 1, end eyes 2, cap bolts 2, piston 1,
 * crown 1, rings 3, wrist pin 1, sleeve 1, cooling fins 7, cylinder flange 1,
 * head casting 1, deck 1, head studs 4, two valves of 5 entities each,
 * spark plug of 4 entities, flywheel rim 1, spokes 6, hub 1, shaft key 1.
 * A split front/rear shell is one entity, not two counted parts.
 */
export const ANATOMY_ENTITY_COUNT = 66;

const s = (shape, tone = 'hi', inner = '') => k.solidSvg(shape, { tone, inner });
const l = (path, tone = 'lo') => k.lineSvg(path, { tone });
const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const slab = (x, y, w, d, z, h, r = 2, tone = 'mid', inner = '') => s(k.slabOf({ x, y, w, d, r }, z, h, P, 6, .6), tone, inner);
const vertical = (x, y, z, h, r, tone = 'hi') => s(k.cylinder(x, y, r, z, h, P, 48, .35), tone);
const axial = (F, from, to, r, tone = 'hi') => s(G.disc(from, to, r, F, P), tone);
const rim = (F, from, to, ri, ro, tone = 'hi') => s(G.ringBand(from, to, ri, ro, F, P), tone);
const entity = (name, svg) => `<g data-entity="${esc(name)}">${svg}</g>`;
const part = (id, svg, extra = '') => `<g data-part="${id}" aria-label="${PART_NAMES[id]}" ${extra}>${svg}</g>`;
const assembly = (id, svg) => `<g data-assembly="${id}">${svg}</g>`;

function halfAnnulus(ro, ri, front = false, steps = 64) {
  const from = front ? 0 : Math.PI;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + Math.PI * i / steps;
    return [Math.cos(a) * ro, Math.sin(a) * ro];
  });
  for (let i = steps; i >= 0; i--) {
    const a = from + Math.PI * i / steps;
    points.push([Math.cos(a) * ri, Math.sin(a) * ri]);
  }
  return points;
}
function halfSleeve(ro, ri, z, h, front = false, tone = 'mid') {
  return s(k.extrude(halfAnnulus(ro, ri, front), z, h, P, { convex: false }), tone);
}
function bolt(x, y, z, r = 2.4) {
  const screw = k.ring(x, y, r * .58, z + 2.4, P, 24);
  return vertical(x, y, z, 2.4, r, 'mid') + l(screw, 'lo');
}

function bed() {
  const out = [];
  const plan = { x: -72, y: -47, w: 144, d: 147, r: 8 };
  out.push(`<path class="iso-halo" d="${k.haloOf(plan, -5, 3, P)}"/>`);
  for (const [i, [x, y]] of [[-57, -31], [57, -31], [-57, 84], [57, 84]].entries()) {
    out.push(entity(`橡胶机脚-${i + 1}`, vertical(x, y, -4, 8, 8, 'lo')));
  }
  out.push(entity('教学机座', slab(-72, -47, 144, 147, 4, 8, 8, 'mid', l(k.planOutline(k.insetPlan(plan, 5), 12, P), 'faint'))));
  for (const [i, x] of [-48, 35].entries()) {
    out.push(entity(`安装支脚-${i + 1}`, slab(x, -28, 14, 60, 12, 8, 3, 'mid') + bolt(x + 7, 23, 20, 2.6)));
  }
  out.push(entity('油底壳', slab(-40, -29, 80, 59, 20, 15, 7, 'mid', l(k.sideSeam({ x: -40, y: -29, w: 80, d: 59, r: 7 }, 26, P, 6), 'faint'))));
  return out.join('');
}

function rearCrankcase() {
  const back = [];
  // The open service face is the y=0 plane. This shell sits behind the crank.
  back.push(entity('曲轴箱后壳', slab(-40, -31, 80, 15, 35, 65, 5, 'mid')));
  for (const [i, y] of [-22, 25].entries()) {
    back.push(entity(`主轴承座-${i + 1}`, slab(-15, y - 7, 30, 14, 35, 10, 3, 'mid')));
  }
  back.push(entity('后主轴承', rim(Y, -24, -15, 7.2, 13, 'mid')));
  return part('cylinder', back.join(''));
}

function frontCrankcase() {
  // The mating half of the same cast crankcase; it is not a second entity.
  return part('cylinder', slab(-40, -1, 80, 33, 35, 65, 5, 'mid'), 'data-front-shell');
}

function crankshaft() {
  const out = [];
  out.push(entity('曲轴主轴颈', axial(Y, -24, 75, 6.7)));
  out.push(entity('后曲柄臂', axial(Y, -12, -5, 27, 'mid')));
  const CF = G.frameAlong(PIN, [0, 1, 0]);
  out.push(entity('连杆轴颈', axial(CF, -5, 7, 7.4, 'hi')));
  out.push(entity('前曲柄臂', axial(Y, 7, 14, 27, 'mid')));
  out.push(entity('前主轴承', rim(Y, 19, 29, 7.2, 13, 'mid')));
  return part('crank', out.join(''));
}

function connectingRod() {
  const delta = G.sub3(WRIST, PIN), length = G.len3(delta), along = G.unit3(delta);
  const F = G.frameOf(PIN, [0, 1, 0], along, G.cross3([0, 1, 0], along));
  const out = [];
  const bar = [[8, -4.4], [length - 5, -3.5], [length - 5, 3.5], [8, 4.4]];
  out.push(entity('连杆杆身', s(G.prismOf(F, bar, -3.8, 3.8, P), 'hi')));
  out.push(entity('连杆大头', rim(G.frameAlong(PIN, [0, 1, 0]), -5, 7, 7.5, 12, 'hi')));
  out.push(entity('连杆小头', rim(G.frameAlong(WRIST, [0, 1, 0]), -6, 6, 5.2, 9, 'hi')));
  for (const [i, x] of [PIN[0] - 9, PIN[0] + 9].entries()) {
    out.push(entity(`连杆盖螺栓-${i + 1}`, axial(G.frameAlong([x, 3.5, PIN[2] - 4], [0, 0, 1]), -4, 4, 1.7, 'mid')));
  }
  return part('rod', out.join(''));
}

function piston() {
  const out = [];
  const F = G.frameAlong([0, 0, 126], [0, 0, 1]);
  out.push(entity('活塞裙部', s(G.solidOf([[0, 27.7], [1, 28.2], [28, 28.2], [30, 27.9]], F, P), 'hi')));
  out.push(entity('活塞顶', axial(F, 30, 33, 28.2, 'hi')));
  for (const [i, z] of [148, 152, 156].entries()) {
    out.push(entity(`活塞环-${i + 1}`, rim(Z, z, z + 1.15, 27.7, 29, 'mid')));
  }
  out.push(entity('活塞销', axial(G.frameAlong(WRIST, [0, 1, 0]), -28.2, 28.8, 5, 'hi')));
  return part('piston', out.join(''));
}

function cylinder(front = false) {
  const out = [];
  const one = (name, html) => front ? html : entity(name, html);
  out.push(one('气缸套', halfSleeve(39, 30, 101, 85, front, 'hi')));
  for (let i = 0; i < 7; i++) {
    out.push(one(`散热翅片-${i + 1}`, halfSleeve(i === 0 || i === 6 ? 46 : 49, 39, 107 + i * 11, 3.3, front, 'mid')));
  }
  out.push(one('气缸安装法兰', halfSleeve(46, 30, 97, 5, front, 'mid')));
  return part('cylinder', out.join(''), front ? 'data-front-shell' : '');
}

function head(front = false) {
  const out = [];
  if (front) {
    out.push(slab(-45, 0, 90, 34, 186, 25, 6, 'mid'));
  } else {
    out.push(entity('气缸盖铸件', slab(-45, -34, 90, 25, 186, 25, 6, 'mid')));
    out.push(entity('缸盖接合面', slab(-45, -34, 90, 34, 183, 3, 5, 'mid')));
    for (const [i, [x, y]] of [[-36, -23], [36, -23], [-36, 22], [36, 22]].entries()) {
      out.push(entity(`缸盖紧固螺柱-${i + 1}`, vertical(x, y, 186, 29, 2.3, 'mid') + bolt(x, y, 215, 3.1)));
    }
  }
  return part('head', out.join(''), front ? 'data-front-shell' : '');
}

function valve(id, x, radius) {
  const out = [], F = G.frameAlong([x, 5, 184], [0, 0, 1]);
  // One poppet, guide, return spring and retainer at each port. Intake is larger.
  out.push(entity(`${PART_NAMES[id]}菌形阀盘`, s(G.solidOf([[0, radius], [1.4, radius], [3.8, 5], [5.5, 2.2]], F, P, { smooth: false }), 'hi')));
  out.push(entity(`${PART_NAMES[id]}阀杆`, axial(F, 5.5, 60, 2.1, 'hi')));
  out.push(entity(`${PART_NAMES[id]}导管`, rim(F, 19, 33, 2.2, 4.8, 'mid')));
  const spring = Array.from({ length: 221 }, (_, i) => {
    const t = i / 220, a = Math.PI * 2 * 5 * t;
    return [x + 6.4 * Math.cos(a), 5 + 6.4 * Math.sin(a), 216 + 22 * t];
  });
  const pieces = tubePieces(spring, .83, P, { spacing: .8, maxLength: 8, stripes: false });
  pieces.sort((a, b) => k.depthOf(a.mid, P) - k.depthOf(b.mid, P));
  out.push(entity(`${PART_NAMES[id]}回位弹簧`, pieces.map((p) => tubeSvg(p, { tone: 'mid' })).join('')));
  out.push(entity(`${PART_NAMES[id]}弹簧座`, axial(F, 54.2, 57, 8, 'hi')));
  return part(id, out.join(''));
}

function spark() {
  const F = G.frameAlong([0, -8, 193], [0, 0, 1]), out = [];
  out.push(entity('火花塞金属壳及电极', s(G.solidOf([[0, 1.8], [4, 1.8], [5, 3.4], [22, 3.4], [23, 5.4], [27, 5.4]], F, P), 'hi')));
  const hex = Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3) * 7.4, Math.sin(i * Math.PI / 3) * 7.4]);
  out.push(entity('火花塞六角座', s(G.prismOf(F, hex, 27, 32.5, P), 'hi')));
  const ceramic = [[32.5, 4.5], [35, 4.5]];
  for (let i = 0; i < 5; i++) ceramic.push([36 + i * 3, 5.3], [37.5 + i * 3, 4.2]);
  ceramic.push([51, 3.3], [55, 3.3]);
  out.push(entity('火花塞陶瓷绝缘体', s(G.solidOf(ceramic, F, P, { smooth: false }), 'hi')));
  out.push(entity('火花塞接线端', axial(F, 55, 60, 2.5, 'mid')));
  return part('spark', out.join(''));
}

function flywheel() {
  const F = G.frameAlong([0, 74, CRANK[2]], [0, 1, 0]), out = [];
  out.push(entity('飞轮轮缘', rim(F, -5, 5, 37.5, 48.5, 'mid')));
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + .12;
    const xy = (r, w) => [r * Math.cos(a) - w * Math.sin(a), r * Math.sin(a) + w * Math.cos(a)];
    const polygon = [xy(9, -4.5), xy(38.5, -5), xy(38.5, 5), xy(9, 4.5)];
    out.push(entity(`飞轮轮辐-${i + 1}`, s(G.prismOf(F, polygon, -3, 3, P), 'mid')));
  }
  out.push(entity('飞轮轮毂', rim(F, -7, 8, 6.8, 12, 'hi')));
  out.push(entity('飞轮轴键', s(G.prismOf(F, [[-1.8, 6], [1.8, 6], [1.8, 9], [-1.8, 9]], 4, 10, P), 'hi')));
  return part('flywheel', out.join(''));
}

const STYLE = `<style>
.engine-anatomy{--anatomy-paper:#faf9f6;--anatomy-top:#edf0e9;--anatomy-shade-0:#b7c5ba;--anatomy-shade-1:#c6d1c6;--anatomy-shade-2:#d9e0d9;--anatomy-shade-3:#e4e9e1;--anatomy-hi:#394b43;--anatomy-mid:#65766a;--anatomy-lo:#97a496;--anatomy-faint:#b8c4b6;--anatomy-weight:.7px;position:relative;background:#faf9f6;color:#394b43;border:1px solid #dce2d7;border-radius:4px;overflow:hidden}
.engine-anatomy .anatomy-heading,.engine-anatomy .anatomy-footer{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 23px;font-size:11px;letter-spacing:.06em;line-height:1.4}
.engine-anatomy .anatomy-heading{padding-bottom:0}.engine-anatomy .anatomy-heading strong{font-size:13px;font-weight:600;letter-spacing:.04em}.engine-anatomy .anatomy-fig{font-family:ui-monospace,Consolas,monospace;color:#829080;font-size:10px}
.engine-anatomy .anatomy-footer{padding-top:0;flex-wrap:wrap;color:#8b9789;font-size:10px;letter-spacing:0}.engine-anatomy .anatomy-purpose{color:#6d7c6b}.engine-anatomy .anatomy-static{font-size:10px;line-height:1.65;color:#8b9789;margin:0;padding:0 23px 18px}
.engine-anatomy svg{display:block;width:100%;height:auto;overflow:visible;margin:-17px 0 -14px}.engine-anatomy svg path,.engine-anatomy svg circle{vector-effect:non-scaling-stroke}.engine-anatomy .iso-fill{fill:var(--anatomy-paper);stroke:none}.engine-anatomy .iso-shade,.engine-anatomy .iso-top{stroke:none}.engine-anatomy .iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}.engine-anatomy .iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}.engine-anatomy .iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}.engine-anatomy .iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}.engine-anatomy .iso-top{fill:var(--anatomy-top)}
.engine-anatomy .iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-linejoin:round}.engine-anatomy .iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}.engine-anatomy .iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}.engine-anatomy .iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}.engine-anatomy .iso-halo{fill:#a6b09d;stroke:none;filter:blur(11px);opacity:.19}.engine-anatomy .tb-body{fill:var(--anatomy-shade-0);stroke:none}.engine-anatomy .tb-shine{fill:var(--anatomy-top)}.engine-anatomy .tb-shade{fill:var(--anatomy-shade-0)}.engine-anatomy .tb-edge{stroke:#65766a}
.engine-anatomy [data-part]{cursor:pointer;transition:opacity .24s ease}.engine-anatomy [data-part]:hover{--anatomy-hi:#2856a3;--anatomy-mid:#4875bd}.engine-anatomy [data-part].is-selected{--anatomy-hi:#2856a3;--anatomy-mid:#4875bd;--anatomy-lo:#8babdf;--anatomy-top:#edf4ff;--anatomy-shade-0:#77a2e9;--anatomy-shade-1:#98b9ed;--anatomy-shade-2:#bdd2f6;--anatomy-shade-3:#d8e5fb}.engine-anatomy [data-part].is-selected .iso-edge{stroke-width:1.15}.engine-anatomy [data-front-shell]{display:none}.engine-anatomy[data-mode="assembled"] [data-front-shell],.engine-anatomy[data-mode="xray"] [data-front-shell]{display:inline}.engine-anatomy[data-mode="xray"] [data-front-shell]{opacity:.15;pointer-events:none}.engine-anatomy [data-assembly],.engine-anatomy [data-anatomy-root]{transition:transform .65s cubic-bezier(.22,.7,.18,1)}.engine-anatomy.is-reduced [data-assembly],.engine-anatomy.is-reduced [data-anatomy-root]{transition:none}
@media(max-width:600px){.engine-anatomy .anatomy-heading{padding:16px 17px 0}.engine-anatomy .anatomy-footer{padding:0 17px 12px}.engine-anatomy .anatomy-static{padding:0 17px 16px}.engine-anatomy svg{width:115%;max-width:none;margin:-5px -7.5% -5px}.engine-anatomy .anatomy-purpose{width:100%}}
@media(prefers-reduced-motion:reduce){.engine-anatomy [data-assembly],.engine-anatomy [data-anatomy-root],.engine-anatomy [data-part]{transition:none}}
</style>`;

let cachedMarkup;
export function anatomyMarkup() {
  if (cachedMarkup) return cachedMarkup;
  const back = assembly('cylinder', cylinder());
  const upper = assembly('head', head() + valve('intake', -20, 11.3) + valve('exhaust', 20, 9.8));
  const front = assembly('cylinder-front', cylinder(true));
  const frontHead = assembly('head-front', head(true));
  const body = bed() + rearCrankcase() + back + crankshaft() + connectingRod() + piston() + upper + assembly('spark', spark()) + frontCrankcase() + assembly('flywheel', flywheel()) + front + frontHead;
  const svg = k.figureSvg({ width: W, height: H, label: SVG_LABEL, body: `<g data-anatomy-root>${body}</g>` });
  cachedMarkup = `<div class="iso-plate engine-anatomy" data-mode="cut">${STYLE}<div class="anatomy-heading"><strong>纸上结构</strong><span class="anatomy-fig">FIG.01</span></div>${svg}<div class="anatomy-footer"><span class="anatomy-purpose">选择部件可查看用途</span><span data-anatomy-state>半剖 · 固定姿态</span></div><p class="anatomy-static">结构定位图；切换立体剖面观察连续运动。</p></div>`;
  return cachedMarkup;
}

export function mountAnatomy(container, { onSelect } = {}) {
  if (!container) throw new TypeError('mountAnatomy requires a container');
  let plate = container.matches?.('.engine-anatomy') ? container : container.querySelector('.engine-anatomy');
  if (!plate) {
    container.innerHTML = anatomyMarkup();
    plate = container.querySelector('.engine-anatomy');
  }
  const root = plate.querySelector('[data-anatomy-root]');
  const groups = Array.from(plate.querySelectorAll('[data-part]'));
  const assemblies = new Map(Array.from(plate.querySelectorAll('[data-assembly]')).map((el) => [el.dataset.assembly, el]));
  const stateText = plate.querySelector('[data-anatomy-state]');
  const labels = { assembled: '总成 · 固定姿态', cut: '半剖 · 固定姿态', explode: '轴向分解 · 固定姿态', xray: '透视壳体 · 固定姿态' };
  let state = { mode: 'cut', selected: null, reduced: false };
  const click = (event) => {
    const target = event.target.closest?.('[data-part]');
    if (target && plate.contains(target)) onSelect?.(target.dataset.part);
  };
  plate.addEventListener('click', click);
  function update(next = {}) {
    state = { ...state, ...next };
    const mode = labels[state.mode] ? state.mode : 'cut', exploded = mode === 'explode';
    plate.dataset.mode = mode;
    plate.classList.toggle('is-reduced', Boolean(state.reduced));
    stateText.textContent = labels[mode];
    for (const el of groups) el.classList.toggle('is-selected', el.dataset.part === state.selected);
    root.setAttribute('transform', exploded ? 'translate(52 77) scale(.87)' : 'translate(0 0) scale(1)');
    const shifts = { cylinder: [0, 0, 23], 'cylinder-front': [0, 0, 23], head: [0, 0, 56], 'head-front': [0, 0, 56], spark: [0, 0, 84], flywheel: [0, 35, 0] };
    for (const [id, el] of assemblies) el.setAttribute('transform', k.translateAlong(P, exploded ? shifts[id] : [0, 0, 0]));
  }
  update();
  return { update, dispose() { plate.removeEventListener('click', click); } };
}
