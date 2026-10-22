// Calibrated teaching model for a Joule paddle-wheel calorimeter.
// The dimensions and calibration are illustrative; the readouts are computed,
// not experimental measurements.

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const G = 9.81;
const DROP_HEIGHT_M = 0.65;
const DRUM_RADIUS_M = 0.045;
const PULLEY_RADIUS_M = 0.075;
const AMBIENT_C = 20;
const WATER_SPECIFIC_HEAT = 4186;
const COPPER_SPECIFIC_HEAT = 385;
const CUP_COPPER_KG = 0.16;
const PADDLE_COPPER_KG = 0.035;
const DROP_SHARE = 0.76;
export const JOULE_RIG = Object.freeze({
  dropHeightM: DROP_HEIGHT_M,
  drumRadiusM: DRUM_RADIUS_M,
  pulleyRadiusM: PULLEY_RADIUS_M,
  ambientC: AMBIENT_C,
  initialWeightY: 0.955,
  cupBottomY: 0.31,
  cupTopY: 0.43,
  cupInnerRadiusM: 0.085,
  shaftAxis: [0, 1.27, 0.06],
  pulleyLeft: [-0.43, 1.39, 0.02],
  pulleyRight: [0.43, 1.30, 0.10],
  massLeft: [-0.505, 0.955, 0.02],
  massRight: [0.505, 0.955, 0.10],
});

const part = (id, no, name, hint, text, connection, explode) => ({
  id,
  no: String(no).padStart(2, '0'),
  name,
  hint,
  text,
  connection,
  explode,
});

