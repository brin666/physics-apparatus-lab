// Decorative accents share the lesson clock so pause and whiteboard snapshots
// keep the exact same appearance, including halfway through a highlight sweep.
export function mountCycleProgress(overview,{pulseCycles=8}={}){
  const items=[...overview.querySelectorAll('.cycle-phase')].map(item=>{
    const meter=item.querySelector('.cycle-phase-meter'),fill=meter.querySelector('i');
    const sheen=document.createElement('span');sheen.className='cycle-phase-sheen';fill.append(sheen);
    const tip=document.createElement('span');tip.className='cycle-phase-tip';
    const dot=document.createElement('b');tip.append(dot);meter.append(tip);
    return {item,fill,sheen,tip,dot};
  });
  const count=items.length;
  let previousProgress,previousReduced;
  return (progress,reduced=false)=>{
    const p=Math.max(0,Math.min(1,progress)),current=Math.min(count-1,Math.floor(p*count));
    if(p===previousProgress&&reduced===previousReduced)return;
    previousProgress=p;previousReduced=reduced;
    const pulse=(p*pulseCycles)%1,beat=reduced?0:Math.sin(pulse*Math.PI)**2;
    items.forEach(({item,fill,sheen,tip,dot},i)=>{
      const fraction=Math.max(0,Math.min(1,p*count-i)),active=p<1&&i===current;
      item.dataset.status=p===1||i<current?'done':active?'current':'waiting';
      if(active)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
      fill.style.transform=`scaleX(${fraction})`;
      sheen.style.transform=`translateX(${-100+pulse*200}%)`;
      sheen.style.opacity=active&&!reduced?String(.55*beat):'0';
      tip.style.transform=`translateX(${fraction*100}%)`;
      tip.style.opacity=active&&fraction>0?'1':'0';
      dot.style.transform=`translate(-50%,-50%) scale(${1+.18*beat})`;
      dot.style.opacity=String(.72+.28*beat);
    });
  };
}
