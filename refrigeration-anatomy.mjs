import * as k from './vendor/anatomy-kit/iso-kit.mjs';
import * as G from './vendor/anatomy-kit/lathe.mjs';
import { COOLING_MACHINES, coolingAt, assemblyAt } from './refrigeration-model.mjs';
import { COOLING_ANATOMY_DATA } from './refrigeration-anatomy-data.mjs';
const W = 960, H = 650;
const cache = new Map(Object.entries(COOLING_ANATOMY_DATA));
const STYLE = `<style>
.cooling-anatomy{--anatomy-paper:#fffefa;--anatomy-top:#f2f1e9;--anatomy-shade-0:#bdc4be;--anatomy-shade-1:#cbd1ca;--anatomy-shade-2:#dce0d7;--anatomy-shade-3:#e7e9df;--anatomy-hi:#43524b;--anatomy-mid:#728174;--anatomy-lo:#a2ad9c;--anatomy-faint:#c3cabe;background:#fffefa;color:#43524b;border:1px solid #e2e5dc;border-radius:4px;overflow:hidden;position:relative}
.cooling-anatomy .cooling-anatomy-heading,.cooling-anatomy .cooling-anatomy-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px;font-size:11px;line-height:1.5}.cooling-anatomy .cooling-anatomy-heading{padding-bottom:0}.cooling-anatomy .cooling-anatomy-heading strong{font-size:13px;font-weight:600}.cooling-anatomy .cooling-fig{font:10px ui-monospace,Consolas,monospace;letter-spacing:.06em;color:#8b9588}.cooling-anatomy .cooling-anatomy-footer{padding-top:0;color:#7d897b;flex-wrap:wrap}.cooling-anatomy svg{display:block;width:100%;height:auto;margin:-15px 0 -18px;overflow:visible}.cooling-anatomy svg path,.cooling-anatomy svg circle{vector-effect:non-scaling-stroke}
.cooling-anatomy .iso-fill{fill:var(--anatomy-paper);stroke:none;fill-rule:evenodd}.cooling-anatomy .iso-shade,.cooling-anatomy .iso-top{stroke:none}.cooling-anatomy .iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}.cooling-anatomy .iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}.cooling-anatomy .iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}.cooling-anatomy .iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}.cooling-anatomy .iso-top{fill:var(--anatomy-top)}.cooling-anatomy .iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:.65;stroke-linecap:round;stroke-linejoin:round}.cooling-anatomy .iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}.cooling-anatomy .iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}.cooling-anatomy .iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}.cooling-anatomy .iso-halo{fill:#b8b8a4;filter:blur(11px);opacity:.15;stroke:none}.cooling-anatomy .tb-body{fill:var(--anatomy-shade-0)}.cooling-anatomy .tb-shine{fill:var(--anatomy-top)}.cooling-anatomy .tb-shade{fill:var(--anatomy-shade-0)}.cooling-anatomy .tb-edge{fill:none;stroke:var(--anatomy-mid);stroke-width:.6}
.cooling-anatomy .coolant-hot,.cooling-anatomy[data-operation="cool"] .coolant-outdoor,.cooling-anatomy[data-operation="heat"] .coolant-indoor,.cooling-anatomy[data-operation="cool"] .coolant-outdoor-gas,.cooling-anatomy[data-operation="heat"] .coolant-indoor-gas{--anatomy-top:#f5d8ba;--anatomy-shade-0:#bd8069;--anatomy-shade-1:#cc9b7c;--anatomy-shade-2:#dfb394;--anatomy-shade-3:#ebc7aa;--anatomy-hi:#8d5d48;--anatomy-mid:#a5765a;--anatomy-lo:#c3a287;--anatomy-faint:#d6c4ad}
.cooling-anatomy .coolant-cold,.cooling-anatomy .coolant-mixture,.cooling-anatomy[data-operation="cool"] .coolant-indoor,.cooling-anatomy[data-operation="heat"] .coolant-outdoor,.cooling-anatomy[data-operation="cool"] .coolant-indoor-liquid,.cooling-anatomy[data-operation="heat"] .coolant-outdoor-liquid{--anatomy-top:#e2f1ee;--anatomy-shade-0:#78a99f;--anatomy-shade-1:#94bdb2;--anatomy-shade-2:#afd1c4;--anatomy-shade-3:#c9e4d8;--anatomy-hi:#477e74;--anatomy-mid:#6c988a;--anatomy-lo:#9dbbb0;--anatomy-faint:#c4d7ca}
.cooling-anatomy .coolant-gas,.cooling-anatomy[data-operation="cool"] .coolant-indoor-gas,.cooling-anatomy[data-operation="heat"] .coolant-outdoor-gas{--anatomy-top:#e2ecf0;--anatomy-shade-0:#7f9dad;--anatomy-shade-1:#9cb2bd;--anatomy-shade-2:#b7c9d0;--anatomy-shade-3:#d2dfe2;--anatomy-hi:#59778c;--anatomy-mid:#7b96a6}
.cooling-anatomy .coolant-liquid,.cooling-anatomy .coolant-brass,.cooling-anatomy[data-operation="cool"] .coolant-outdoor-liquid,.cooling-anatomy[data-operation="heat"] .coolant-indoor-liquid{--anatomy-top:#f4e9c9;--anatomy-shade-0:#b9a574;--anatomy-shade-1:#cebc8b;--anatomy-shade-2:#deceaa;--anatomy-shade-3:#ebdfbd;--anatomy-hi:#8e7849;--anatomy-mid:#a18c61}
.cooling-anatomy .coolant-insulation{--anatomy-top:#f8eebc;--anatomy-shade-0:#d5c98c;--anatomy-shade-1:#e1d69e;--anatomy-shade-2:#ebe1af;--anatomy-shade-3:#f3e9ba;--anatomy-lo:#c9be8b;--anatomy-hi:#a89a65}.cooling-anatomy .coolant-glass{--anatomy-top:#e8f2f0;--anatomy-shade-0:#b6ccca;--anatomy-shade-1:#c8dad4;--anatomy-shade-2:#d6e6df;--anatomy-shade-3:#e2eee6;--anatomy-lo:#afc4b9;--anatomy-hi:#839e92}.cooling-anatomy .coolant-motor{--anatomy-paper:#65746b;--anatomy-top:#819184;--anatomy-shade-0:#4c5e54;--anatomy-shade-1:#5a6d60;--anatomy-shade-2:#697e6b;--anatomy-shade-3:#758b76;--anatomy-hi:#3e5547;--anatomy-lo:#637565}.cooling-anatomy .coolant-filter{--anatomy-top:#eeeee2;--anatomy-shade-0:#abb9a2}
.cooling-anatomy .cooling-solid{cursor:pointer;transition:transform .65s cubic-bezier(.22,.7,.18,1),opacity .3s ease}.cooling-anatomy .cooling-solid:hover .iso-edge{stroke:#356fdc;stroke-width:1.3}.cooling-anatomy .cooling-solid.is-selected{--anatomy-top:#edf4ff;--anatomy-shade-0:#77a2e9;--anatomy-shade-1:#98b9ed;--anatomy-shade-2:#bdd2f6;--anatomy-shade-3:#d8e5fb;--anatomy-hi:#2856a3;--anatomy-mid:#4875bd;--anatomy-lo:#8babdf;filter:drop-shadow(0 0 3px #356fdc33)}.cooling-anatomy .cooling-solid.is-selected .iso-edge{stroke-width:1.15}.cooling-anatomy .cooling-solid:focus-visible{outline:none;filter:drop-shadow(0 0 3px #356fdc)}.cooling-anatomy .cooling-solid:focus-visible .iso-edge{stroke:#2856a3;stroke-width:1.5}
.cooling-anatomy [data-cover]{display:none}.cooling-anatomy[data-mode="assembled"] [data-cover],.cooling-anatomy[data-mode="xray"] [data-cover]{display:inline}.cooling-anatomy[data-mode="xray"] [data-cover]{opacity:.13;pointer-events:none}.cooling-anatomy[data-mode="assembled"][data-kind="fridge"] [data-piece="door"]:not([data-cover]){display:none}.cooling-anatomy [data-op="heat"]{display:none}.cooling-anatomy[data-operation="heat"] [data-op="cool"]{display:none}.cooling-anatomy[data-operation="heat"] [data-op="heat"]{display:inline}
.cooling-anatomy .cooling-tracer{pointer-events:none}.cooling-anatomy .cooling-tracer-outline{fill:#fff;stroke:#254d91;stroke-width:1.4}.cooling-anatomy .cooling-tracer-glow{fill:#9cbeff;stroke:none}.cooling-anatomy .cooling-tracer-core{fill:#2856a3;stroke:none}.cooling-anatomy .cooling-tracer-arrow{fill:none;stroke:#2856a3;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.cooling-anatomy .cooling-key{display:flex;gap:13px;flex-wrap:wrap;padding:0 22px 13px;font-size:10px;color:#778273}.cooling-anatomy .cooling-key span{display:inline-flex;align-items:center;gap:5px}.cooling-anatomy .cooling-key i{width:7px;height:7px;display:inline-block;border-radius:50%;background:var(--key);opacity:.8}.cooling-anatomy .cooling-anatomy-note{font-size:10px;color:#899180;line-height:1.65;margin:0;padding:0 22px 17px}.cooling-anatomy.is-reduced .cooling-solid{transition:none}
@media(max-width:600px){.cooling-anatomy .cooling-anatomy-heading{padding:15px 15px 0}.cooling-anatomy .cooling-anatomy-footer{padding:0 15px 12px;font-size:10px}.cooling-anatomy svg{width:114%;max-width:none;margin:-9px -7% -10px}.cooling-anatomy[data-kind="ac"] svg{width:120%;margin:-5px -10% -3px}.cooling-anatomy .cooling-key{padding:0 15px 11px;gap:7px 12px;font-size:9px}.cooling-anatomy .cooling-anatomy-note{padding:0 15px 14px;font-size:9px}}
@media(prefers-reduced-motion:reduce){.cooling-anatomy .cooling-solid{transition:none}}
</style>`;

