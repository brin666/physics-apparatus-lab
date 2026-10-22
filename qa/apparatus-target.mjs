// Find a real, unoccluded triangle hit rather than clicking a hollow group's origin.
export async function partTarget(page,id=null,dragOnly=false){
 return page.evaluate(({id,dragOnly})=>{
  const s=window.apparatusDemo.scene,canvas=s.renderer.domElement,r=canvas.getBoundingClientRect();
  s.model.root.updateMatrixWorld(true);
  for(const record of s.records.filter(v=>(!id||v.id===id)&&(!dragOnly||v.drag))){
   let result=null;
   record.object.traverse(o=>{
    if(result||!o.isMesh||o.userData.nonPickable||!o.visible)return;
    const points=o.geometry?.attributes?.position;if(!points)return;
    for(let i=0;i<points.count;i+=Math.max(1,Math.floor(points.count/80))){
     const p=s.camera.position.clone().fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld).project(s.camera);
     const x=r.left+(p.x+1)*r.width/2,y=r.top+(1-p.y)*r.height/2;
     if(x<r.left+25||x>r.right-25||y<r.top+100||y>r.bottom-125||document.elementFromPoint(x,y)!==canvas)continue;
     const hit=s.hitTest({clientX:x,clientY:y});
     if(hit?.object.userData.partId===record.id){result={x,y,id:record.id,drag:record.drag};break;}
    }
   });if(result)return result;
  }return null;
 },{id,dragOnly});
}
