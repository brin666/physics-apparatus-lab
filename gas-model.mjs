// Deterministic teaching model for three quasi-static ideal-gas paths.
// SI units are used internally; display conversions happen only at the boundary.
const R = 8.31446261815324;
const CV_OVER_R = 2.5; // room-temperature diatomic ideal-gas approximation
const N_MOL = 101325 * 1.6e-3 / (R * 300);
const V0_M3 = 1.6e-3;
const P_ATM_PA = 101325;
const GAS_BORE_RADIUS_M = 0.041;
const GAS_AREA_M2 = Math.PI * GAS_BORE_RADIUS_M ** 2;
const GAS_BOTTOM_Y_M = 0.46;
const SCREW_SEAT_OFFSET_M = 0.045;
const SCREW_SPAN_M = 0.60;
const WHEEL_HUB_OFFSET_M = 0.010;
const SCREW_LEAD_M = 0.012;
const GAUGE_MIN_KPA = -20;
const GAUGE_MAX_KPA = 120;
const GAUGE_ZERO_ANGLE = 5 * Math.PI / 4;
const GAUGE_SWEEP = 3 * Math.PI / 2;

const clamp = (value, min = 0, max = 1) => {
  const n = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
};
const round = (n, digits = 2) => Number(n.toFixed(digits));

export const GAS_CONSTANTS = Object.freeze({
  gasConstantJPerMolK: R,
  heatCapacityCvOverR: CV_OVER_R,
  amountMol: N_MOL,
  initialVolumeM3: V0_M3,
  atmosphericPressurePa: P_ATM_PA,
  boreRadiusM: GAS_BORE_RADIUS_M,
  boreAreaM2: GAS_AREA_M2,
  chamberBottomY: GAS_BOTTOM_Y_M,
  screwSeatOffsetM: SCREW_SEAT_OFFSET_M,
  screwSpanM: SCREW_SPAN_M,
  wheelHubOffsetM: WHEEL_HUB_OFFSET_M,
  screwLeadM: SCREW_LEAD_M,
  gaugeMinKpa: GAUGE_MIN_KPA,
  gaugeMaxKpa: GAUGE_MAX_KPA,
});

const part = (id, no, name, hint, text, connection, explode) => ({
  id, no: String(no).padStart(2, '0'), name, hint, text, connection, explode,
});