function getDrawing(kind) {
  kind = kind === 'ac' ? 'ac' : 'fridge';
  return cache.get(kind);
}

export function coolingAnatomyMarkup(kind = 'fridge') {
  kind = kind === 'ac' ? 'ac' : 'fridge';
  const d = getDrawing(kind), name = COOLING_MACHINES[kind].name;
  const label = `${name}固定等距半剖结构图。点选部件查看用途，蓝色标记沿管路追踪一段制冷剂；所有回路部件同时工作。`;
  const svg = k.figureSvg({ width: W, height: H, label, body: `<g data-cooling-root>${d.body}</g><g class="cooling-tracer" data-cooling-tracer><circle class="cooling-tracer-outline" r="7.8"/><circle class="cooling-tracer-glow" r="6.5"/><circle class="cooling-tracer-core" r="3"/><path class="cooling-tracer-arrow" d="M-16 -4 L-11 0 L-16 4"/></g>` });
  return `<div class="iso-plate cooling-anatomy" data-kind="${kind}" data-mode="cut" data-operation="cool">${STYLE}<div class="cooling-anatomy-heading"><strong>纸上结构 · ${name}</strong><span class="cooling-fig">FIG.${kind === 'ac' ? '03' : '02'}</span></div>${svg}<div class="cooling-anatomy-footer"><span>点选部件查看用途</span><span data-cooling-anatomy-state>半剖 · 固定姿态</span></div><div class="cooling-key"><span><i style="--key:#c88e70"></i>高温高压气体</span><span><i style="--key:#c2af78"></i>高压液体</span><span><i style="--key:#81b2a4"></i>低压气液混合物</span><span><i style="--key:#8daabb"></i>低压气体</span></div><p class="cooling-anatomy-note">${kind === 'fridge' ? '为看清回路，外侧冷凝器与保温断面同时露出；实际位置因机型而异。' : '切换冷暖后，两侧换热器交换任务；压缩机的吸气、排气方向不变。'} 蓝色标记只跟踪一段制冷剂，颜色用于说明状态。</p></div>`;
}

