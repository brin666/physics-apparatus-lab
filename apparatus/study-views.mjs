import {THREE} from './kit.mjs';

const inParts=(ids)=>(part)=>ids.includes(part.id);
const named=(...names)=>(_part,o)=>names.includes(o.name);
// Each apparatus has its own section targets. Functional wires, fluids and
// moving members are retained unless a specific study view says otherwise.
const specs={
  relay:{direction:[0,0,1],cutHide:['relay-cover','relay-base'],xrayHide:['relay-cover','relay-base'],
    clip:(part,o)=>part.id==='relay-winding'&&!o.userData.hideWhenExploded,
    bounds:[[-.55,.16,-.18],[.72,.80,.28]],cutText:'正面纵剖 · 铁芯、线圈与触点',xrayText:'内部观察 · 电磁铁与触点联动'},
  'induction-hob':{direction:[0,0,1],cutHide:['controls','power-leads','inverter','cooling-fan'],
    xrayHide:['chassis','glass','cookware','controls','power-leads','eddy-currents','cooling-fan'],
    clip:(part,o)=>['chassis','glass','cookware','induction-coil','ferrite-core'].includes(part.id)&&!o.userData.sectionFace,
    cutBounds:[[-.61,-.10,-.02],[.84,.70,.02]],bounds:[[-.65,-.08,-.72],[.83,.63,.50]],
    narrowCutBounds:[[-.58,-.10,-.02],[.58,.70,.02]],
    cutText:'中心竖切 · 锅底、面板与线圈截面',xrayText:'内部观察 · 工作线圈与功率电路'},
  electroscope:{direction:[0,0,1],cutHide:['base'],xrayHide:['base','glass-case','scale'],
    clip:inParts(['glass-case']),bounds:[[-.75,.10,-.20],[.40,.90,.20]],
    cutText:'前壁剖开 · 金属杆与箔片',xrayText:'内部观察 · 导体与电荷分布'},
  rheostat:{direction:[0,0,1],cutHide:['wood-base','sample-circuit','terminal-links'],xrayHide:['wood-base','porcelain-supports'],
    clip:named('rheostat-ceramic-core'),xrayNodes:named('rheostat-ceramic-core'),
    bounds:[[-.58,.08,-.24],[.58,.63,.43]],cutText:'纵向剖开 · 瓷管、绕组与滑片',xrayText:'内部观察 · 电阻丝与滑片接触'},
  pulley:{direction:[0,0,1],cutHide:['support-frame'],xrayHide:['support-frame'],
    clip:named('pulley-fixed-wheel-body','pulley-moving-wheel-body'),xrayNodes:named('pulley-fixed-wheel-body','pulley-moving-wheel-body'),
    bounds:[[-.25,-.14,-.18],[.48,1.59,.18]],cutText:'中心剖开 · 轮槽、轮轴与绳路',xrayText:'内部观察 · 连续绳索与滑轮'},
  submarine:{direction:[0,0,1],cutHide:['basin','pressure-hull','ballast-tanks','vents-and-floods','air-bank','sail','propulsion'],xrayHide:[],xrayNodes:named('sub-transparent-shell'),
    clip:inParts(['pressure-hull']),constant:0,
    bounds:[[-1.14,.04,-.30],[1.12,1.46,.12]],cutText:'固定水面 · 观察进排水与浮沉',xrayText:'内部示意 · 压载舱与空气瓶'},
  'canal-lock':{direction:[.25,.55,1],cutHide:[],xrayHide:['upper-gate-frame'],
    clip:named('lock-floor','lock-bank-wall','lock-end-wall'),xrayNodes:named('lock-bank-wall','lock-end-wall'),
    bounds:[[-1.42,.06,-.40],[1.42,.94,.40]],cutText:'纵向剖开 · 闸室、闸门与涵洞',xrayText:'内部观察 · 水位变化与充泄水通路'},
  manometer:{direction:[0,0,1],cutHide:[],xrayHide:[],constant:.045,
    clip:(part,o)=>['u-tube','test-tank'].includes(part.id)&&!o.userData.connection,
    cutNodes:named('manometer-backboard'),xrayNodes:(part,o)=>o.name==='manometer-backboard'||(!o.userData.connection&&o.isMesh&&(part.id==='test-tank'||(part.id==='u-tube'&&o.material?.transparent))),
    bounds:[[-.70,-.08,-.25],[1.06,1.35,.25]],cutText:'管壁剖开 · 两臂液柱与测压探头',xrayText:'内部观察 · 液柱高度差与探头深度'},
  'piston-pump':{direction:[0,0,1],cutHide:[],xrayHide:['pump-cylinder'],
    clip:(part,o)=>['pump-cylinder','suction-and-delivery','two-check-valves','piston-and-rod-seals'].includes(part.id)&&!o.userData.flowMarker,
    cutNodes:named('pump-support-column','pump-fixed-barrel-bracket'),xrayNodes:named('pump-support-column','pump-fixed-barrel-bracket'),
    bounds:[[-.56,.10,-.24],[.42,1.92,.24]],cutText:'中心纵剖 · 活塞、底阀与出水口',xrayText:'内部观察 · 活塞阀与往复水流'},
};