export const EXPERIMENT = {
  id: 'gas',
  name: '气体实验台',
  title: '气体状态变化实验台',
  subtitle: '密闭活塞筒 · 恒温夹套 · p–V 状态路径',
  duration: 16,
  defaultMode: 'cut',
  description: '在同一份气体上改变边界条件：用活塞改变体积，用夹套交换热量，再比较等温、等压和等容路径。',
  parts: [
    part('bench', 1, '支承平台与门架', '把气缸、丝杆和水浴固定在同一工作台上。',
      '加厚台面承托气缸底座与恒温浴槽；两根立柱和顶部横梁构成丝杆反力架。丝杆的轴线与气缸、活塞同轴，手轮施加的位移不会偏压活塞。',
      '台面 → 立柱 → 顶部导向座；气缸底座和恒温浴槽分别锁在台面上。', [0, -0.08, 0]),
    part('cylinder', 2, '透明密闭活塞筒', '显示气体所在的封闭空间，读数刻度按截面积换算。',
      '耐压筒体的下腔装有固定量的气体，透明筒壁让活塞位置和气体空间可见。右侧竖尺以筒体截面积换算体积；下部侧口接压力计，侧面的密封套接温度探头。',
      '下端封头 → 气体腔 → 活塞密封面；下腔侧口 → 引压管 → 压力计。', [-0.22, 0, 0]),
    part('piston', 3, '带密封圈的活塞', '移动边界直接改变气体体积。',
      '活塞头在筒内滑动，双道密封圈把气体留在下腔。上表面的止推座承接丝杆端部；活塞面高度由状态方程求出的体积换算，刻度指针与它共用同一位置。',
      '活塞密封面 → 气体腔；活塞止推座 ↔ 丝杆端部。', [-0.30, 0.08, 0.08]),
    part('drive', 4, '手轮与加载丝杆', '转动丝杆，沿气缸轴线缓慢移动活塞。',
      '粗牙丝杆穿过门架导向座，下端通过止推座压在活塞上；手轮与丝杆同步转动。模拟中，手轮转角由活塞位移反算，因此丝杆端始终与活塞止推座接触。等容过程保持手轮不转。',
      '手轮 → 丝杆 → 活塞止推座；门架导向座承受反力。', [-0.18, 0.30, 0.15]),
    part('gauge', 5, '压力表与引压管', '表针显示相对环境的表压，状态方程读数使用绝对压强。',
      '底部引压管把气体压力传至波登管表头。指针刻度为表压，零点对应环境压强；教学读数同时给出绝对压强，避免把两种压力混用。',
      '气体腔下侧取压口 → 金属引压管 → 表头；表压 = 绝对压强 − 环境压强。', [0.34, 0.06, 0.12]),
    part('jacket', 6, '透明恒温夹套', '让气体在缓慢变化时与水浴交换热量。',
      '夹套以环形水道包围气缸下段，浅蓝色液体表示循环水。夹套仅作为热交换边界的教学示意，不表示温度场或真实换热速率。',
      '浴槽供液 → 夹套上口；夹套下口 → 浴槽回液。', [-0.16, 0.02, 0.15]),
    part('bath', 7, '循环恒温浴槽', '储液并提供恒温边界。',
      '带透明液位窗的浴槽放在同一台面上。供液和回液软管连接夹套；浴槽代表热源或热汇，等温过程可通过它向气体供热或带走热量。',
      '浴槽泵口 → 供液软管 → 夹套 → 回液软管 → 浴槽。', [0.42, -0.04, -0.03]),
    part('plumbing', 8, '供液与回液管', '两条独立软管把浴槽与夹套接成循环。',
      '红色供液管接夹套上口，蓝色回液管接夹套下口；两条管分别沿台面后侧绕行，端口位置与浴槽接头和夹套接头对应。颜色只区分回路，不表示实测温度。',
      '浴槽供液口 → 红色软管 → 夹套上口；夹套下口 → 蓝色软管 → 浴槽回液口。', [0.18, 0.16, -0.14]),
    part('probe', 9, '气体温度探头', '探头进入下腔；模拟读数由同一状态解给出。',
      '探头经压紧式密封套穿过夹套和筒壁，感温端位于气体腔内；外侧导线接到显示盒。温度值是模型状态量，不是传感器实验数据。',
      '探头感温端 → 气体腔；探头杆 → 密封套；导线 → 显示盒。', [-0.24, -0.03, 0.19]),
  ],
  assemblies: [
    { name: '工作台与支承门架', short: '支承', text: '先固定台面、门架和气缸底座，建立同轴的运动基准。', ids: ['bench'] },
    { name: '密闭气缸与读数刻度', short: '气缸', text: '装入透明筒体、底部取压口和按体积标定的竖尺。', ids: ['cylinder'] },
    { name: '活塞与止推座', short: '活塞', text: '放入带密封圈的活塞头，让它沿筒壁轴向滑动。', ids: ['piston'] },
    { name: '丝杆与压力表', short: '加载', text: '丝杆端接触活塞止推座；引压管接到表头。', ids: ['drive', 'gauge'] },
    { name: '恒温浴槽与循环夹套', short: '恒温边界', text: '把浴槽供液、回液接到围绕气缸的水道。', ids: ['jacket', 'bath', 'plumbing'] },
    { name: '探头与线路', short: '测温', text: '探头穿过密封套进入气腔，导线连到显示盒。', ids: ['probe'] },
  ],
  stages: [
    { name: '装置与初态', title: '封闭气体，记录初态', caption: '同一份气体 · p₀、V₀、T₀', text: '活塞密封面以下是研究对象。模型固定气体物质的量 n，由当前初始温度和初始体积求出初始压强。' },
    { name: '边界条件', title: '只改变指定的边界条件', caption: '等温 · 等压 · 等容', text: '等温过程靠恒温夹套缓慢交换热量；等压过程调节活塞并同步升温；等容过程锁住丝杆，只改变温度。' },
    { name: '状态变化', title: '压力表、活塞和探头一起响应', caption: 'pV = nRT', text: '每一帧都由同一组 n、p、V、T 关系求得。活塞高度对应体积，表针对应表压，探头读数对应气体温度。' },
    { name: '图像与能量', title: '把过程画到 p–V 图上', caption: 'ΔU = Q − W', text: '图中压强采用绝对压强；功 W 规定为气体对外做功，热量 Q 规定为进入气体为正。三种路径的曲线和能量账均由同一状态解生成。' },
  ],
  operations: [
    { id: 'isothermal', name: '等温', principle: '缓慢压缩；夹套补充或带走热量，使气体温度保持不变。' },
    { id: 'isobaric', name: '等压', principle: '活塞缓慢上移，气体吸热升温；体积和温度同比增加，压强保持初值。' },
    { id: 'isochoric', name: '等容', principle: '锁住丝杆和活塞；浴槽加热气体，温度与压强上升，体积不变。' },
  ],
  inputs: [
    { id: 'initialTemperature', label: '初始温度', min: 260, max: 360, step: 10, value: 300, unit: 'K' },
  ],
  notes: [
    { title: '课本锚点', text: '人教版《普通高中教科书·物理·选择性必修第三册》第二章第2节《气体的等温变化》（p.23）是等温过程锚点；本实验台把该章的等温、等压和等容变化放到同一装置中比较。固定 n 的理想气体满足 pV = nRT；等温时 pV 不变，等压时 V/T 不变且气体做功 W = pΔV，等容时 ΔV = 0、气体不做体积功。' },
    { title: '能量符号', text: '本模型采用 ΔU = Q − W，W 表示气体对外做功，Q 表示进入气体的热量。内能变化按常温双原子理想气体 Cv ≈ 5R/2 估算，忽略振动自由度。' },
    { title: '教学抽象', text: '装置综合了课堂气体状态实验常见的活塞筒、压力计、温度探头和恒温浴边界；它不是某台 PEP 精确型号的复刻，也不提供真实实验测量值。路径按理想气体和准静态约束计算，不模拟摩擦、泄漏、热滞后或空间温差。' },
  ],
  sources: [
    { label: 'OpenStax《College Physics 2e》13.3 · 理想气体状态方程', url: 'https://openstax.org/books/college-physics-2e/pages/13-3-the-ideal-gas-law' },
    { label: 'OpenStax《College Physics 2e》15.2 · 热力学第一定律与简单过程', url: 'https://openstax.org/books/college-physics-2e/pages/15-2-the-first-law-of-thermodynamics-and-some-simple-processes' },
  ],
};

