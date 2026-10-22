// Qualitative teaching model. Time follows one parcel of refrigerant; all four
// components operate together. These are not measured pressure/temperature data.
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
export const ASSEMBLY_DURATION = 5;
export const COOLING_SOURCES = [
  { name: 'Danfoss · 冰箱工作原理', url: 'https://www.danfoss.com/en/about-danfoss/our-businesses/cooling/the-fridge-how-it-works', scope: '压缩、冷凝、节流、蒸发与温控' },
  { name: '美国能源部 · 热泵系统', url: 'https://www.energy.gov/energysaver/heat-pump-systems', scope: '制冷与制热的热量搬运方向' },
  { name: '三花 · 四通换向阀', url: 'https://www.sanhuaeurope.com/en/products/4-way-reversing-valve-shf-r', scope: '通过改变制冷剂通路切换冷暖模式' },
];
const p = (id, no, name, hint, text, link) => ({ id, no: String(no).padStart(2, '0'), name, hint, text, link });
const step = (name, selected, text, short) => ({ name, selected, text, short });

export const COOLING_MACHINES = {
  fridge: {
    name: '电冰箱', subtitle: '把箱内的热搬到箱外', operations: ['cool'],
    description: '剖开一台直冷式冰箱，沿着密闭管路追踪制冷剂。箱内变冷，是因为热量被搬走。',
    parts: [
      p('shell', 1, '保温箱体', '减慢箱外热量进入。', '外壳与内胆之间夹着保温层。它减少热传递，让制冷系统更容易维持箱内低温。', '包住冷藏空间，与门封条一起保温。'),
      p('door', 2, '箱门与门封', '关严后减少空气交换。', '磁性门封贴住箱体，减少暖空气进入。开门时仍会有热量进入，所以要重新制冷。', '门封围住箱体前沿。'),
      p('evaporator', 3, '蒸发器', '制冷剂在这里汽化吸热。', '低压制冷剂流过箱内蒸发器，吸收箱内的热量。液体逐渐汽化，离开时成为气体。', '节流出口 → 蒸发器 → 压缩机吸气口。'),
      p('condenser', 4, '冷凝器', '向箱外空气散热。', '高温高压气体在这里放出热量，逐渐液化。冰箱背面发热，就是散热过程的一个表现。', '压缩机排气口 → 冷凝器 → 过滤干燥器。'),
      p('compressor', 5, '压缩机', '用电推动制冷剂循环。', '它吸入低压气体，压缩成温度更高的高压气体。压缩后仍是气体，不能把压缩说成液化。', '蒸发器回气 → 压缩机 → 冷凝器。'),
      p('expansion', 6, '毛细管', '细管使制冷剂降压。', '高压液体穿过很细的管路，压力降低。一部分液体闪蒸，出口是低压、低温的气液混合物。', '过滤干燥器 → 毛细管 → 蒸发器。'),
      p('filter', 7, '过滤干燥器', '拦住杂质，吸收水分。', '它装在毛细管前，帮助保持管路洁净。水分或杂质可能堵住细小通道。', '冷凝器出口 → 过滤干燥器 → 毛细管。'),
      p('pipes', 8, '密闭管路', '制冷剂在管中循环使用。', '管路把各部件连成封闭回路。正常工作时，制冷剂不与箱内空气混合。', '压缩 → 冷凝 → 节流 → 蒸发 → 再回到压缩。'),
      p('thermostat', 9, '温控器与感温头', '够冷后让压缩机休息。', '感温头检测箱内温度，控制器据此启停压缩机。图中的循环进度只表示一段制冷剂的位置，不是温度读数。', '感温头测箱内温度，控制器连接压缩机。'),
    ],
    assemblies: [
      step('内部空间与蒸发器', 'evaporator', '先放入搁架和蒸发器，看清箱内的吸热部件。', '蒸发器'),
      step('压缩机与冷凝器', 'compressor', '装入压缩机和背部冷凝器，先保留开放的视野。', '压缩机'),
      step('过滤与节流', 'expansion', '过滤干燥器连接毛细管，毛细管后接蒸发器。', '节流件'),
      step('接成密闭回路', 'pipes', '管路接回压缩机，温控器负责按需启停。', '管路'),
      step('最后装上箱体和门', 'door', '内部部件和铜管就位后，再合上保温箱体与箱门。', '外壳'),
    ],
  },
  ac: {
    name: '热泵空调', subtitle: '室内、室外交换热量', operations: ['cool', 'heat'],
    description: '室内机负责送风，室外机装着压缩机。切换冷暖时，两个换热器交换任务。',
    parts: [
      p('indoor-shell', 1, '室内机外壳', '组织回风与出风。', '室内空气从进风口进入，经过换热器后送回房间。外壳包住内部部件，并不输送室外空气进来。', '进风口 → 过滤网 → 换热器 → 贯流风轮 → 出风口。'),
      p('filter', 2, '空气过滤网', '先拦住空气中的灰尘。', '过滤网位于室内回风入口。它过滤的是空气，与制冷剂管路分开。', '回风口之后，室内换热器之前。'),
      p('indoor-coil', 3, '室内换热器', '制冷时吸热，制热时放热。', '制冷时它是蒸发器，制冷剂汽化并吸收室内热量。制热时它是冷凝器，制冷剂液化并向室内放热。', '制冷：节流后进入；制热：压缩机排气经四通阀进入。'),
      p('blower', 4, '贯流风轮', '推动室内空气经过翅片。', '细长风轮转动，让房间空气不断经过换热器。风轮搬运空气，压缩机推动制冷剂，两者分工不同。', '换热器后的空气经风轮送向出风口。'),
      p('louver', 5, '导风板', '改变送风方向。', '导风板摆动时，出风方向随之改变。它不切换制冷剂流向。', '位于室内机出风口。'),
      p('outdoor-shell', 6, '室外机机壳', '保护室外工作部件。', '机壳与底盘固定压缩机、风机和管路。格栅让空气通过，也保护旋转的扇叶。', '底盘支撑压缩机，背侧固定换热器。'),
      p('outdoor-coil', 7, '室外换热器', '把热量交给室外或从室外取热。', '制冷时它是冷凝器，向室外空气散热。制热时它是蒸发器，从室外空气吸热。', '制冷接压缩机排气；制热接节流后的低压制冷剂。'),
      p('fan', 8, '室外风扇', '让室外空气掠过换热器。', '风扇促进空气与翅片之间的换热。空气留在室外，制冷剂留在密闭铜管内。', '室外空气经过换热器，再由风扇排出。'),
      p('compressor', 9, '压缩机', '冷暖模式下都压缩气体。', '压缩机把低压气体压成高温高压气体。切换冷暖时，吸气与排气方向保持不变。', '气液分离器 → 吸气口；排气口 → 四通阀。'),
      p('reversing', 10, '四通换向阀', '交换两个换热器的任务。', '阀内滑块改变高压排气与低压回气的通路。压缩机不用反转，空调也能在制冷和制热间切换。', '连接压缩机排气、回气、室内盘管和室外盘管。'),
      p('expansion', 11, '节流装置', '让液体降压并部分汽化。', '制冷剂经过节流装置后变成低压、低温的气液混合物。这里用双向节流装置示意，两种模式都先节流再进入蒸发器。', '冷凝器出口 → 节流装置 → 当前的蒸发器。'),
      p('accumulator', 12, '气液分离器', '减少液体进入压缩机的风险。', '回气中的残余液体先留在分离器中，气体再进入压缩机。它帮助避免液态制冷剂直接冲入压缩机。', '四通阀低压回气 → 分离器 → 压缩机吸气口。'),
      p('pipes', 13, '连接铜管', '两台机组共用一个密闭回路。', '粗细铜管在室内机与室外机间输送制冷剂。四通阀换向后，连接管内的流向与作用随之改变。', '连接两侧换热器、节流装置和四通阀。'),
      p('drain', 14, '接水盘与排水管', '排走水蒸气液化形成的水。', '制冷时，空气中的水蒸气遇到冷翅片可能液化。水滴落入接水盘，再经机背的排水管穿墙，沿向下的坡度排到室外；这不是制冷剂泄漏。', '接水盘 → 机背排水管 → 穿墙后向室外低处排水。'),
    ],
    assemblies: [
      step('室内换热与送风', 'indoor-coil', '先放入翅片盘管、贯流风轮和接水盘。', '室内机'),
      step('室外换热与风机', 'outdoor-coil', '室外换热器与风扇共同完成空气换热。', '室外机'),
      step('压缩与回气保护', 'compressor', '压缩机前装气液分离器，回到吸气口的应是气体。', '压缩机'),
      step('换向、节流与连接', 'reversing', '装上四通阀、节流件并接通铜管，先看清完整回路。', '管路'),
      step('最后装上外壳', 'indoor-shell', '内部连接完成后，再装过滤网、导风板、护网和外壳。', '外壳'),
    ],
  },
};