export const EXPERIMENT = {
  id: 'joule',
  name: '焦耳实验',
  title: '焦耳热功当量实验',
  subtitle: '让下落砝码搅动水，再用温升追踪机械功',
  duration: 18,
  defaultMode: 'cut',
  parts: [
    part('frame', 1, '支架与底座', '固定滑轮、传动轴和量热器。', '刚性横梁支承顶部滑轮，立柱和底座承受砝码拉力；量热器坐在下方支座上。尺寸是教学示意，不复刻历史仪器。', '立柱 → 滑轮轴承；底座 → 量热器支承环。', [-0.48, 0.12, -0.24]),
    part('calorimeter', 2, '铜量热器', '盛水并收集搅拌产生的热。', '铜杯由前侧可拆扇区和后侧闭合壳组成，配有盖板和轴封。剖切模式移开前侧大扇区，露出水和叶片；两个闭合扇区装配后围成杯体。', '底座支承 → 铜杯；盖板 → 竖直搅拌轴。', [0.22, 0.02, 0.55]),
    part('water', 3, '水样', '水的热容决定温升大小。', '模型按水的质量和比热容计算水吸收的热量。水面高度也按圆筒容积估算；显示的温升是理想计算值，不是仪器读数。', '水与铜杯、铜叶轮共同计入热容。', [0.22, 0.27, 0.43]),
    part('baffles', 4, '固定挡片', '阻止水跟着叶轮整体空转。', '杯壁上的固定挡片扰乱旋转水流，使叶片持续对水做功。它们保持静止，与转动叶轮保持间隙。', '固定在铜杯内壁，与转动叶片错开。', [0.42, 0.18, 0.22]),
    part('stirrer', 5, '搅拌轴与叶轮', '把轴的转动传给水。', '竖直轴穿过盖板，带动多层叶片在水中转动。叶轮与固定挡片交错，水的黏滞阻力把有序转动耗散为内能。', '立式轴 → 叶轮；上端锥齿轮 → 横轴锥齿轮。', [-0.20, 0.13, 0.37]),
    part('drive', 6, '横轴、卷筒与棘轮', '合并两侧砝码的驱动。', '两根绳分别切向牵引同轴双卷筒；卷筒经一对 1:1 直角锥齿轮驱动竖轴。单向棘轮在人工提升砝码时锁住叶轮轴，避免把回程误算成反向做功。', '双卷筒 → 横轴锥齿轮 → 立轴锥齿轮。', [0.04, 0.23, -0.34]),
    part('pulleys', 7, '定滑轮与轴承', '改变绳子的方向。', '两个带槽滑轮分别把悬挂砝码的竖直拉力转成卷筒的切向拉力。左右绳路在不同高度接触卷筒的上、下切点，使两侧下降时对横轴产生同向转矩。', '滑轮固定在支架；轮槽承托钢丝绳。', [0.35, 0.32, 0.28]),
    part('ropes', 8, '传动绳', '连接砝码、滑轮与卷筒。', '钢丝绳绕过滑轮后，在卷筒上以相反绕向收放。下降段随砝码移动；回程由棘轮机构隔离，温升账目只记录下落阶段的重力势能减少。', '砝码吊环 → 定滑轮 → 双卷筒。', [-0.10, 0.32, -0.28]),
    part('weights', 9, '双侧砝码', '每侧质量相同并同步下降。', '两块砝码在释放时同步下降。每侧的重力势能减少量是 mgh，因此总输入按两侧计算：W = 2mghN。回程提升由外力完成，明确排除在该输入功之外。', '每侧砝码 → 独立绳路；两绳驱动同一横轴。', [0.42, 0.24, 0.16]),
    part('thermometer', 10, '温度计', '观察水温变化。', '温度计穿过杯盖，感温球浸在水中。红色液柱按模型温升作放大显示，刻度只是示意；计算把输入功均匀分配给水、铜杯和叶轮。', '感温球浸水；杆身固定在杯盖。', [-0.25, 0.28, 0.27]),
  ],
  assemblies: [
    { name: '支架与铜杯', short: '支架', text: '先固定支架和铜量热器，支架承受顶部滑轮的拉力。', ids: ['frame', 'calorimeter'] },
    { name: '水样与测温', short: '水样', text: '向铜杯加入水，并将温度计感温球浸入水中。', ids: ['water', 'thermometer'] },
    { name: '叶轮与固定挡片', short: '叶轮', text: '竖轴带动叶片，杯壁挡片保持静止，让水受到剪切和搅动。', ids: ['baffles', 'stirrer'] },
    { name: '横轴与单向棘轮', short: '传动轴', text: '横轴上的双卷筒通过锥齿轮驱动立轴，棘轮负责隔离人工回程。', ids: ['drive'] },
    { name: '滑轮与传动绳', short: '绳轮', text: '将两根绳分别搭到滑轮槽，再按相反方向绕到两个卷筒切点。', ids: ['pulleys', 'ropes'] },
    { name: '挂上双侧砝码', short: '砝码', text: '最后挂上相同砝码。释放后，两侧同时下降并驱动叶轮。', ids: ['weights'] },
  ],
  stages: [
    { name: '势能', title: '砝码具有重力势能', caption: '起点：两侧砝码都被提升', text: '每侧质量为 m 的砝码升高 h，重力势能为 mgh。两块砝码一起释放，初始可用能量是 2mgh。' },
    { name: '传动', title: '绳轮把下落传给转轴', caption: '下落：绳拉卷筒，锥齿轮驱动立轴', text: '砝码下落时，绳绕过定滑轮并牵引卷筒。卷筒和锥齿轮把转动传给竖直搅拌轴；单向棘轮在回程时防止叶轮轴倒转。' },
    { name: '耗散', title: '叶片搅水，机械功转为内能', caption: '水流受阻：搅拌功逐渐耗散', text: '旋转叶片与固定挡片让水产生剪切和涡流。宏观机械能逐渐耗散，水、铜杯和叶轮的内能增加。' },
    { name: '测温', title: '温度计显示计算温升', caption: '结果：比较重力势能与热容变化', text: '模型按 ΔT = W / (m水 c水 + C铜杯 + C叶轮) 计算温升。理想化计算忽略对外散热、轴承摩擦发热和砝码动能残留；数值不代表一次真实实验的测量结果。' },
  ],
  inputs: [
    { id: 'massKg', label: '每侧砝码质量', min: 0.25, max: 2, step: 0.25, value: 1.5, unit: 'kg' },
    { id: 'dropCount', label: '下落次数', min: 1, max: 40, step: 1, value: 8, unit: '次' },
    { id: 'waterMassG', label: '水的质量', min: 600, max: 2400, step: 100, value: 1500, unit: 'g' },
  ],
  notes: [
    { title: '模型标定', text: '机械结构是自绘教学示意，不是历史仪器扫描。重力加速度取 9.81 m/s²；单次下降高度 0.65 m；两侧质量相同；输入功按 2mghN 计算。' },
    { title: '热量假设', text: '理想计算令全部重力势能减少转化为水、铜杯和叶轮的热量。水比热容取 4186 J/(kg·K)，铜的比热容取 385 J/(kg·K)，杯体等效铜质量 0.16 kg，叶轮等效铜质量 0.035 kg。默认水量较大，8 次下降的理想温升约 0.024 °C；液柱放大显示，但温升数字不放大。实际装置还会有环境散热、轴承摩擦等影响。' },
    { title: '回程处理', text: '砝码回到起点的动画代表人工重新提升。模型以单向棘轮隔离叶轮，回程不反转叶轮、不计入本次下落功；再次释放才增加累计输入。' },
    { title: '教材锚点', text: '可对照人教版《选择性必修第三册》第三章第一节“功、热和内能的改变”图 3.1-1。此处只标注教材知识位置，模型并未声称复刻该图。' },
  ],
  sources: [
    { label: '日本机械学会誌：焦耳实验仪器', url: 'https://www.jsme.or.jp/kaisi/1214-40/' },
    { label: 'Science Museum Group：焦耳机械当量仪器', url: 'https://collection.sciencemuseumgroup.org.uk/objects/co2526/mechanical-equivalent-of-heat-apparatus' },
  ],
};

