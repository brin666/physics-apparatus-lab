# Apparatus modules

Units: authored teaching models in metres, not reproductions of a specific product. Y up, Z toward viewer. Fit assembled geometry into roughly 1–3 units. Root renderer frames bounding boxes automatically.

Each owned module exports `devices` array. Each definition:
```
{id, name, category, summary, principle, notes, sources:[{label,url}],
 controls:[{id,label,min,max,step,value,unit}] OR {id,label,options:[{value,label}],value},
 stages:[{name,title,text}], // 3–6 pedagogical moments (not necessarily sequential operating stages)
 build() => {root:THREE.Group, parts:[{id,name,description,object:THREE.Group,explode:[x,y,z],shell?:boolean,drag?:{control,axis:'x'|'y',scale}}], update(t,inputs)},
 readout(t,inputs)=>{phaseIndex,title,text,values:[{label,value,unit}]} }
```

`t` is seconds of DEMONSTRATION time, frozen on pause, assembly, explosion, hidden document, whiteboard. Inputs numeric or select strings. Motion/readout must be deterministic. Model animation is deliberately slowed and enlarged where needed, disclose in notes. No invented physical measurements. State units and simplified equations for computed readouts.

Use imports from `./kit.mjs`: THREE, material(color,metalness?,roughness?,opacity?), box(parent,size,pos,colorOrMaterial,rotation?), cylinder(parent,radius,height,pos,colorOrMaterial,axis='y'), sphere(parent,radius,pos,mat), torus(parent,radius,tube,pos,mat,rotation?), pipe(parent,points,radius,mat), coil(parent,radius,length,turns,pos,mat,axis='y'), label(parent,text,pos,size=.10,color='#294c7a'), assembly(root,id,name,description,explode,shell=false).
All primitive helpers return Mesh; label returns Sprite. `assembly` returns a PART RECORD and adds its `object` Group to root. Parts must be independent direct children of root. Keep animation on children of the part.object, not that root group (runtime controls explosion/rotation). `object` positions normally zero, children's geometry is in assembled root coordinates; runtime will recenter pivot for free rotation. Do not animate root or part.object transforms. Internal moving pivots encouraged.

Provide 5–12 meaningful named assemblies per model, recognizable silhouettes and detailed fasteners/terminals/mounts. Small repeated geometry can be merged/instanced if >250 meshes. Closed solids, good metal/copper/enamel materials, mounted geometry. `shell` marks removable cover; runtime hides during cut and makes transparent during xray. Update must not restore shell opacity. Wires important for operation; can flag object.userData.connection=true to hide during exploded view.

Individual object can have userData.nonPickable=true for explanatory arrows/water, avoiding interception. label mesh's role is explanatory (N/S, marks, etc.), keep sparse.

Model-specific interactions via control sliders/selects mandatory, direct drag optional for physically draggable parts. Inputs and readout pure default functions must work in Node without building scene. Add your own meaningful model tests, docs under owned names only. No edits to shared runtime/build/home/kit. Not alone in workspace; never revert other agents' changes.