const reverse = route => [...route].reverse();
function joinRoutes(...routes) { return routes.filter(Boolean).flat(); }
function traceRoute(d, state) {
  const r = d.routes;
  if (state.kind !== 'ac') return r[state.stage.id];
  const heat = state.operation === 'heat';
  if (state.stageIndex === 0) return r.compression;
  if (state.stageIndex === 1) return heat ? joinRoutes(reverse(r['indoor-gas']), reverse(r.indoor)) : joinRoutes(r['outdoor-gas'], r.outdoor);
  if (state.stageIndex === 2) return heat ? joinRoutes(reverse(r['indoor-liquid']), reverse(r['outdoor-liquid'])) : joinRoutes(r['outdoor-liquid'], r['indoor-liquid']);
  return heat ? joinRoutes(reverse(r.outdoor), reverse(r['outdoor-gas'])) : joinRoutes(r.indoor, r['indoor-gas']);
}
function pointAlong(route, t) {
  if (!route?.length) return [[0, 0, 0], [1, 0, 0]];
  const len = G.pathLength(route), at = Math.max(0, Math.min(len, len * t));
  return [G.pointAlong(route, at), G.tangentAlong(route, at)];
}

export function mountCoolingAnatomy(container, { kind = 'fridge', onSelect } = {}) {
  if (!container) throw new TypeError('mountCoolingAnatomy requires a container');
  kind = kind === 'ac' ? 'ac' : 'fridge';
  let plate = container.matches?.('.cooling-anatomy') ? container : container.querySelector('.cooling-anatomy');
  if (!plate || plate.dataset.kind !== kind) { container.innerHTML = coolingAnatomyMarkup(kind); plate = container.querySelector('.cooling-anatomy'); }
  const d = getDrawing(kind);
  const parts = [...plate.querySelectorAll('[data-cooling-part]')];
  const tracer = plate.querySelector('[data-cooling-tracer]');
  const status = plate.querySelector('[data-cooling-anatomy-state]');
  const handle = ev => {
    if (ev.type === 'keydown' && !['Enter', ' '].includes(ev.key)) return;
    const target = ev.target.closest('[data-cooling-part]');
    if (!target || !plate.contains(target)) return;
    if (ev.type === 'keydown') ev.preventDefault();
    onSelect?.(target.dataset.coolingPart);
  };
  plate.addEventListener('click', handle); plate.addEventListener('keydown', handle);
  let previousMode = '', previousSelected = null;
  function update(state = {}) {
    const current = coolingAt({ kind, operation: state.operation, progress: state.progress });
    const mode = ['assembled', 'cut', 'explode', 'xray'].includes(state.mode) ? state.mode : 'cut';
    plate.dataset.mode = mode; plate.dataset.operation = current.operation;
    plate.classList.toggle('is-reduced', !!state.reduced);
    if (previousSelected !== state.selected) {
      parts.forEach(p => { const yes = p.dataset.coolingPart === state.selected; p.classList.toggle('is-selected', yes); if (p.hasAttribute('aria-pressed')) p.setAttribute('aria-pressed', String(yes)); });
      previousSelected = state.selected;
    }
    if (previousMode !== mode) {
      parts.forEach(p => {
        const move = p.dataset.move.split(',').map(Number);
        const fallback = ({ door: [-14, 12, 0], evaporator: [0, 0, 10], condenser: [23, 0, 0], 'indoor-shell': [0, 10, 12], 'outdoor-shell': [12, 12, 10], 'indoor-coil': [0, -8, 12], 'outdoor-coil': [0, -10, 7], filter: [0, 0, 15], fan: [0, 18, 0] })[p.dataset.piece] ?? [0, 0, 0];
        const offset = move.some(Boolean) ? move : fallback;
        const a = k.iso([0, 0, 0], d.P), b = k.iso(mode === 'explode' ? offset : [0, 0, 0], d.P);
        p.setAttribute('transform', `translate(${b[0] - a[0]} ${b[1] - a[1]})`);
      });
      previousMode = mode;
    }
    const route = traceRoute(d, current), [pt, tangent] = pointAlong(route, current.stageProgress);
    const a = k.iso(pt, d.P), b = k.iso(G.add3(pt, tangent), d.P);
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    tracer.setAttribute('transform', `translate(${a[0]} ${a[1]}) rotate(${angle})`);
    tracer.style.display = mode === 'assembled' || mode === 'explode' || state.assembly?.active ? 'none' : '';
    const pose = { assembled: '整机', cut: '半剖', explode: '拆分', xray: '透视' }[mode];
    status.textContent = state.assembly?.active ? `${assemblyAt(kind, state.assembly.time).step.name} · 固定姿态` : `${pose} · ${current.stage.name} ${Math.round(current.progress * 100)}%`;
    plate.dataset.stage = current.stage.id;
  }
  update({});
  return { update, destroy() { plate.removeEventListener('click', handle); plate.removeEventListener('keydown', handle); } };
}

// Read-only geometry data for the offline verification harness.
export function inspectCoolingAnatomy(kind = 'fridge') {
  const d = getDrawing(kind === 'ac' ? 'ac' : 'fridge');
  return { entityCount: d.count, projection: d.P, routes: d.routes };
}
