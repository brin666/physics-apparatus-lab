export const categories=[{id:'all',name:'全部器材'},{id:'thermal',name:'热与能量'},{id:'electromagnetic',name:'电与磁'},{id:'mechanics',name:'力与机械'},{id:'fluids',name:'压强与浮力'}];
export const catalog=[
 {id:'engine',name:'汽油机',category:'thermal',url:'engine.html',summary:'从燃烧到曲轴转动',x:160,y:250},
 {id:'fridge',name:'电冰箱',category:'thermal',url:'refrigerator.html',summary:'观察热量怎样搬离冷藏室',x:320,y:110},
 {id:'ac',name:'空调',category:'thermal',url:'air-conditioner.html',summary:'切换制冷与制热的循环',x:120,y:70},
 {id:'dc-motor',name:'直流电动机',category:'electromagnetic',summary:'观察电流与换向器',x:710,y:130},
 {id:'speaker',name:'动圈扬声器',category:'electromagnetic',summary:'让电流变成振膜的往复运动',x:930,y:60},
 {id:'relay',name:'电磁继电器',category:'electromagnetic',summary:'一条电路控制另一条电路',x:1110,y:230},
 {id:'generator',name:'发电机',category:'electromagnetic',summary:'转动线圈，产生感应电流',x:920,y:325},
 {id:'induction-hob',name:'电磁炉',category:'electromagnetic',summary:'观察线圈与锅底的感应加热',x:490,y:285},
 {id:'electroscope',name:'金属箔验电器',category:'electromagnetic',summary:'靠近与接触，观察金属箔',x:1130,y:490},
 {id:'rheostat',name:'滑动变阻器',category:'electromagnetic',summary:'改变接入电阻丝的长度',x:740,y:525},
 {id:'pulley',name:'滑轮组',category:'mechanics',summary:'拉动绳子，比较力和距离',x:100,y:490},
 {id:'submarine',name:'潜水艇教学模型',category:'fluids',summary:'调节压载舱，观察浮沉',x:300,y:620},
 {id:'canal-lock',name:'船闸',category:'fluids',summary:'让船随着闸室水位升降',x:510,y:485},
 {id:'manometer',name:'U形管压强计',category:'fluids',summary:'把探头放入水中，比较液面差',x:550,y:750},
 {id:'piston-pump',name:'活塞式抽水机',category:'fluids',summary:'活塞与单向阀怎样配合提水',x:90,y:770}
].map(d=>({...d,url:d.url||`${d.id}.html`,image:`assets/home/${d.id}.png`}));
export const relations=[
 ['engine','fridge','热量与能量转化'],['fridge','ac','蒸气压缩制冷'],['engine','piston-pump','活塞往复运动'],
 ['dc-motor','speaker','通电线圈在磁场中受力'],['dc-motor','generator','电能与机械能转换'],['dc-motor','relay','电流与磁场'],
 ['generator','induction-hob','电磁感应'],['relay','rheostat','电流控制'],['electroscope','rheostat','电荷与电流'],
 ['pulley','piston-pump','做功与机械运动'],['canal-lock','manometer','液体压强'],['canal-lock','submarine','液体中的浮沉'],['piston-pump','manometer','压强差'],['submarine','manometer','液体压强随深度变化']
];