export function withStudyViews(definition){
  const spec=specs[definition.id];if(!spec)return definition;
  return {...definition,flatViewDirection:spec.direction,instantFlatView:true,
    viewDescriptions:{cut:spec.cutText,xray:spec.xrayText},
    build(){
      const model=definition.build(),records=[];
      const applyModelView=model.setView;
      for(const part of model.parts){
        // The study policy owns shell removal; keep partially cut housings and
        // tanks instead of the legacy all-or-nothing shell hiding/fading.
        part.assemblyShell=part.shell;part.shell=false;
        part.object.traverse(o=>{
          const cut=!!spec.cutNodes?.(part,o),xray=!!spec.xrayNodes?.(part,o),clip=o.isMesh&&!!spec.clip?.(part,o);
          if(!cut&&!xray&&!clip)return;
          if(clip)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
          records.push({object:o,cut,xray,baseVisible:o.visible,clip,
            plane:clip?new THREE.Plane(new THREE.Vector3(0,0,-1),spec.planeFor?.(part)??spec.constant??0):null});
        });
      }
      const focus=spec.follow?model.root.getObjectByName(spec.follow):null;
      if(focus)model.viewFollow=mode=>{
        if(!['cut','xray'].includes(mode))return null;
        model.root.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(focus).getCenter(new THREE.Vector3());
      };
      model.viewBounds=mode=>{
        if(!['cut','xray'].includes(mode))return null;
        const narrow=typeof innerWidth==='number'&&innerWidth<600;
        const extent=mode==='cut'?(narrow&&spec.narrowCutBounds||spec.cutBounds||spec.bounds):spec.bounds;
        const bounds=new THREE.Box3(new THREE.Vector3(...extent[0]),new THREE.Vector3(...extent[1]));
        if(focus)bounds.translate(model.viewFollow(mode));
        return bounds;
      };
      model.setView=({mode})=>{
        for(const part of model.parts)part.object.userData.studyHidden=(mode==='cut'&&spec.cutHide.includes(part.id))||(mode==='xray'&&spec.xrayHide.includes(part.id));
        for(const {object:o,cut,xray,baseVisible,clip,plane} of records){
          const hidden=mode==='cut'?cut:mode==='xray'?xray:false;
          if(o.userData.studyHidden!==hidden){o.userData.studyHidden=hidden;o.visible=!hidden&&(o.userData.modelVisible??baseVisible);}
          if(clip)for(const m of Array.isArray(o.material)?o.material:[o.material])m.clippingPlanes=mode==='cut'?[plane]:null;
        }
        applyModelView?.({mode});
      };
      return model;
    }};
}