export function getCoolingLesson(kind = 'fridge', operation = 'cool') {
  kind = kind === 'ac' ? 'ac' : 'fridge';
  operation = kind === 'ac' && operation === 'heat' ? 'heat' : 'cool';
  const isFridge = kind === 'fridge', heating = operation === 'heat';
  const heatFrom = isFridge ? '箱内' : heating ? '室外' : '室内';
  const heatTo = isFridge ? '箱外' : heating ? '室内' : '室外';
  const condenser = isFridge ? 'condenser' : heating ? 'indoor-coil' : 'outdoor-coil';
  const evaporator = isFridge ? 'evaporator' : heating ? 'outdoor-coil' : 'indoor-coil';
  const condenserName = isFridge ? '箱外冷凝器' : heating ? '室内换热器' : '室外换热器';
  const evaporatorName = isFridge ? '箱内蒸发器' : heating ? '室外换热器' : '室内换热器';
  const stages = [
    { id: 'compression', name: '压缩', title: '气体被压缩，温度升高', text: '压缩机吸入低压气体，把它压成高温高压气体。此时仍是气体，还没有液化。', caption: '低压气体 → 高温高压气体', energyTitle: '电能驱动压缩', energy: '压缩机消耗电能，对制冷剂做功；这是热量搬运所需的能量输入。', question: '压缩机出口已经变成液体了吗？', answer: '没有。出口仍是高温高压气体，要到冷凝器放热后才逐渐液化。', part: 'compressor', phaseIn: 'gas', phaseOut: 'gas', pressureIn: 'low', pressureOut: 'high', heat: 'work', exchangerRole: null },
    { id: 'condensation', name: '冷凝', title: `向${heatTo}放热，气体液化`, text: `高温高压气体进入${condenserName}，把热量交给${heatTo}空气。它逐渐冷凝为高压液体。`, caption: '高压气体 → 高压液体', energyTitle: `热量进入${heatTo}`, energy: `${heatTo}得到的热，包含从${heatFrom}搬来的热量，以及压缩机输入的能量。`, question: '液化时，制冷剂吸热还是放热？', answer: `液化放热。这个换热器把热量交给${heatTo}空气。`, part: condenser, phaseIn: 'gas', phaseOut: 'liquid', pressureIn: 'high', pressureOut: 'high', heat: 'release', exchangerRole: 'condenser' },
    { id: 'expansion', name: '节流', title: '压力降低，出现气液混合物', text: '高压液体流过狭窄的节流通道，压力下降。一部分液体迅速汽化，形成低压、低温的气液混合物。', caption: '高压液体 → 低压气液混合物', energyTitle: '为低温吸热创造条件', energy: '节流降压让制冷剂能在较低温度下沸腾。图中没有把这一步画成已完成全部汽化。', question: '节流后会立刻全部变成气体吗？', answer: '不会。一般先变成气液混合物，剩下的液体要在蒸发器中继续吸热汽化。', part: 'expansion', phaseIn: 'liquid', phaseOut: 'mixture', pressureIn: 'high', pressureOut: 'low', heat: 'none', exchangerRole: null },
    { id: 'evaporation', name: '蒸发', title: `从${heatFrom}吸热，液体汽化`, text: `气液混合物进入${evaporatorName}，从${heatFrom}吸收热量。剩余液体逐渐汽化，以气体状态回到压缩机。`, caption: '低压气液混合物 → 低压气体', energyTitle: `热量离开${heatFrom}`, energy: `${heatFrom}的热量进入制冷剂。这是制冷剂循环的吸热处，汽化吸热可联系课本中的物态变化。`, question: `为什么${heatFrom}会失去热量？`, answer: '蒸发器中的制冷剂比周围冷，热量传给它，让液态部分不断汽化。', part: evaporator, phaseIn: 'mixture', phaseOut: 'gas', pressureIn: 'low', pressureOut: 'low', heat: 'absorb', exchangerRole: 'evaporator' },
  ];
  return { kind, operation, stages, heatFrom, heatTo, condenser, evaporator,
    summary: `热量从${heatFrom}搬到${heatTo}。四个部件同时工作，进度只跟踪一段制冷剂。`,
    simultaneous: true, compressorFlow: 'suction-to-discharge',
    exchangerRoles: { [condenser]: 'condenser', [evaporator]: 'evaporator' },
  };
}

export function coolingAt({ kind = 'fridge', operation = 'cool', progress = 0 } = {}) {
  const lesson = getCoolingLesson(kind, operation);
  progress = clamp(Number(progress));
  // The endpoint deliberately shows the completed last stage, before replay.
  const stageIndex = Math.min(3, Math.floor(progress * 4));
  const stageProgress = progress === 1 ? 1 : progress * 4 - stageIndex;
  return { ...lesson, progress, stageIndex, stageProgress, stage: lesson.stages[stageIndex] };
}

export function assemblyAt(kind = 'fridge', time = 0) {
  kind = kind === 'ac' ? 'ac' : 'fridge';
  const progress = clamp(Number(time) / ASSEMBLY_DURATION);
  const steps = COOLING_MACHINES[kind].assemblies;
  const index = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  return { kind, progress, index, step: steps[index], steps, time: progress * ASSEMBLY_DURATION, duration: ASSEMBLY_DURATION, complete: progress === 1 };
}
