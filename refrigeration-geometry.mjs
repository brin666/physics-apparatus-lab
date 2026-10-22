/**
 * Teaching geometry, in metres. These are deliberately inspectable schematic
 * appliances, not scans of a commercial model. Fridge: .60 × 1.70 × .62 m.
 * Split heat pump: indoor .95 × .44 × .24 m, outdoor .82 × .63 × .36 m.
 * Pipe port positions are shared by the solids and deterministic flow paths.
 */
import {THREE,GEO} from './vendor/machine-kit/lab-kit.js';

const Z=[Math.PI/2,0,0],X=[0,0,Math.PI/2];
const disc=(r,h,n=36)=>GEO.disc(r,h,Math.min(.002,h*.12),n);
const box=(w,h,d,r=.004)=>GEO.rbox(w,h,d,Math.min(r,w/4,h/4,d/4),2);
const v=p=>new THREE.Vector3(...p);
export function roundedRoute(points,r=.022) {
  const p=points.map(v),c=new THREE.CurvePath();let from=p[0];
  for(let i=1;i<p.length-1;i++) {
    const a=p[i-1],b=p[i],d=p[i+1],s=Math.min(r,b.distanceTo(a)*.32,b.distanceTo(d)*.32);
    const q=b.clone().addScaledVector(a.clone().sub(b).normalize(),s),t=b.clone().addScaledVector(d.clone().sub(b).normalize(),s);
    if(from.distanceTo(q)>.00001)c.add(new THREE.LineCurve3(from,q));
    c.add(new THREE.QuadraticBezierCurve3(q,b,t));from=t;
  }
  c.add(new THREE.LineCurve3(from,p.at(-1)));c.getLength();return c;
}
export function routeGeometry(curve,r=.006,segments) {
  const count=segments||Math.max(16,Math.ceil(curve.getLength()*140));
  const tube=new THREE.TubeGeometry(curve,count,r,8,false),ends=[];
  for(const t of [0,1]) {
    const g=new THREE.CircleGeometry(r,8),normal=curve.getTangentAt(t).multiplyScalar(t===0?-1:1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal));
    g.translate(...curve.getPointAt(t).toArray());ends.push(g);
  }
  return GEO.merge([tube,...ends]);
}
function mergeBoxes(items) {return GEO.merge(items.map(({size,pos,rot})=>{const g=box(...size);if(rot)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));return g.translate(...pos);}));}
function serpentine({left,right,top,step,rows,z}) {
  const p=[];for(let i=0;i<rows;i++){const y=top-i*step;p.push([i%2?right:left,y,z],[i%2?left:right,y,z]);}return p;
}
function finPack({width,height,depth,count=64,pos,axis='x'}) {
  const items=[];for(let i=0;i<count;i++)items.push({size:axis==='x'?[.0012,height,depth]:[width,height,.0012],pos:axis==='x'?[pos[0]-width/2+i*width/(count-1),pos[1],pos[2]]:[pos[0],pos[1],pos[2]-depth/2+i*depth/(count-1)]});return mergeBoxes(items);
}
function boltSet(ctx,id,points,axis='z',r=.004) {
  const geo=GEO.merge(points.map(p=>{const g=new THREE.CylinderGeometry(r,r,.005,6);if(axis==='z')g.rotateX(Math.PI/2);if(axis==='x')g.rotateZ(Math.PI/2);return g.translate(...p);}));return ctx.solid(id,geo,'steel');
}
function mountFeet(ctx,id,xs,zs,y=.025) {
  for(const x of xs)for(const z of zs){ctx.solid(id,box(.062,.018,.067),'rubber',{pos:[x,y-.014,z]});ctx.solid(id,box(.073,.014,.075),'steel',{pos:[x,y,z]});}
}
function sidePortPanel(height,depth,thickness,holeY,holeZ) {
  const s=new THREE.Shape();s.moveTo(-depth/2,-height/2);s.lineTo(depth/2,-height/2);s.lineTo(depth/2,height/2);s.lineTo(-depth/2,height/2);s.closePath();
  const hole=new THREE.Path();hole.absarc(holeZ,holeY,.012,0,Math.PI*2,true);s.holes.push(hole);
  const g=GEO.extrude(s,thickness,0);g.rotateY(Math.PI/2);return g;
}
function horizontalPortPanel(w,d,h,x,z,r) {
  const s=new THREE.Shape();s.moveTo(-w/2,-d/2);s.lineTo(w/2,-d/2);s.lineTo(w/2,d/2);s.lineTo(-w/2,d/2);s.closePath();const hole=new THREE.Path();hole.absarc(x,-z,r,0,Math.PI*2,true);s.holes.push(hole);const g=GEO.extrude(s,h,0);g.rotateX(-Math.PI/2);return g;
}
function compressor(ctx,id,p={x:0,y:.20,z:0},radius=.09,height=.24) {
  const {x,y,z}=p;
  ctx.solid(id,GEO.lathe([[0,-height/2],[radius*.65,-height/2],[radius*.92,-height*.41],[radius,-height*.22],[radius,height*.25],[radius*.86,height*.43],[radius*.55,height/2],[0,height/2]],64),'black',{pos:[x,y,z]});
  ctx.solid(id,GEO.tube(radius*1.014,radius*.98,.006,48),'steel',{pos:[x,y+.010,z]});
  ctx.solid(id,box(radius*1.4,.015,radius*1.45),'black',{pos:[x,y-height/2-.009,z]});
  for(const xx of [-1,1])for(const zz of [-1,1])ctx.solid(id,disc(.014,.016,20),'rubber',{pos:[x+xx*radius*.76,y-height/2-.022,z+zz*radius*.76]});
  ctx.solid(id,box(.046,.055,.035),'black',{pos:[x+radius*.82,y+.004,z+.048]});
  ctx.solid(id,box(.047,.020,.001),'label',{pos:[x,y+.043,z+radius*.995]});
}