function getInputs(inputs = {}) {
  return {
    massKg: clamp(finite(inputs.massKg, 1.5), 0.25, 2),
    dropCount: Math.round(clamp(finite(inputs.dropCount, 8), 1, 40)),
    waterMassG: clamp(finite(inputs.waterMassG, 1500), 600, 2400),
  };
}

/**
 * Progress drives repeated drop/haul cycles. Hauling is a visible manual reset;
 * the one-way clutch keeps the stirrer angle and energy tally from reversing.
 */
export function computeExperiment({ progress = 0, operation = 'heat', inputs = {} } = {}) {
  const p = clamp(Number(progress), 0, 1);
  const selected = getInputs(inputs);
  const N = selected.dropCount;
  let cycleIndex, cycleProgress, dropFraction, liftFraction, weightFraction, workDrops, phase;

  if (p >= 1) {
    cycleIndex = N - 1;
    cycleProgress = 1;
    dropFraction = 1;
    liftFraction = 0;
    weightFraction = 1;
    workDrops = N;
    phase = 'complete';
  } else {
    const t = p * N;
    cycleIndex = Math.min(N - 1, Math.floor(t));
    cycleProgress = t - cycleIndex;
    if (cycleIndex === N - 1) {
      // The final repetition is a continuous drop; there is no last-frame lift.
      dropFraction = cycleProgress;
      liftFraction = 0;
      weightFraction = dropFraction;
      workDrops = cycleIndex + dropFraction;
      phase = 'drop';
    } else if (cycleProgress <= DROP_SHARE) {
      dropFraction = cycleProgress / DROP_SHARE;
      liftFraction = 0;
      weightFraction = dropFraction;
      workDrops = cycleIndex + dropFraction;
      phase = 'drop';
    } else {
      dropFraction = 1;
      liftFraction = (cycleProgress - DROP_SHARE) / (1 - DROP_SHARE);
      weightFraction = 1 - liftFraction;
      workDrops = cycleIndex + 1;
      phase = 'manual-reset';
    }
  }

  const mass = selected.massKg;
  const waterKg = selected.waterMassG / 1000;
  const workPerDrop = 2 * mass * G * DROP_HEIGHT_M;
  const workJ = workPerDrop * workDrops;
  const waterCapacity = waterKg * WATER_SPECIFIC_HEAT;
  const copperCapacity = (CUP_COPPER_KG + PADDLE_COPPER_KG) * COPPER_SPECIFIC_HEAT;
  const totalHeatCapacity = waterCapacity + copperCapacity;
  const temperatureRiseC = workJ / totalHeatCapacity;
  const temperatureC = AMBIENT_C + temperatureRiseC;
  const shaftAngle = (workDrops * DROP_HEIGHT_M) / DRUM_RADIUS_M;
  const drumTravelFraction = phase === 'manual-reset' ? 1 - liftFraction : dropFraction;
  const drumAngle = (drumTravelFraction * DROP_HEIGHT_M) / DRUM_RADIUS_M;
  const pulleyAngle = ((dropFraction - liftFraction) * DROP_HEIGHT_M) / PULLEY_RADIUS_M;
  const stageIndex = Math.min(EXPERIMENT.stages.length - 1, Math.floor(p * EXPERIMENT.stages.length));
  const stageProgress = p === 1 ? 1 : p * EXPERIMENT.stages.length - stageIndex;
  const waterHeightM = waterKg / (1000 * Math.PI * JOULE_RIG.cupInnerRadiusM ** 2);
  const currentDrop = p === 1 ? N : Math.min(N, cycleIndex + 1);
  const digits = temperatureRiseC < 0.1 ? 3 : 2;
  const caption = phase === 'manual-reset'
    ? `第 ${cycleIndex + 1} 次下落已完成；人工提升砝码，棘轮锁住叶轮轴。回程不计入输入功。`
    : phase === 'complete'
      ? `完成 ${N} 次下落；总重力势能减少 ${workJ.toFixed(1)} J，模型温升约 ${temperatureRiseC.toFixed(digits)} °C。`
      : `第 ${currentDrop} / ${N} 次下落：每侧下降 ${(DROP_HEIGHT_M * dropFraction).toFixed(2)} m，叶轮只沿驱动方向转动。`;

  return {
    progress: p,
    operation,
    phase,
    stageIndex,
    stageProgress,
    stage: EXPERIMENT.stages[stageIndex],
    caption,
    equation: 'W = 2mghN;  ΔT = W / (m水 c水 + C铜杯 + C叶轮)',
    relation: '两块砝码的势能经双绳、滑轮、卷筒和锥齿轮传给叶轮；回程由棘轮隔离。模型把下落功按水、铜杯和叶轮的总热容折算为温升。',
    inputs: selected,
    massKg: mass,
    waterMassKg: waterKg,
    dropCount: N,
    completedDrops: workDrops,
    dropNumber: currentDrop,
    dropHeightM: DROP_HEIGHT_M,
    dropFraction,
    liftFraction,
    weightFraction,
    verticalDropM: DROP_HEIGHT_M * weightFraction,
    weightY: JOULE_RIG.initialWeightY - DROP_HEIGHT_M * weightFraction,
    workPerDropJ: workPerDrop,
    workJ,
    totalPotentialEnergyLossJ: workJ,
    waterHeatCapacityJPerK: waterCapacity,
    totalHeatCapacityJPerK: totalHeatCapacity,
    temperatureRiseC,
    temperatureC,
    waterHeightM,
    shaftAngle,
    shaftTurns: shaftAngle / (2 * Math.PI),
    paddleAngle: -shaftAngle,
    drumAngle,
    pulleyAngle,
    clutchEngaged: phase !== 'manual-reset',
    readouts: [
      { label: '重力势能减少', value: workJ.toFixed(1), unit: 'J' },
      { label: '叶轮转数', value: (shaftAngle / (2 * Math.PI)).toFixed(1), unit: '转' },
      { label: '模型温升', value: temperatureRiseC.toFixed(digits), unit: '°C' },
      { label: '模型终温', value: temperatureC.toFixed(digits), unit: '°C' },
    ],
    formula: `W = 2 × ${mass.toFixed(2)} kg × 9.81 m/s² × ${DROP_HEIGHT_M.toFixed(2)} m × ${workDrops.toFixed(2)} 次 = ${workJ.toFixed(1)} J`,
    thermalFormula: `ΔT = ${workJ.toFixed(1)} J / ${totalHeatCapacity.toFixed(1)} J/K = ${temperatureRiseC.toFixed(digits)} °C`,
    energyBalance: {
      workJ,
      heatToWaterJ: workJ * (waterCapacity / totalHeatCapacity),
      heatToCopperJ: workJ * (copperCapacity / totalHeatCapacity),
      lossesJ: 0,
      idealized: true,
    },
    modelAssumptions: {
      idealized: true,
      ambientLossesIgnored: true,
      manualResetWorkExcluded: true,
      allDropWorkAbsorbedByWaterAndCopper: true,
      operationIsContinuous: true,
    },
  };
}