/** Compute one deterministic point on the selected finite process. */
export function computeExperiment({ progress = 0, operation = 'isothermal', inputs = {} } = {}) {
  progress = clamp(progress);
  if (!EXPERIMENT.operations.some((item) => item.id === operation)) operation = 'isothermal';
  const T0 = clamp(inputs.initialTemperature ?? inputs.initialTemperatureK ?? 300, 260, 360);
  const V0 = V0_M3;
  const n = N_MOL;
  const p0 = n * R * T0 / V0;
  let V, T;

  if (operation === 'isothermal') {
    V = V0 * (1 - 0.38 * progress);
    T = T0;
  } else if (operation === 'isobaric') {
    V = V0 * (1 + 0.40 * progress);
    T = T0 * (V / V0);
  } else {
    V = V0;
    T = T0 * (1 + 0.30 * progress);
  }

  const p = n * R * T / V;
  const workByGas = operation === 'isothermal'
    ? n * R * T0 * Math.log(V / V0)
    : operation === 'isobaric' ? p0 * (V - V0) : 0;
  const deltaU = n * CV_OVER_R * R * (T - T0);
  const heatIntoGas = deltaU + workByGas;
  const pressureGaugePa = p - P_ATM_PA;
  const pressureGaugeKpa = pressureGaugePa / 1000;
  const gaugeFraction = clamp((pressureGaugeKpa - GAUGE_MIN_KPA) / (GAUGE_MAX_KPA - GAUGE_MIN_KPA));
  const needleAngle = GAUGE_ZERO_ANGLE - gaugeFraction * GAUGE_SWEEP;
  const pistonFaceY = GAS_BOTTOM_Y_M + V / GAS_AREA_M2;
  const initialPistonFaceY = GAS_BOTTOM_Y_M + V0 / GAS_AREA_M2;
  const wheelY = pistonFaceY + SCREW_SEAT_OFFSET_M + SCREW_SPAN_M + WHEEL_HUB_OFFSET_M;
  const wheelAngle = ((pistonFaceY - initialPistonFaceY) / SCREW_LEAD_M) * 2 * Math.PI;

  const makeState = (t) => {
    let sampleV, sampleT;
    if (operation === 'isothermal') {
      sampleV = V0 * (1 - 0.38 * t); sampleT = T0;
    } else if (operation === 'isobaric') {
      sampleV = V0 * (1 + 0.40 * t); sampleT = T0 * (sampleV / V0);
    } else {
      sampleV = V0; sampleT = T0 * (1 + 0.30 * t);
    }
    return [round(sampleV * 1e6, 1), round(n * R * sampleT / sampleV / 1000, 2)];
  };

  const stageIndex = progress >= 1 ? 3 : Math.min(3, Math.floor(progress * EXPERIMENT.stages.length));
  const stageProgress = progress >= 1 ? 1 : progress * EXPERIMENT.stages.length - stageIndex;
  const operationInfo = EXPERIMENT.operations.find((item) => item.id === operation);
  const volumeMl = V * 1e6;
  const pressureKpa = p / 1000;
  const geometry = {
    pistonFaceY,
    wheelY,
    wheelAngle,
    needleAngle,
    volumeM3: V,
    temperatureK: T,
    pressureGaugeKpa,
  };

  return {
    progress,
    operation,
    operationName: operationInfo.name,
    operationPrinciple: operationInfo.principle,
    stageIndex,
    stageProgress,
    stage: EXPERIMENT.stages[stageIndex],
    state: { amountMol: n, volumeM3: V, pressurePa: p, temperatureK: T },
    initial: { amountMol: n, volumeM3: V0, pressurePa: p0, temperatureK: T0 },
    pressureGaugePa,
    pressureGaugeKpa,
    workByGasJ: workByGas,
    heatIntoGasJ: heatIntoGas,
    deltaInternalEnergyJ: deltaU,
    readouts: [
      { label: '体积', value: round(volumeMl, 0), unit: 'mL' },
      { label: '绝对压强', value: round(pressureKpa, 1), unit: 'kPa' },
      { label: '温度', value: round(T, 1), unit: 'K' },
      { label: 'W · 气体对外', value: round(workByGas, 1), unit: 'J' },
      { label: 'Q · 进入气体', value: round(heatIntoGas, 1), unit: 'J' },
      { label: 'ΔU · 内能变化', value: round(deltaU, 1), unit: 'J' },
    ],
    plot: {
      xLabel: '体积 / mL',
      yLabel: '绝对压强 / kPa',
      points: Array.from({ length: 33 }, (_, i) => makeState(i / 32)),
      current: [round(volumeMl, 1), round(pressureKpa, 2)],
    },
    geometry,
  };
}