export function buildFridge(ctx) {
  const {group,solid,pipe,link}=ctx;
  const names={shell:'箱体与保温层',door:'双门与门封',evaporator:'蒸发器',condenser:'背部冷凝器',compressor:'密闭压缩机',expansion:'毛细管',filter:'干燥过滤器',pipes:'连接铜管',thermostat:'温控器'};
  const anchors={shell:[-.29,1.17,.03],door:[.08,1.32,.33],evaporator:[0,1.39,-.195],condenser:[0,.95,-.355],compressor:[0,.19,-.17],expansion:[.29,.50,-.29],filter:[.28,.72,-.30],pipes:[.30,1.18,-.24],thermostat:[.19,1.09,-.13]};
  const moves={shell:[-.36,0,-.02],door:[1.18,.03,.49],evaporator:[-.03,.27,.10],condenser:[-.18,0,-.26],compressor:[.06,-.03,.34],expansion:[.58,0,-.15],filter:[.58,.04,-.15],pipes:[.58,0,-.15],thermostat:[.20,.12,.28]};
  for(const id of Object.keys(names))group(id,moves[id]);
  // Separate skin / foam / liner solids make the section edges closed and legible.
  for(const side of [-1,1]) {
    for(const [z,depth,role] of [[-.19,.22,'section'],[.08,.32,'front']]) {
      const panel=(t,h,d)=>side===1&&role==='section'?sidePortPanel(h,d,t,1.605-.86,-(-.267-z)):box(t,h,d);
      const sideRole=side===-1?'left-wall':role==='section'?'right-wall':role;
      solid('shell',panel(.012,1.58,depth),'white',{pos:[side*.294,.86,z],role:sideRole});
      solid('shell',panel(.033,1.55,depth-.008),'foam',{pos:[side*.272,.86,z],role:sideRole});
      solid('shell',panel(.007,1.51,depth-.012),'liner',{pos:[side*.252,.86,z],role:sideRole});
    }
  }
  solid('shell',box(.60,.045,.55),'white',{pos:[0,1.677,-.025],role:'front'});
  solid('shell',box(.575,.026,.52),'foam',{pos:[0,1.645,-.025],role:'section'});
  solid('shell',box(.57,1.41,.012),'white',{pos:[0,.965,-.282],role:'back'});
  solid('shell',box(.52,1.37,.025),'foam',{pos:[0,.966,-.264],role:'back'});
  solid('shell',box(.50,1.35,.008),'liner',{pos:[0,.967,-.246],role:'back'});
  solid('shell',horizontalPortPanel(.59,.52,.055,-.232,-.191,.014),'white',{pos:[0,.31,-.005],role:'front'});
  solid('shell',GEO.tube(.018,.011,.057,32),'rubber',{pos:[-.232,.31,-.196],role:'front'});
  solid('shell',box(.52,.035,.50),'liner',{pos:[0,1.17,-.005],role:'furniture'});
  solid('shell',box(.57,.032,.48),'steel',{pos:[0,.050,-.03]});
  solid('shell',box(.57,.205,.025),'white',{pos:[0,.177,.235],role:'front'});
  mountFeet(ctx,'shell',[-.226,.226],[-.225,.215]);
  // Clear tempered shelves and vegetable drawer, each supported by side rails.
  for(const y of [.59,.82,1.025]) {
    solid('shell',box(.478,.009,.414),'glass',{pos:[0,y,-.005],role:'furniture'});
    solid('shell',box(.478,.010,.012),'steel',{pos:[0,y,.203],role:'furniture'});
    for(const x of [-.238,.238])solid('shell',box(.010,.018,.31),'liner',{pos:[x,y-.010,-.025],role:'furniture'});
  }
  solid('shell',box(.458,.16,.37),'glass',{pos:[0,.425,.009],role:'furniture'});
  solid('shell',box(.44,.018,.37),'liner',{pos:[0,.508,.009],role:'furniture'});
  // Two independently detailed doors. Gaskets and inner pockets are separate.
  for(const [y,height] of [[.74,.855],[1.434,.478]]) {
    solid('door',box(.597,height,.065,.018),'white',{pos:[0,y,.295],role:'cover'});
    solid('door',box(.558,height-.035,.016,.012),'rubber',{pos:[0,y,.254],role:'cover'});
    solid('door',box(.520,height-.067,.014,.010),'liner',{pos:[0,y,.241],role:'cover'});
    solid('door',box(.022,height*.63,.029,.009),'steel',{pos:[-.233,y,.345],role:'cover'});
    for(const xx of [-.233])for(const yy of [-1,1])solid('door',disc(.009,.018,24),'steel',{pos:[xx,y+yy*height*.23,.334],rot:Z,role:'cover'});
    for(const yy of [y-height*.22,y+height*.15]) {
      solid('door',box(.435,.022,.054),'liner',{pos:[0,yy,.211],role:'cover'});
      solid('door',box(.435,.060,.012),'glass',{pos:[0,yy+.025,.182],role:'cover'});
    }
  }
  for(const y of [.329,1.186,1.672]){solid('door',box(.043,.015,.054),'steel',{pos:[.266,y,.255],role:'cover'});solid('door',disc(.005,.038,16),'steel',{pos:[.268,y,.267],role:'cover'});}
  solid('door',box(.058,.018,.002,.002),'label',{pos:[.167,1.591,.329],role:'cover'});
  // Exposed roll-bond / fin-tube freezer evaporator and its drain lip.
  const evap=serpentine({left:-.207,right:.207,top:1.558,step:.036,rows:9,z:-.196});
  const condenser=serpentine({left:-.244,right:.244,top:1.592,step:.068,rows:18,z:-.350});
  solid('evaporator',finPack({width:.45,height:.322,depth:.055,count:48,pos:[0,1.414,-.202]}),'aluminium');
  pipe('evaporator',evap,.0072,'copper');
  solid('evaporator',box(.47,.014,.07),'aluminium',{pos:[0,1.235,-.195]});
  // Rear condenser wire lattice is a real rack standing off its fixing rails.
  const wires=[];for(let x=-.225;x<.24;x+=.027)wires.push({size:[.002,1.24,.002],pos:[x,.99,-.361]});
  solid('condenser',mergeBoxes(wires),'dark');pipe('condenser',condenser,.0068,'darkCopper');
  for(const x of [-.18,.18]){solid('condenser',box(.018,1.31,.018),'dark',{pos:[x,.985,-.318]});boltSet(ctx,'condenser',[[x,.38,-.329],[x,1.59,-.329]]);}
  compressor(ctx,'compressor',{x:-.065,y:.194,z:-.154},.091,.218);
  // Port-to-port closed refrigerant circuit, all kept outside the cabinet wall.
  const discharge=[[-.015,.271,-.217],[-.015,.320,-.320],[-.244,.320,-.350],...condenser.slice(0,1)];
  const condOut=condenser.at(-1),filterIn=[.285,.762,-.307],filterOut=[.285,.665,-.307];
  const liquid=[condOut,[.280,condOut[1],-.350],[.285,.762,-.307]];
  const cap=[];for(let i=0;i<=140;i++){const a=i/140*8*Math.PI;cap.push([.285+.025*Math.cos(a),.614-i/140*.126,-.307+.025*Math.sin(a)]);}
  const capIn=[filterOut,[.310,.637,-.307],cap[0]],capOut=[cap.at(-1),[.315,.475,-.267],[.315,1.605,-.267],[.225,1.605,-.267],[.225,1.605,-.196],[-.207,1.605,-.196],evap[0]];
  const suction=[evap.at(-1),[-.232,1.260,-.196],[-.232,.274,-.196],[-.136,.274,-.196],[-.133,.235,-.191]];
  solid('pipes',GEO.tube(.015,.006,.063,24),'rubber',{pos:[.277,1.605,-.267],rot:X});
  pipe('pipes',discharge,.0065);pipe('pipes',liquid,.0048);pipe('pipes',suction,.0082);
  pipe('expansion',capIn,.003,'copper',{role:'connection'});pipe('expansion',cap,.0024);pipe('expansion',capOut,.003,'copper',{role:'connection'});
  solid('filter',disc(.014,.086,32),'copper',{pos:[.285,.714,-.307]});
  solid('filter',disc(.007,.014,20),'copper',{pos:filterIn});solid('filter',disc(.007,.014,20),'copper',{pos:filterOut});
  // The four casing ports terminate on their corresponding copper runs.
  pipe('compressor',[[-.015,.271,-.217],[-.015,.258,-.207]],.009,'copper');
  pipe('compressor',[[-.133,.235,-.191],[-.127,.227,-.181]],.011,'copper');
  solid('thermostat',box(.060,.064,.029),'liner',{pos:[.198,1.095,-.166]});
  solid('thermostat',disc(.015,.012,32),'steel',{pos:[.198,1.094,-.144],rot:Z});
  pipe('thermostat',[[.198,1.123,-.167],[.220,1.161,-.173],[.220,1.432,-.223],[.168,1.432,-.223]],.0019,'steel',{role:'connection'});
  const all=[{id:'compression',points:[suction.at(-1),[-.100,.180,-.154],[-.040,.180,-.154],discharge[0]],phase:'compression'},{id:'discharge',points:discharge,phase:'hot'},{id:'condenser',points:condenser,phase:'condense'},{id:'liquid',points:liquid,phase:'liquid'},{id:'filter',points:[filterIn,filterOut],phase:'liquid'},{id:'cap-in',points:capIn,phase:'liquid'},{id:'capillary',points:cap,phase:'expand'},{id:'cap-out',points:capOut,phase:'mixed'},{id:'evaporator',points:evap,phase:'evaporate'},{id:'suction',points:suction,phase:'vapor'}];
  const bends={discharge:.0195,condenser:.0204,liquid:.0144,'cap-in':.009,capillary:.008,'cap-out':.009,evaporator:.0216,suction:.0246};
  all.forEach(a=>{a.bendRadius=bends[a.id]??.018;link(a.id,a.points,a.phase,{bendRadius:a.bendRadius});});
  return {names,anchors,moves,assembly:[['shell'],['compressor'],['condenser'],['filter','expansion','pipes'],['evaporator'],['thermostat'],['door']],routes:()=>all,motion:{},schematic:true};
}

