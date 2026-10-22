import * as k from './vendor/anatomy-kit/iso-kit.mjs';
import * as G from './vendor/anatomy-kit/lathe.mjs';
import * as A from './vendor/anatomy-kit/audit.mjs';
import { tubePieces, tubeSvg } from './vendor/anatomy-kit/tube.mjs';
import { COOLING_MACHINES, coolingAt, assemblyAt } from './refrigeration-model.mjs';

// A fixed isometric cutaway, in qualitative teaching dimensions. This is a
// structural drawing, not another rotatable scene or a manufacturing drawing.
const W = 960, H = 650;
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const cache = new Map();
const colorClass = color => color ? ` coolant-${color}` : '';

/* Entity counts come from the same solid/tube records used to draw the object.
 * Fridge: cabinet skin and insulation, door, four door bins, shelves and drawer,
 * evaporator, external serpentine condenser, compressor with three mount feet,
 * filter-drier, capillary, thermostat, pipes and the actual fasteners/hinges.
 * AC: two chassis, filter mesh, fin packs, cross-flow blower, louvres and drain;
 * outdoor fan, circular wire guard, finned coil, compressor, reversing valve,
 * suction accumulator, bidirectional expansion device and copper lines.
 */
export function drawing(kind) {
  const fridge = kind !== 'ac';
  const corners = fridge
    ? [...k.boxCorners({ x: -62, y: -43, w: 153, d: 200 }, -4, 250)]
    : [...k.boxCorners({ x: -185, y: -47, w: 345, d: 124 }, -7, 208)];
  const P = k.fitProjection(corners, W, H, { pad: fridge ? 49 : 47, azimuth: fridge ? 48 : 42, elevation: 25 });
  const R = A.recorder(P);
  const routes = {}, items = [];
  const names = Object.fromEntries(COOLING_MACHINES[kind].parts.map(p => [p.id, p.name]));
  let count = 0;
  const line = (d, tone = 'faint') => k.lineSvg(d, { tone });
  const e = (id, name, svg, shape, at, meta = {}) => {
    const shapes = shape ? [R.solid({ ...shape, name })] : [];
    const item = R.put({ name, piece: id, at, svg, shapes, ...meta });
    items.push(item); count++; return item;
  };
  const box = (id, name, x, y, w, d, z, h, { r = 1.2, tone = 'mid', extra = '', color = '', cover = false, move = [0, 0, 0] } = {}) => {
    const plan = { x, y, w, d, r };
    const geo = k.slabOf(plan, z, h, P, 6, Math.min(.7, h / 5));
    return e(id, name, k.solidSvg(geo, { tone, inner: extra }), A.slab(plan, z, h), [x + w / 2, y + d / 2, z + h / 2], { color, cover, move });
  };
  const disc = (id, name, at, axis, from, to, radius, { tone = 'hi', color = '', extra = '' } = {}) => {
    const F = G.frameAlong(at, axis), shape = G.disc(from, to, radius, F, P);
    return e(id, name, k.solidSvg(shape, { tone, inner: extra }), A.disc(F, from, to, radius), G.add3(at, G.mul3(axis, (from + to) / 2)), { color });
  };
  const ring = (id, name, at, axis, from, to, ri, ro, { tone = 'mid', color = '' } = {}) => {
    const F = G.frameAlong(at, axis);
    return e(id, name, k.solidSvg(G.ringBand(from, to, ri, ro, F, P, { hole: [to, ri] }), { tone }), A.ring(F, from, to, ri, ro), G.add3(at, G.mul3(axis, (from + to) / 2)), { color });
  };
  const screw = (id, x, y, z, radius = 1.6) => disc(id, '十字紧固螺钉', [x, y, z], [0, 0, 1], 0, 1.1, radius, { extra: line(k.segment([x - radius * .6, y, z + 1.1], [x + radius * .6, y, z + 1.1], P), 'mid') });
  const pipe = (id, name, pts, r = 1.4, { color = '', op = '', trace = '', terminal = true } = {}) => {
    const smooth = G.fillet(pts, 4, 7, { P, tube: r });
    const route = R.route(name, smooth, r, { owner: name, piece: id, free: [!terminal, !terminal] });
    const chunks = tubePieces(smooth, r, P, { spacing: 2, maxLength: 13 });
    chunks.forEach((p, index) => e(id, `${name}-${index}`, tubeSvg(p, { tone: 'mid' }), A.tube(p.points, r, { owner: name }), p.mid, { color, op, trace, route: name, chunk: index }));
    if (trace) routes[trace] = smooth;
    return { smooth, route };
  };
  const haloPlan = fridge ? { x: -62, y: -43, w: 153, d: 200, r: 10 } : { x: -178, y: -42, w: 330, d: 104, r: 9 };
  const halo = `<path class="iso-halo" d="${k.haloOf(haloPlan, -4, 4, P)}"/>`;

  function compressor(x, y, z, scale = 1) {
    const r = 15 * scale, h = 32 * scale;
    for (const [dx, dy] of [[-14, -9], [14, -9], [0, 13]]) {
      disc('compressor', '橡胶减振脚', [x + dx * scale, y + dy * scale, z - 4], [0, 0, 1], 0, 4, 4 * scale, { tone: 'lo' });
    }
    box('compressor', '压缩机安装托板', x - 19 * scale, y - 15 * scale, 38 * scale, 33 * scale, z, 2.5, { r: 4 });
    const F = G.frameAlong([x, y, z + 2.5], [0, 0, 1]);
    const radius = s => r * Math.sqrt(Math.max(0, 1 - ((s - h / 2) / (h / 2 + 2)) ** 4));
    const profile = Array.from({ length: 25 }, (_, i) => { const s = i * h / 24; return [s, radius(s), true]; });
    const slope = s => { const u = (s - h / 2) / (h / 2 + 2); return -2 * r * u ** 3 / ((h / 2 + 2) * Math.sqrt(Math.max(.00001, 1 - u ** 4))); };
    e('compressor', '密封压缩机钢壳', k.solidSvg(G.solidOf(profile, F, P, { smooth: { slope }, rims: 'ends' }), { tone: 'hi' }), A.solid(F, profile, { radius }), [x, y, z + h / 2 + 2.5], { color: 'motor' });
    ring('compressor', '钢壳焊接接缝', [x, y, z + 2.5], [0, 0, 1], h * .45, h * .45 + .7, radius(h * .45), radius(h * .45) + .35, { tone: 'lo' });
    box('compressor', '电气接线盒', x - r - 6 * scale, y + 9 * scale, 9 * scale, 8 * scale, z + 10 * scale, 11 * scale, { r: 2, tone: 'lo' });
    disc('compressor', '排气铜管接头', [x - 5 * scale, y, z + h + 2.5], [0, 0, 1], 0, 5, 2.4 * scale, {});
    disc('compressor', '吸气铜管接头', [x + r, y, z + 12 * scale], [1, 0, 0], 0, 4, 2.8 * scale, {});
  }

  if (fridge) {
    // A teaching cabinet with a cut right panel exposes the external heat
    // rejection coil. A real refrigerator can put this coil behind or in its skin.
    for (const [x, y] of [[-47, -24], [47, -24], [-47, 48], [47, 48]]) disc('shell', '可调箱脚', [x, y, -2], [0, 0, 1], 0, 7, 5, { tone: 'lo' });
    box('shell', '箱底承重板', -58, -36, 116, 94, 5, 7, { r: 5 });
    box('shell', '箱体背板', -58, -36, 116, 7, 54, 183, { r: 3 });
    box('shell', '左侧外钢板', -58, -29, 5, 87, 12, 225, { r: 1.8 });
    box('shell', '左侧保温层断面', -53, -29, 7, 87, 12, 225, { r: 1, color: 'insulation' });
    box('shell', '左侧内胆', -46, -29, 2, 82, 12, 225, { r: .6 });
    box('shell', '背侧保温层', -46, -29, 102, 7, 52, 185, { r: 1, color: 'insulation' });
    box('shell', '背侧内胆', -44, -22, 96, 2, 54, 178, { r: 1 });
    box('shell', '顶板保温断面', -58, -29, 116, 87, 231, 7, { r: 3, color: 'insulation' });
    box('shell', '箱顶钢板', -58, -36, 116, 94, 238, 3, { r: 3 });
    box('shell', '机器舱隔板左半剖边', -44, -20, 26, 72, 49, 5, { r: 2 });
    box('shell', '机器舱隔板右半剖边', 35, -20, 10, 72, 49, 5, { r: 2 });
    box('shell', '机器舱隔板后半剖边', -18, -20, 53, 10, 49, 5, { r: 1 });
    box('shell', '右侧外板下段', 54, -29, 5, 87, 12, 178, { cover: true, r: 1, move: [30, 0, 0] });
    box('shell', '右侧外板上段', 54, -29, 5, 87, 197, 40, { cover: true, r: 1, move: [30, 0, 0] });
    box('shell', '穿管槽后边', 54, -29, 5, 12, 190, 7, { cover: true, r: .4, move: [30, 0, 0] });
    box('shell', '穿管槽前边', 54, -9, 5, 67, 190, 7, { cover: true, r: .4, move: [30, 0, 0] });
    for (const z of [91, 132, 170]) {
      box('shell', '玻璃层架', -43, -18, 88, 66, z, 1.6, { r: 1.5, color: 'glass' });
      box('shell', '层架前沿包边', -43, 47, 88, 2, z - .3, 2.5, { r: .6 });
      for (const x of [-43, 42]) box('shell', '层架支撑卡扣', x, -3, 3, 8, z - 3, 3, { r: .8 });
    }
    box('shell', '果蔬抽屉底', -40, -15, 86, 57, 68, 2, { color: 'glass' });
    box('shell', '果蔬抽屉前沿', -40, 40, 86, 3, 70, 20, { color: 'glass' });
    box('shell', '果蔬抽屉把手', -14, 44, 33, 3, 82, 4, { r: 2 });
    // The cold plate is a genuine plate evaporator with embossed return channels.
    box('evaporator', '冷冻室蒸发板', -39, -18, 83, 3, 177, 47, { r: 2.3, color: 'cold' });
    box('evaporator', '蒸发器下接盘', -39, -16, 83, 54, 177, 2, { r: 2, color: 'cold' });
    const evap = [[44, -13, 183], [-34, -13, 183], [-34, -13, 193], [38, -13, 193], [38, -13, 203], [-34, -13, 203], [-34, -13, 216], [44, -13, 216]];
    pipe('evaporator', '蒸发板内流道', evap, 1.7, { color: 'cold', trace: 'evaporation' });
    // Outside the cut side panel: radiator tubes on real cross supports.
    for (const y of [-25, 45]) box('condenser', '冷凝器固定竖梁', 62, y, 3, 3, 69, 150, { r: .7 });
    for (let j = 0; j < 16; j++) box('condenser', '散热钢丝', 63.8, -23, 1.1, 68, 73 + j * 8.7, .7, { r: .2, tone: 'lo' });
    const cond = [[68, -23, 217]];
    for (let i = 0; i < 9; i++) { const z = 217 - i * 16; cond.push([68, i % 2 ? -23 : 43, z]); if (i < 8) cond.push([68, i % 2 ? -23 : 43, z - 16]); }
    pipe('condenser', '箱外蛇形冷凝管', cond, 2.2, { color: 'hot', trace: 'condensation' });
    compressor(7, 14, 16, 1.05);
    disc('filter', '过滤干燥器铜壳', [78, 51, 54], [0, 0, 1], 0, 20, 4, { color: 'liquid' });
    disc('filter', '干燥器入口封头', [78, 51, 74], [0, 0, 1], 0, 2, 3, { color: 'liquid' });
    box('filter', '干燥器固定支架', 65, 46, 13, 3, 70, 1.5, { r: .4 });
    ring('filter', '干燥器固定抱箍', [78, 51, 54], [0, 0, 1], 15, 17, 4, 4.6, {});
    const capillary = [[78, 51, 54], [78, 51, 48], [88, 51, 48], [88, 51, 164], [88, -13, 164], [88, -13, 193], [44, -13, 193], [44, -13, 183]];
    pipe('expansion', '毛细节流管', capillary, .75, { color: 'mixture', trace: 'expansion' });
    pipe('pipes', '压缩机排气管', [[1.75, 14, 57.1], [-15, 14, 57.1], [-15, 14, 44], [-15, -43, 44], [78, -43, 44], [78, -43, 217], [78, -23, 217], [68, -23, 217]], 1.65, { color: 'hot', trace: 'compression' });
    pipe('pipes', '冷凝器液体出口', [cond.at(-1), [78, 43, 89], [78, 51, 76]], 1.5, { color: 'liquid' });
    pipe('pipes', '蒸发器回气管', [[44, -13, 216], [51, -13, 216], [51, 14, 216], [51, 14, 28.6], [26.95, 14, 28.6]], 2, { color: 'gas' });
    box('thermostat', '温控器外壳', -41, 35, 14, 14, 217, 11, { r: 2 });
    disc('thermostat', '温控旋钮', [-34, 42, 228], [0, 0, 1], 0, 2.2, 4.2, {});
    pipe('thermostat', '感温毛细引线', [[-33, 35, 220], [-33, -8, 220], [-27, -8, 218]], .48, {});
    disc('thermostat', '感温头', [-27, -8, 216], [1, 0, 0], -5, 5, 1.1, {});
    // Door is opened around its left hinge, not made transparent. Its storage
    // bins sit on the inside, and the gasket follows the whole perimeter.
    box('door', '打开的箱门外钢板', -65, 58, 6, 104, 15, 223, { r: 3, move: [-12, 8, 0] });
    box('door', '箱门保温层断面', -59, 58, 5, 104, 17, 219, { r: 2, color: 'insulation', move: [-12, 8, 0] });
    box('door', '箱门内胆', -54, 62, 2, 96, 20, 213, { r: 3, move: [-12, 8, 0] });
    for (const y of [64, 154]) box('door', '磁性门封竖边', -51, y, 2, 3, 22, 209, { r: 1, tone: 'lo', move: [-12, 8, 0] });
    for (const z of [22, 228]) box('door', '磁性门封横边', -51, 64, 2, 93, z, 3, { r: 1, tone: 'lo', move: [-12, 8, 0] });
    for (const z of [44, 91, 137, 184]) {
      box('door', '门搁架底', -51, 72, 14, 76, z, 2, { r: 1.5, color: 'glass', move: [-12, 8, 0] });
      box('door', '门搁架挡沿', -38, 72, 2, 76, z + 2, 15, { r: 1.5, color: 'glass', move: [-12, 8, 0] });
      for (const y of [72, 145]) box('door', '门搁架端板', -51, y, 13, 3, z + 2, 15, { r: 1, color: 'glass', move: [-12, 8, 0] });
    }
    for (const z of [17, 233]) {
      box('door', '门铰链支座', -62, 51, 9, 11, z, 2, { r: 1 });
      disc('door', '铰链转轴', [-59, 58, z], [0, 0, 1], -2, 4, 1.7, {});
      screw('door', -57, 54, z + 2, 1.2);
    }
    box('door', '关闭的冰箱门', -58, 58, 116, 8, 15, 223, { r: 4, cover: 'door' });
    box('door', '门把手', 39, 66, 5, 5, 122, 53, { r: 2, cover: 'door' });
    for (const [x, y] of [[-53, -31], [53, -31], [-53, 51], [53, 51]]) screw('shell', x, y, 241, 1.4);
  } else {
    // Indoor unit: a finned coil behind the cross-flow wheel and real drain pan.
    box('indoor-shell', '室内挂墙背板', -181, -35, 151, 5, 135, 56, { r: 3 });
    // The two end caps have a service opening for the copper lines and drain.
    for (const x of [-177, -36]) {
      box('indoor-shell', '室内机侧盖下沿', x, -30, 5, 56, 133, 15, { r: 1 });
      box('indoor-shell', '室内机侧盖上沿', x, -30, 5, 56, 184, 8, { r: 1 });
      box('indoor-shell', '穿管孔后沿', x, -30, 5, 9, 148, 36, { r: .5 });
      box('indoor-shell', '穿管孔前沿', x, -12, 5, 38, 148, 36, { r: .5 });
    }
    box('indoor-shell', '室内机底托', -177, -30, 146, 56, 131, 4, { r: 3 });
    box('indoor-shell', '室内机顶盖', -177, -30, 146, 56, 190, 3, { r: 2 });
    // Each fin is a thin solid with a top edge and side shade, not a hatch.
    for (let i = 0; i < 32; i++) box('indoor-coil', '室内盘管铝翅片', -172 + i * 4.2, -28, .65, 31, 154, 30, { r: .2, tone: 'lo', color: 'indoor' });
    const indoor = [[-35, -17, 179], [-173, -17, 179], [-173, -17, 169], [-35, -17, 169], [-35, -17, 159], [-173, -17, 159]];
    pipe('indoor-coil', '室内盘管铜管', indoor, 1.9, { color: 'indoor', trace: 'indoor' });
    box('filter', '过滤网塑料边框', -173, -23, 135, 26, 185, 1.4, { r: 2, color: 'filter' });
    for (let i = 0; i < 17; i++) box('filter', '过滤网横筋', -169 + i * 7.7, -21, .45, 22, 186.4, .45, { r: .1, tone: 'faint' });
    for (let i = 0; i < 5; i++) box('filter', '过滤网纵筋', -171, -20 + i * 5, 131, .4, 186.4, .4, { r: .1, tone: 'faint' });
    disc('blower', '贯流风轮轮毂', [-174, 9, 146], [1, 0, 0], 0, 138, 3.7, { tone: 'mid' });
    for (let i = 0; i < 8; i++) ring('blower', '贯流风轮加强环', [-174, 9, 146], [1, 0, 0], 2 + i * 18, 3.4 + i * 18, 9.7, 11.4, {});
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI * 2 / 18, y = 9 + Math.cos(a) * 10.2, z = 146 + Math.sin(a) * 10.2;
      box('blower', '贯流风轮叶片', -171, y, 132, .65, z, 1.1, { r: .2 });
    }
    disc('blower', '贯流风轮电机', [-174, 9, 146], [1, 0, 0], 135, 144, 6.5, {});
    box('drain', '室内接水盘', -173, -29, 135, 33, 150, 2.2, { r: 2 });
    box('drain', '接水盘前缘', -173, 2, 135, 2, 152, 4, { r: 1 });
    // Turn behind the indoor case; keep a fall toward the outdoor drain end.
    pipe('drain', '排水软管', [[-38, -17, 151], [-25, -17, 150], [-25, -47, 147], [156, -47, 139], [156, -47, 8]], 2, { terminal: false });
    for (let j = 0; j < 3; j++) box('louver', '出风导风板', -172, 17 + j * 4, 132, 3.6, 134 + j * 1.5, .9, { r: .6 });
    box('indoor-shell', '室内机前面板', -177, 26, 146, 4, 149, 42, { r: 3.5, cover: true, move: [0, 26, 10] });
    // Outdoor unit, with service cover removed in the cut view.
    for (const [x, y] of [[40, -26], [139, -26], [40, 44], [139, 44]]) disc('outdoor-shell', '室外底脚减振垫', [x, y, -4], [0, 0, 1], 0, 6, 4.5, { tone: 'lo' });
    box('outdoor-shell', '室外机底盘', 31, -35, 117, 89, 2, 4, { r: 3 });
    box('outdoor-shell', '室外左框下段', 31, -35, 2, 89, 6, 14, { r: .5 });
    box('outdoor-shell', '室外左框上段', 31, -35, 2, 89, 28, 85, { r: .5 });
    box('outdoor-shell', '液管穿孔后沿', 31, -35, 2, 7, 20, 8, { r: .2 });
    box('outdoor-shell', '液管穿孔前沿', 31, -20, 2, 74, 20, 8, { r: .2 });
    const cover = { r: .5, cover: true, move: [26, 0, 0] };
    box('outdoor-shell', '右检修板下段', 145, -35, 3, 89, 6, 68, cover);
    box('outdoor-shell', '气管孔后沿', 145, -35, 3, 23, 74, 8, cover);
    box('outdoor-shell', '气管孔前沿', 145, 10, 3, 44, 74, 8, cover);
    box('outdoor-shell', '右检修板中段', 145, -35, 3, 89, 82, 18, cover);
    box('outdoor-shell', '盘管孔后沿', 145, -35, 3, 6, 100, 8, cover);
    box('outdoor-shell', '盘管孔前沿', 145, -19, 3, 73, 100, 8, cover);
    box('outdoor-shell', '右检修板上段', 145, -35, 3, 89, 108, 5, cover);
    box('outdoor-shell', '室外机顶盖', 31, -35, 117, 89, 113, 3, { r: 2, cover: true, move: [0, 0, 21] });
    box('outdoor-shell', '压缩机检修盖', 111, 50, 37, 4, 6, 107, { r: 1.5, cover: true, move: [20, 20, 0] });
    for (let i = 0; i < 27; i++) box('outdoor-coil', '室外盘管铝翅片', 35 + i * 4.1, -34, .65, 13, 16, 92, { r: .2, tone: 'lo', color: 'outdoor' });
    const outdoor = [[142, -24, 104], [36, -24, 104], [36, -24, 85], [142, -24, 85], [142, -24, 66], [36, -24, 66], [36, -24, 47], [142, -24, 47], [142, -24, 24], [36, -24, 24]];
    pipe('outdoor-coil', '室外盘管铜管', outdoor, 2, { color: 'outdoor', trace: 'outdoor' });
    box('fan', '风扇电机固定横梁', 40, 13, 61, 3, 62, 4, { r: 1 });
    disc('fan', '室外风扇电机', [72, 13, 64], [0, 1, 0], -3, 11, 7, {});
    disc('fan', '室外风扇转轴', [72, 13, 64], [0, 1, 0], 11, 20, 2.8, {});
    // Blades are rounded solid prisms in the fan's own vertical plane.
    const FF = G.frameAlong([72, 35, 64], [0, 1, 0]);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, rot = ([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
      const poly = [[3, -4], [17, -7], [27, -3], [30, 4], [23, 13], [11, 8]].map(rot);
      e('fan', '轴流风扇叶片', k.solidSvg(G.prismOf(FF, poly, 0, 1.4, P), { tone: 'mid' }), A.prism(FF, poly, 0, 1.4), [72, 35, 64]);
    }
    disc('fan', '轴流风扇轮毂', [72, 35, 64], [0, 1, 0], 1.4, 5, 7.5, {});
    for (let i = 0; i < 5; i++) ring('fan', '风扇金属护网', [72, 43, 64], [0, 1, 0], 0, .7, 10 + i * 6, 10.8 + i * 6, { tone: 'lo' });
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      pipe('fan', '护网径向筋', [[72 + Math.cos(a) * 5, 43, 64 + Math.sin(a) * 5], [72 + Math.cos(a) * 35.2, 43, 64 + Math.sin(a) * 35.2]], .48, {});
    }
    for (const [x, z] of [[36, 28], [108, 28], [36, 100], [108, 100]]) {
      box('fan', '护网固定耳', x - 2, 42, 4, 3, z - 2, 4, { r: 1 });
      disc('fan', '护网螺钉', [x, 45, z], [0, 1, 0], 0, .7, 1.3, {});
    }
    compressor(124, 16, 10, .86);
    disc('accumulator', '吸气气液分离器', [138, 34, 26], [0, 0, 1], 0, 31, 5.4, {});
    ring('accumulator', '分离器固定箍', [138, 34, 26], [0, 0, 1], 13, 15, 5.4, 6.2, {});
    disc('reversing', '四通换向阀阀体', [122, -7, 88], [1, 0, 0], -10, 10, 5, { color: 'brass' });
    disc('reversing', '先导电磁线圈', [132, -7, 88], [1, 0, 0], 0, 6, 6.2, { tone: 'lo' });
    for (const x of [115, 122, 129]) disc('reversing', '四通阀下接管', [x, -7, 83], [0, 0, 1], -5, 0, 1.8, { color: 'brass' });
    disc('reversing', '四通阀上接管', [122, -7, 93], [0, 0, 1], 0, 4, 1.8, { color: 'brass' });
    box('expansion', '双向节流阀体', 13, -32, 10, 9, 44, 10, { r: 2, color: 'brass' });
    disc('expansion', '电子节流阀驱动头', [18, -27.5, 54], [0, 0, 1], 0, 9, 4.4, {});
    disc('expansion', '节流阀阀盖', [18, -27.5, 63], [0, 0, 1], 0, 1.4, 5, {});
    pipe('pipes', '压缩机固定排气管', [[119.7, 16, 45], [119.7, 5, 45], [122, 5, 72], [122, -7, 78]], 1.65, { color: 'hot', trace: 'compression' });
    pipe('pipes', '室外气管', [[129, -7, 78], [138, -7, 78], [153, -7, 78], [153, -24, 104], [142, -24, 104]], 1.8, { color: 'outdoor-gas', trace: 'outdoor-gas' });
    pipe('pipes', '室内气管', [[-173, -17, 159], [-189, -17, 159], [-189, -47, 159], [164, -47, 159], [164, -47, 78], [164, 5, 78], [115, 5, 78], [115, -7, 78]], 2.15, { color: 'indoor-gas', trace: 'indoor-gas' });
    pipe('pipes', '室外液管', [[36, -24, 24], [25, -24, 24], [18, -24, 24], [18, -27.5, 44]], 1.5, { color: 'outdoor-liquid', trace: 'outdoor-liquid' });
    pipe('pipes', '室内液管', [[18, -32, 49], [0, -32, 49], [0, -32, 179], [-35, -17, 179]], 1.5, { color: 'indoor-liquid', trace: 'indoor-liquid' });
    pipe('pipes', '四通阀固定回气管', [[122, -7, 97], [122, -7, 103], [135, -7, 103], [135, 34, 103], [135, 34, 57]], 2, { color: 'gas' });
    pipe('pipes', '分离器至吸气口', [[141, 34, 57], [141, 34, 64], [141, 45, 64], [141, 45, 20.3], [141, 16, 20.3], [140.9, 16, 20.3]], 2, { color: 'gas' });
    // Internal short paths make the change of connection visible. Compressor
    // suction/discharge never reverse; only the valve-side links change.
    pipe('reversing', '制冷阀内高压通路', [[122, -7, 78], [125.5, -7, 88], [129, -7, 78]], 1.3, { color: 'hot', op: 'cool' });
    pipe('reversing', '制冷阀内低压通路', [[115, -7, 78], [115, -7, 91], [122, -7, 97]], 1.3, { color: 'gas', op: 'cool' });
    pipe('reversing', '制热阀内高压通路', [[122, -7, 78], [118.5, -7, 88], [115, -7, 78]], 1.3, { color: 'hot', op: 'heat' });
    pipe('reversing', '制热阀内低压通路', [[129, -7, 78], [129, -7, 91], [122, -7, 97]], 1.3, { color: 'gas', op: 'heat' });
    for (const [x, y] of [[35, -30], [144, -30], [35, 49], [144, 49]]) screw('outdoor-shell', x, y, 6, 1.3);
    for (const x of [-172, -40]) screw('indoor-shell', x, -26, 193, 1.2);
  }

  // True-shape ordering is solved once per machine, never on a playback frame.
  // The covers are separately selectable skins, and are hidden for this ordering
  // pass so the open mechanism remains the reference pose.
  A.settle(R, P, { states: [0] });
  items.sort((a, b) => a.key - b.key);
  const seen = new Set();
  const body = items.map(item => {
    const first = !seen.has(item.piece); seen.add(item.piece);
    const move = item.move ?? [0, 0, 0];
    const attrs = `data-cooling-part="${item.piece}" data-cooling-entity="${esc(item.name)}" data-piece="${item.piece}" data-move="${move.join(',')}"${item.cover ? ` data-cover="${item.cover}"` : ''}${item.op ? ` data-op="${item.op}"` : ''}${item.trace ? ` data-trace="${item.trace}"` : ''}`;
    return `<g ${attrs} class="cooling-solid${colorClass(item.color)}"${first ? ` role="button" tabindex="0" aria-label="${names[item.piece]}" aria-pressed="false"` : ''}><title>${esc(item.name)}</title>${item.svg}</g>`;
  }).join('');
  return { P, R, body: halo + body, count, routes };
}
