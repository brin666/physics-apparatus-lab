// A teaching mechanism, not a calibrated commercial engine. All dimensions in SI.
export const ENGINE = Object.freeze({crankY:0.11,r:0.036,rod:0.116,bore:0.08,pinToCrown:0.022,pistonHeight:0.038,headY:0.293});
export const STROKES = [
  {id:'intake',name:'吸气',range:'0°–180°',tag:'让混合气进入',color:'#608b9c',gas:'#a9ccd9',direction:'下行',valves:'进气门开 · 排气门关',title:'活塞下移，混合气进入气缸。',text:'进气门开启，曲轴带动活塞向下运动。气缸内空间增大，空气与汽油的混合气经进气道进入。',energyTitle:'曲轴带动活塞',energy:'这一冲程需要机械输入。飞轮释放前面储存的能量，帮助机构继续转动。',question:'活塞向下运动，就一定是在做功冲程吗？',answer:'不一定。吸气时活塞也向下，但进气门开启，混合气进入；做功时两门关闭，高温高压气体推动活塞。'},
  {id:'compression',name:'压缩',range:'180°–360°',tag:'把气体压紧',color:'#aa8c46',gas:'#d5bf89',direction:'上行',valves:'两气门关闭',title:'活塞上移，对气体做功。',text:'两气门关闭，活塞向上运动，混合气被压缩。在近似绝热的条件下，气体内能增加，温度升高。',energyTitle:'机械能 → 气体内能',energy:'压缩时是活塞对气体做功。燃烧尚未发生，火花塞也还没有点火。',question:'还没有燃烧，气体的温度为什么会升高？',answer:'活塞对气体做功，使气体内能增加。在近似绝热的压缩过程中，温度升高。'},
  {id:'power',name:'做功',range:'360°–540°',tag:'把膨胀变成转动',color:'#b56e4c',gas:'#dfaa7c',direction:'下行',valves:'两气门关闭',title:'燃烧后的气体，推动活塞。',text:'压缩结束时，火花塞点火。混合气迅速燃烧，气体温度和压强升高。随后气体膨胀，推动活塞向下，经连杆带动曲轴。',energyTitle:'化学能 → 内能 → 机械能',energy:'火花负责点燃混合气。真正推动活塞的是高温高压气体；在近似绝热膨胀阶段，气体对活塞做功，内能减小。',question:'是火花直接把活塞向下推吗？',answer:'不是。火花引发燃烧，燃料的化学能转化，气体内能增加。高温高压气体随后膨胀，对活塞做功。'},
  {id:'exhaust',name:'排气',range:'540°–720°',tag:'为下一循环腾出空间',color:'#8f8d87',gas:'#c6c5bf',direction:'上行',valves:'进气门关 · 排气门开',title:'活塞上移，排出燃烧后的气体。',text:'排气门开启，曲轴带动活塞向上运动，把燃烧后的气体经排气道排出。回到上止点后，开始下一次吸气。',energyTitle:'继续转动，排出废气',energy:'这一冲程也需要机械输入。飞轮使转动更平稳；废气带走的能量，是热机不能把燃料能量全部变成机械功的原因之一。',question:'一个循环里，曲轴转几圈，做功几次？',answer:'这个单缸四冲程模型中，曲轴转两圈，活塞往复两次，经历四个冲程，只有一次燃烧做功。'}
];
export const PARTS = [
  {id:'case',no:'10',name:'曲轴箱与轴承',hint:'支承曲轴',text:'箱体为曲轴提供安装空间，轴承支承曲轴旋转。拆解时将箱体与轴承作为一个总成观察。',link:'上接气缸体，下接机座。'},
  {id:'cylinder',no:'01',name:'气缸体',hint:'为活塞导向',text:'内部圆柱形空间容纳活塞，约束它沿轴线上下运动。剖开外壁，才能看见气体与活塞的关系。',link:'与气缸盖共同围成工作空间。'},
  {id:'head',no:'02',name:'气缸盖',hint:'封闭上端',text:'封闭气缸上端，安装气门和火花塞。活塞到达最高处时，顶部仍保留燃烧室空间。',link:'与气缸体密封连接，顶部有进、排气通道。'},
  {id:'intake',no:'03',name:'进气门',hint:'控制混合气进入',text:'吸气时打开，让空气与汽油的混合气进入。压缩和做功时关闭，帮助封住气缸。',link:'连接进气道与气缸；本图用蓝色区分入口。'},
  {id:'exhaust',no:'04',name:'排气门',hint:'控制废气排出',text:'排气时打开，活塞上移，把燃烧后的气体排出。其他冲程在本简化模型中关闭。',link:'连接气缸与排气道；本图用暖色区分出口。'},
  {id:'spark',no:'05',name:'火花塞',hint:'点燃混合气',text:'压缩结束时产生电火花，点燃混合气。火花提供点火条件，燃料释放的能量远大于点火火花。',link:'电极伸入燃烧室，不与活塞接触。'},
  {id:'piston',no:'06',name:'活塞',hint:'承受气体作用力',text:'在气缸中往复运动。做功时，气体推动活塞；压缩时，活塞挤压气体。活塞环帮助密封。',link:'通过活塞销与连杆小端铰接。'},
  {id:'rod',no:'07',name:'连杆',hint:'连接往复与转动',text:'两端分别与活塞销、曲柄销铰接。它随机构摆动，长度保持不变，把活塞运动与曲轴转动联系起来。',link:'小端接活塞销，大端接曲柄销。'},
  {id:'crank',no:'08',name:'曲轴',hint:'把动力传向外部',text:'曲柄销偏离主轴轴线，形成曲柄。活塞、连杆和曲柄共同构成滑块曲柄机构，使往复运动与转动相互联系。',link:'主轴支承在轴承上，曲柄销与连杆大端相连。'},
  {id:'flywheel',no:'09',name:'飞轮',hint:'储存和释放动能',text:'随曲轴一起转动，在做功时储存一部分动能，在其他冲程释放，使单缸发动机持续、较平稳地运转。',link:'固定在曲轴后端，与曲轴同步转动。'}
];
export function engineAt(input) {
  const raw=Number.isFinite(input)?input:0;
  const angle=((raw%720)+720)%720, rad=angle*Math.PI/180;
  const {r,rod,crankY,bore,headY,pinToCrown}=ENGINE;
  const crankX=r*Math.sin(rad),cy=crankY+r*Math.cos(rad);
  const pistonPinY=cy+Math.sqrt(rod*rod-crankX*crankX),pistonCrownY=pistonPinY+pinToCrown;
  const strokeIndex=Math.floor(angle/180),phaseProgress=(angle%180)/180;
  const lift=.005*Math.sin(Math.PI*phaseProgress)**2;
  const atEnd=Math.abs(Math.sin(rad))<1e-9;
  return {angle,rad,strokeIndex,strokeId:STROKES[strokeIndex].id,phaseProgress,
    pistonPinY,pistonCrownY,crankX,crankY:cy,
    intakeLift:strokeIndex===0?lift:0,exhaustLift:strokeIndex===3?lift:0,
    spark:angle>=360&&angle<372?Math.max(0,1-(angle-360)/12):0,
    gasColor:STROKES[strokeIndex].gas,
    direction:atEnd?'止点瞬间':STROKES[strokeIndex].direction,
    volumeCm3:Math.PI*bore*bore/4*(headY-pistonCrownY)*1e6,
    travelMm:(crankY+r+rod-pistonPinY)*1000,
    cycleAngle:raw===720?720:angle};
}
