// A teaching presentation order, not a manufacturing or service procedure.
export const ASSEMBLY_STEP_SECONDS=.75;
export const ASSEMBLY_MOVE_SECONDS=.72;
export const ASSEMBLY_STEPS=[
  {id:'stand',name:'机座与曲轴箱',short:'机座',selected:null,parts:['stand','case'],title:'先搭好机座、曲轴箱与轴承支承。',text:'机座和支架承托曲轴箱，箱体两端的轴承位置为曲轴提供支承。我们保留前侧剖面，后续装入的连接件始终看得见。',connection:'机座 → 曲轴箱 → 轴承',detail:'先建立“哪里转、哪里上下移动”的空间参照。此处是教学展示顺序，不是实际装配工艺。'},
  {id:'crank',name:'曲轴与飞轮',short:'曲轴',selected:'crank',parts:['crank','flywheel'],title:'把能够转动的曲轴安放到支承中。',text:'主轴沿固定轴线转动，偏离主轴中心的曲柄销留给连杆连接。后端的飞轮和曲轴一起转动。',connection:'飞轮 ↔ 曲轴',detail:'记住偏心的曲柄销：它是连接转动与往复运动的关键位置。'},
  {id:'rod',name:'连杆',short:'连杆',selected:'rod',parts:['rod'],title:'连杆大端，接到曲柄销上。',text:'连杆下端与偏心的曲柄销铰接，上端留给活塞销。两端可以相对转动，但连杆两销之间的距离保持不变。',connection:'连杆大端 ↔ 曲柄销',detail:'观察下方的连接点，再沿连杆向上找另一个连接点。'},
  {id:'piston',name:'活塞与活塞销',short:'活塞',selected:'piston',parts:['piston'],title:'用活塞销，把活塞和连杆小端接起来。',text:'活塞承受气体的作用力，通过活塞销传给连杆。活塞环位于外周，装入气缸后帮助密封。',connection:'活塞 ↔ 活塞销 ↔ 连杆小端',detail:'现在从上到下看：活塞、连杆、曲轴已经组成相连的传动链。'},
  {id:'cylinder',name:'气缸体',short:'缸体',selected:'cylinder',parts:['cylinder'],title:'让活塞进入气缸，沿轴线上下运动。',text:'气缸套从上方落位，包围活塞并为它导向，再与下方曲轴箱连接。我们保留教学剖面，让内部的连接关系仍然可见。',connection:'气缸导向活塞 · 下端连接曲轴箱',detail:'活塞能上下往复，连杆能摆动，曲轴能转动。它们的运动约束各不相同。'},
  {id:'head',name:'气缸盖',short:'缸盖',selected:'head',parts:['head'],title:'装上气缸盖，封住气缸的上端。',text:'气缸盖提供进排气通道、气门座和火花塞安装位置。活塞到最高处时，上方仍保留燃烧室空间。',connection:'气缸盖 ↔ 气缸体',detail:'留意活塞上方的空间，它不会在上止点缩小到零。'},
  {id:'valves',name:'进气门与排气门',short:'气门',selected:'intake',parts:['intake','exhaust'],title:'装入两道控制气体进出的“门”。',text:'进气门控制混合气进入，排气门控制燃烧后气体排出。气门在各自的座孔处开闭，本模型省略了驱动它们的配气机构。',connection:'气道 ↔ 气门座 ↔ 气缸',detail:'两扇门作用不同。四冲程里什么时候开、什么时候关，组装后就能观察。'},
  {id:'spark',name:'火花塞',short:'点火',selected:'spark',parts:['spark'],title:'最后装入火花塞，准备点燃混合气。',text:'火花塞的电极伸入燃烧室。它在压缩结束时点火，随后是燃烧后的高温高压气体推动活塞。',connection:'火花塞电极 → 燃烧室',detail:'全部构件已就位。接下来让曲轴转两圈，观察它们如何协同完成四个冲程。'}
];
export const ASSEMBLY_DURATION=ASSEMBLY_STEPS.length*ASSEMBLY_STEP_SECONDS;
const clamp=x=>x>=1-1e-10?1:Math.max(0,Math.min(1,x));
export function assemblyAt(input){
  const time=Math.max(0,Math.min(ASSEMBLY_DURATION,Number.isFinite(input)?input:0));
  const done=time>=ASSEMBLY_DURATION;
  const index=Math.min(ASSEMBLY_STEPS.length-1,Math.floor(time/ASSEMBLY_STEP_SECONDS));
  const parts={};
  ASSEMBLY_STEPS.forEach((step,i)=>{
    const elapsed=time-i*ASSEMBLY_STEP_SECONDS;
    for(const id of step.parts)parts[id]={visible:elapsed>=0,progress:clamp(elapsed/ASSEMBLY_MOVE_SECONDS)};
  });
  return {time,index,progress:time/ASSEMBLY_DURATION,done,parts};
}