export function buildAC(ctx) {
  const {group,solid,pipe,link}=ctx;
  const names={'indoor-shell':'室内机外壳与挂板',filter:'空气过滤网','indoor-coil':'室内翅片换热器',blower:'贯流风轮',louver:'导风板','outdoor-shell':'室外机外壳与底座','outdoor-coil':'室外翅片换热器',fan:'轴流风机',compressor:'密闭压缩机',reversing:'四通换向阀',expansion:'电子膨胀阀',accumulator:'气液分离器',pipes:'服务阀与连接铜管',drain:'接水盘与排水管'};
  const moves={'indoor-shell':[0,0,0],filter:[0,.22,.18],'indoor-coil':[0,.24,0],blower:[-.20,-.02,.19],louver:[0,-.16,.25],'outdoor-shell':[0,0,0],'outdoor-coil':[-.16,0,-.25],fan:[-.16,0,.48],compressor:[.82,-.02,-.03],reversing:[.79,.20,.02],expansion:[.82,-.02,0],accumulator:[.87,0,0],pipes:[.31,0,-.04],drain:[0,-.16,.12]};
  const anchors={'indoor-shell':[-.71,1.65,.14],filter:[-.6,1.72,.06],'indoor-coil':[-.55,1.60,0],blower:[-.6,1.390,.026],louver:[-.6,1.318,.125],'outdoor-shell':[.88,.65,.16],'outdoor-coil':[.40,.46,-.132],fan:[.413,.41,.17],compressor:[.797,.319,-.015],reversing:[.80,.58,.02],expansion:[.79,.18,-.07],accumulator:[.912,.363,-.073],pipes:[1.105,.90,-.06],drain:[-.51,1.478,.003]};
  for(const id of Object.keys(names))group(id,moves[id]);
  // Keep the appliance's mounting rail and rear casing; omit the illustrative
  // wall slab and its sleeve so they do not read as another machine component.
  solid('indoor-shell',box(.72,.039,.012),'steel',{pos:[-.60,1.625,-.148],role:'support'});
  for(const x of [-.88,-.32])solid('indoor-shell',box(.026,.22,.018),'steel',{pos:[x,1.55,-.141],role:'support'});
  boltSet(ctx,'indoor-shell',[[-.88,1.625,-.132],[-.32,1.625,-.132]]);
  // Taller lower plenum separates the dry fan from the condensate collector.
  // Rear panel is split around a real drain-hose opening (30 mm square).
  for(const [size,pos] of [
    [[.885,.395,.018],[-.6325,1.4975,-.123]],
    [[.041,.395,.018],[-.1455,1.4975,-.123]],
    [[.024,.151,.018],[-.178,1.3755,-.123]],
    [[.024,.214,.018],[-.178,1.588,-.123]],
  ]) solid('indoor-shell',box(...size),'liner',{pos,role:'back'});
  solid('indoor-shell',box(.952,.300,.054,.020),'white',{pos:[-.60,1.5515,.134],role:'cover'});
  solid('indoor-shell',box(.925,.018,.172,.006),'white',{pos:[-.60,1.709,.045],role:'front'});
  for(const x of [-1.066,-.134])solid('indoor-shell',box(.027,.395,.225,.014),'white',{pos:[x,1.4975,.019],role:'front'});
  solid('indoor-shell',box(.91,.016,.12),'dark',{pos:[-.60,1.310,-.04],role:'back'});
  const grill=[];for(let x=-1.015;x<-.18;x+=.018)grill.push({size:[.006,.008,.084],pos:[x,1.723,.011]});
  solid('indoor-shell',mergeBoxes(grill),'white',{role:'cover'});
  solid('indoor-shell',box(.036,.008,.002,.002),'led',{pos:[-.275,1.535,.162],role:'cover'});
  solid('indoor-shell',box(.045,.007,.002,.001),'label',{pos:[-.933,1.531,.162],role:'cover'});
  // Enlarge the teaching mesh pitch and strands so the lattice survives the
  // default overview scale. The perimeter and installed dimensions stay fixed.
  const mesh=[];for(let x=-.977;x<-.20;x+=.034)mesh.push({size:[.006,.128,.003],pos:[x,1.668,.069]});
  for(let y=1.634;y<1.73;y+=.034)mesh.push({size:[.814,.006,.003],pos:[-.60,y,.069]});
  solid('filter',mergeBoxes(mesh),'mesh',{role:'filter'});
  for(const x of [-1.011,-.601,-.189])solid('filter',box(.008,.137,.009,.002),'dark',{pos:[x,1.668,.070],role:'filter'});
  for(const y of [1.600,1.736])solid('filter',box(.83,.008,.009,.002),'dark',{pos:[-.60,y,.070],role:'filter'});
  const indoor=serpentine({left:-1.000,right:-.200,top:1.675,step:.036,rows:5,z:-.006});
  solid('indoor-coil',finPack({width:.818,height:.190,depth:.072,count:91,pos:[-.60,1.603,-.015]}),'aluminium');
  pipe('indoor-coil',indoor,.0053,'copper');
  for(const x of [-1.022,-.178])solid('indoor-coil',box(.012,.199,.079),'steel',{pos:[x,1.603,-.015]});
  // Blades form a long hollow cross-flow impeller, supported at both bearings.
  const blower=new THREE.Group();blower.position.set(-.60,1.390,.026);blower.name='indoor-blower-rotor';ctx.parts.blower.add(blower);
  const blade=[];for(let i=0;i<35;i++){const a=i/35*Math.PI*2,g=box(.768,.0023,.022,.001);g.rotateX(a+.38);g.translate(0,.045*Math.sin(a),.045*Math.cos(a));blade.push(g);}
  for(const xx of [-.385,-.19,0,.19,.385]){const g=GEO.tube(.052,.038,.007,40);g.rotateZ(Math.PI/2);g.translate(xx,0,0);blade.push(g);}
  solid('blower',GEO.merge(blade),'dark',{parent:blower}).name='indoor-blower-blades';
  solid('blower',disc(.006,.875),'steel',{parent:blower,pos:[.005,0,0],rot:X}).name='blower-drive-shaft';
  for(const x of [-.385,.385])solid('blower',GEO.tube(.052,.006,.006,40),'steel',{parent:blower,pos:[x,0,0],rot:X});
  for(const x of [-1.011,-.189]){
    solid('blower',GEO.tube(.022,.0064,.024,40),'steel',{pos:[x,1.390,.026],rot:X});
    solid('blower',box(.024,.026,.145),'liner',{pos:[x,1.374,-.050]});
  }
  solid('blower',disc(.030,.026),'steel',{pos:[-.164,1.390,.026],rot:X});
  const louver=new THREE.Group();louver.position.set(-.60,1.318,.125);louver.name='indoor-louver-rotor';ctx.parts.louver.add(louver);
  solid('louver',box(.806,.011,.071,.005),'white',{parent:louver}).name='indoor-louver-blade';
  // End pins connect the swinging vane to the side casing without crossing the fan.
  for(const x of [-1.032,-.168]) solid('louver',disc(.004,.059),'steel',{pos:[x,1.318,.125],rot:X});
  solid('louver',box(.806,.008,.08,.002),'liner',{pos:[-.60,1.308,.04]}).name='indoor-outlet-guide-base';
  for(const x of [-.91,-.755,-.60,-.445,-.29])solid('louver',box(.004,.018,.025,.002),'liner',{pos:[x,1.321,.065]}).name='indoor-fixed-guide-vane';
  // Condensate catches below the cold coil; gravity drain exits separately.
  solid('drain',box(.843,.012,.10),'liner',{pos:[-.60,1.478,-.020]}).name='indoor-condensate-pan-floor';
  for(const z of [-.068,.025])solid('drain',box(.843,.019,.005),'liner',{pos:[-.60,1.489,z]});
  // Gravity drain: pan -> behind the case -> wall sleeve -> outdoor outlet.
  // It falls continuously and stays separate from both refrigerant lines.
  pipe('drain',[[-.178,1.480,-.040],[-.178,1.470,-.10],[-.178,1.460,-.230],[-.030,1.318,-.230],[1.205,1.285,-.230],[1.205,.100,-.230]],.007,'drainHose',{role:'connection'});
  solid('drain',GEO.tube(.014,.008,.025,32),'drainHose',{pos:[-.178,1.46823,-.123],rot:[Math.atan2(.13,.01),0,0]});
  solid('drain',GEO.tube(.010,.007,.024,32),'drainHose',{pos:[1.205,.088,-.230],role:'connection'});
  // Folded steel base tray, rubber isolators, and grounded mounting channels.
  solid('outdoor-shell',box(.845,.026,.372,.010),'white',{pos:[.555,.098,-.007]});
  for(const x of [.25,.84])solid('outdoor-shell',box(.085,.035,.42),'steel',{pos:[x,.051,-.007]});
  mountFeet(ctx,'outdoor-shell',[.25,.84],[-.17,.16],.033);
  solid('outdoor-shell',box(.84,.025,.362,.009),'white',{pos:[.555,.716,-.008],role:'front'});
  solid('outdoor-shell',box(.018,.60,.35),'white',{pos:[.976,.405,-.007],role:'cover'});
  solid('outdoor-shell',box(.018,.60,.35),'white',{pos:[.133,.405,-.007],role:'back'});
  // The front is a solid sheet with a circular opening, never an opaque box.
  const s=new THREE.Shape();s.moveTo(-.42,-.30);s.lineTo(.42,-.30);s.lineTo(.42,.30);s.lineTo(-.42,.30);s.closePath();
  const hole=new THREE.Path();hole.absarc(-.144,0,.235,0,Math.PI*2,true);s.holes.push(hole);
  const front=GEO.extrude(s,.012,.003);front.translate(.555,.405,.183);
  solid('outdoor-shell',front,'white',{role:'cover'});
  const vent=[];for(let y=.24;y<.64;y+=.023)vent.push({size:[.125,.005,.014],pos:[.858,y,.201]});
  solid('outdoor-shell',mergeBoxes(vent),'dark',{role:'cover'});
  boltSet(ctx,'outdoor-shell',[[.166,.122,.202],[.949,.122,.202],[.166,.687,.202],[.949,.687,.202]]);
  solid('outdoor-shell',box(.051,.018,.002,.002),'label',{pos:[.86,.673,.203],role:'cover'});
  const outdoor=serpentine({left:.180,right:.712,top:.643,step:.038,rows:12,z:-.133});
  solid('outdoor-coil',finPack({width:.558,height:.452,depth:.060,count:67,pos:[.446,.433,-.136]}),'aluminium');
  pipe('outdoor-coil',outdoor,.0064,'copper');
  for(const x of [.157,.736])solid('outdoor-coil',box(.012,.476,.071),'steel',{pos:[x,.431,-.133]});
  const fan=new THREE.Group();fan.position.set(.411,.405,.109);ctx.parts.fan.add(fan);
  solid('fan',GEO.rotor({count:3,axis:'z',r0:.044,r1:.212,chord:[.066,.142],thick:.07,camber:.18,twist:.7,pitch:.8,sweep:.008,nS:12,nC:14}),'fan',{parent:fan});
  solid('fan',disc(.051,.041,48),'dark',{parent:fan,rot:Z,pos:[0,0,.009]});
  solid('fan',disc(.009,.090),'steel',{parent:fan,rot:Z,pos:[0,0,-.009]}).name='fan-drive-shaft';
  // Separate fixed guard rings and radial struts preserve readable blade depth.
  const guards=[];for(const r of [.055,.085,.116,.148,.180,.211,.230]){const g=new THREE.TorusGeometry(r,.0017,5,72);g.translate(.411,.405,.213);guards.push(g);}
  for(let i=0;i<8;i++){const a=i*Math.PI/4,g=box(.0028,.458,.004,.001);g.rotateZ(a);g.translate(.411,.405,.215);guards.push(g);}
  solid('fan',GEO.merge(guards),'dark',{role:'guard'});
  solid('fan',disc(.027,.070),'steel',{pos:[.411,.405,.030],rot:Z});
  for(const endpoint of [[.133,.405,-.040],[.650,.7035,-.040],[.411,.111,-.040]])pipe('fan',[[.411,.405,.010],endpoint],.005,'steel');
  compressor(ctx,'compressor',{x:.812,y:.304,z:-.011},.068,.300);
  solid('compressor',box(.17,.010,.19),'steel',{pos:[.812,.131,-.011]});
  // Four valve ports: D discharge, O outdoor, S suction, I indoor.
  const D=[.800,.614,.020],O=[.755,.547,.020],S=[.800,.547,.020],I=[.845,.547,.020];
  solid('reversing',disc(.023,.127),'brass',{pos:[.800,.581,.020],rot:X,role:'valve-case'});
  solid('reversing',disc(.012,.031),'black',{pos:[.884,.581,.020],rot:X});
  for(const p of [D,O,S,I])pipe('reversing',[p,[p[0],.581,.020]],.0078,'copper');
  pipe('reversing',[[.864,.581,.015],[.878,.626,-.004],[.728,.626,-.004],[.728,.581,.015]],.0019,'copper');
  // Electronic expansion valve is bi-directional; no unshown check-valve path.
  solid('expansion',disc(.015,.062),'brass',{pos:[.790,.183,-.071],rot:X});
  solid('expansion',disc(.018,.043),'black',{pos:[.790,.220,-.071]});
  solid('expansion',disc(.007,.017),'copper',{pos:[.755,.183,-.071],rot:X});
  solid('expansion',disc(.007,.017),'copper',{pos:[.825,.183,-.071],rot:X});
  // Suction accumulator has a top inlet and a separate top U-tube outlet.
  solid('accumulator',GEO.lathe([[0,-.071],[.030,-.071],[.037,-.057],[.037,.054],[.029,.071],[0,.071]],40),'black',{pos:[.912,.360,-.073]});
  solid('accumulator',GEO.tube(.038,.036,.004,36),'steel',{pos:[.912,.360,-.073]});
  const suctionIn=[.897,.431,-.073],suctionOut=[.927,.431,-.073],compIn=[.860,.356,-.013],compOut=[.843,.447,.008];
  const discharge=[compOut,[.875,.460,.079],[.875,.651,.079],[.800,.651,.079],D];
  const outdoorGas=[O,[.710,.547,.020],[.710,.670,-.081],[.153,.670,-.081],[.153,.643,-.133],outdoor[0]];
  const outdoorLiquid=[outdoor.at(-1),[.153,.225,-.133],[.153,.172,-.133],[.737,.172,-.133],[.737,.183,-.071],[.755,.183,-.071]];
  const liquidValve=[.999,.241,.020],gasValve=[.999,.350,-.058];
  const valveLiquid=[[.825,.183,-.071],[.861,.183,-.071],[.861,.241,.020],liquidValve];
  const remoteLiquid=[liquidValve,[1.145,.241,.020],[1.145,1.145,.020],[-1.102,1.145,.020],[-1.102,1.675,-.006],indoor[0]];
  const remoteGas=[indoor.at(-1),[-.200,1.515,-.092],[-.200,1.379,-.092],[-.090,1.379,-.092],[-.090,1.235,-.092],[1.074,1.235,-.058],[1.074,.350,-.058],gasValve];
  const indoorGas=[gasValve,[.936,.350,-.058],[.936,.504,.020],[.845,.504,.020],I];
  const accumulatorIn=[S,[.800,.499,-.073],[.897,.499,-.073],suctionIn];
  const accumulatorOut=[suctionOut,[.957,.452,-.073],[.957,.277,-.073],[.870,.277,-.073],[.870,.356,-.013],compIn];
  const expansion=[[.755,.183,-.071],[.825,.183,-.071]];
  const accumulator=[suctionIn,[.897,.310,-.073],[.927,.310,-.073],suctionOut];
  const compression=[compIn,[.833,.290,-.011],[.790,.290,-.011],[.790,.420,-.011],compOut];
  for(const [id,p,r] of [['discharge',discharge,.006],['outdoorGas',outdoorGas,.0064],['outdoorLiquid',outdoorLiquid,.0047],['valveLiquid',valveLiquid,.0047],['remoteLiquid',remoteLiquid,.0047],['remoteGas',remoteGas,.008],['indoorGas',indoorGas,.008],['accumulatorIn',accumulatorIn,.008],['accumulatorOut',accumulatorOut,.008]])pipe('pipes',p,r);
  for(const [p,r] of [[liquidValve,.011],[gasValve,.014]]) {
    solid('pipes',disc(r,.038,6),'brass',{pos:p,rot:X});
    solid('pipes',disc(r*.80,.025,6),'brass',{pos:[p[0]-.015,p[1]+.022,p[2]]});
  }
  // Start/end the sleeve on straight, external copper. Share the copper bend
  // radius so the two meshes remain coaxial instead of separating at elbows.
  const insulatedGas=[[-.090,1.330,-.092],...remoteGas.slice(4,-2),[1.074,.400,-.058]];
  solid('pipes',routeGeometry(roundedRoute(insulatedGas,.024),.0122),'insulation',{role:'insulation'});
  pipe('compressor',[compIn,[.850,.346,-.009]],.010,'copper');pipe('compressor',[compOut,[.834,.442,.004]],.008,'copper');
  pipe('accumulator',[suctionIn,[.897,.418,-.073]],.010,'copper');pipe('accumulator',[suctionOut,[.927,.418,-.073]],.010,'copper');
  const internalCool={high:[D,[.800,.585,.025],O],low:[I,[.825,.567,.009],S]};
  const internalHeat={high:[D,[.821,.585,.025],I],low:[O,[.777,.566,.009],S]};
  const bends={discharge:.018,outdoorGas:.0192,outdoorLiquid:.0141,valveLiquid:.0141,remoteLiquid:.0141,remoteGas:.024,indoorGas:.024,accumulatorIn:.024,accumulatorOut:.024,'outdoor-coil':.0192,'indoor-coil':.0159};
  const forward=(id,points,phase)=>({id,points,phase,bendRadius:bends[id]??.018}),reverse=(id,points,phase)=>({...forward(id,points,phase),points:[...points].reverse()});
  function routes(operation='cool') {
    const c=operation==='cool',inside=c?internalCool:internalHeat;
    return c?[
      forward('compression',compression,'compression'),forward('discharge',discharge,'hot'),forward('valve-high',inside.high,'hot'),forward('outdoorGas',outdoorGas,'hot'),forward('outdoor-coil',outdoor,'condense'),forward('outdoorLiquid',outdoorLiquid,'liquid'),forward('expansion',expansion,'expand'),forward('valveLiquid',valveLiquid,'mixed'),forward('remoteLiquid',remoteLiquid,'mixed'),forward('indoor-coil',indoor,'evaporate'),forward('remoteGas',remoteGas,'vapor'),forward('indoorGas',indoorGas,'vapor'),forward('valve-low',inside.low,'vapor'),forward('accumulatorIn',accumulatorIn,'vapor'),forward('accumulator',accumulator,'vapor'),forward('accumulatorOut',accumulatorOut,'vapor')
    ]:[
      forward('compression',compression,'compression'),forward('discharge',discharge,'hot'),forward('valve-high',inside.high,'hot'),reverse('indoorGas',indoorGas,'hot'),reverse('remoteGas',remoteGas,'hot'),reverse('indoor-coil',indoor,'condense'),reverse('remoteLiquid',remoteLiquid,'liquid'),reverse('valveLiquid',valveLiquid,'liquid'),reverse('expansion',expansion,'expand'),reverse('outdoorLiquid',outdoorLiquid,'mixed'),reverse('outdoor-coil',outdoor,'evaporate'),reverse('outdoorGas',outdoorGas,'vapor'),forward('valve-low',inside.low,'vapor'),forward('accumulatorIn',accumulatorIn,'vapor'),forward('accumulator',accumulator,'vapor'),forward('accumulatorOut',accumulatorOut,'vapor')
    ];
  }
  const known=new Set();for(const op of ['cool','heat'])for(const r of routes(op)){const key=r.id+(r.id.startsWith('valve-')?'-'+op:'');if(known.has(key))continue;known.add(key);link(key,r.points,r.phase,{mode:r.id.startsWith('valve-')?op:null,bendRadius:r.bendRadius});}
  return {names,anchors,moves,assembly:[['outdoor-shell'],['compressor','accumulator'],['outdoor-coil'],['reversing','expansion','pipes'],['indoor-shell'],['blower','drain'],['indoor-coil'],['filter','louver','fan']],routes,motion:{blower,fan,louver},schematic:true};
}
