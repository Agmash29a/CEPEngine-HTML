/*
 * ChartViewport: time-axis zoom and range selection.
 * Independent of CEP detection; changing the viewport never reruns rules.
 * Wheel zoom is anchored to the pointer; drag selects a time range.
 */
(function(global){'use strict';
class ChartViewport {
 constructor(canvas,overlay,label,onChange){
  this.canvas=canvas;this.overlay=overlay;this.label=label;this.onChange=onChange;
  this.full=[0,1];this.view=[0,1];this.dragStart=null;this.dragEnd=null;
  canvas.addEventListener('wheel',e=>{
    if(!this.ready())return;
    e.preventDefault();
    const x=this.localX(e),anchor=this.pointTime(x),factor=e.deltaY<0?0.72:1/0.72;
    const span=(this.view[1]-this.view[0])*factor;
    const minSpan=Math.max(1000,(this.full[1]-this.full[0])/100000);
    const clamped=Math.max(minSpan,Math.min(this.full[1]-this.full[0],span));
    const ratio=(anchor-this.view[0])/(this.view[1]-this.view[0]);
    this.setView(anchor-clamped*ratio,anchor+clamped*(1-ratio));
  },{passive:false});
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0 || !this.ready())return;
    this.dragStart=this.clampX(this.localX(e));
    this.dragEnd=this.dragStart;
    canvas.setPointerCapture(e.pointerId);this.drawSelection();
  });
  canvas.addEventListener('pointermove',e=>{
    if(this.dragStart==null)return;
    this.dragEnd=this.clampX(this.localX(e));this.drawSelection();
  });
  canvas.addEventListener('pointerup',e=>{
    if(this.dragStart==null)return;
    const a=this.dragStart,b=this.clampX(this.localX(e));
    const prior=[...this.view];
    this.dragStart=null;this.dragEnd=null;this.drawSelection();
    if(Math.abs(b-a)>=12){
      const t0=this.pointTime(Math.min(a,b),prior),t1=this.pointTime(Math.max(a,b),prior);
      this.setView(t0,t1);
      // Avoid opening the event hierarchy after selecting a zoom region.
      this.blockClick=true;
    }
  });
  canvas.addEventListener('click',e=>{
    if(this.blockClick){e.stopImmediatePropagation();this.blockClick=false;}
  },true);
  canvas.addEventListener('pointercancel',()=>{this.dragStart=null;this.dragEnd=null;this.drawSelection();});
  canvas.addEventListener('dblclick',e=>{e.preventDefault();this.reset();});
 }
 ready(){return this.full[1]>this.full[0];}
 bounds(){const w=this.canvas.clientWidth||600;return {left:60,right:Math.max(61,w-15)};}
 localX(e){const r=this.canvas.getBoundingClientRect();return (e.clientX-r.left)*((this.canvas.clientWidth||r.width)/r.width);}
 clampX(x){const b=this.bounds();return Math.max(b.left,Math.min(b.right,x));}
 pointTime(x,range=this.view){const b=this.bounds();return range[0]+(this.clampX(x)-b.left)/(b.right-b.left)*(range[1]-range[0]);}
 setDomain(start,end){
  if(!Number.isFinite(start)||!Number.isFinite(end)){start=0;end=1;}
  if(end<=start)end=start+60000;
  this.full=[start,end];this.view=[start,end];this.changed();
 }
 setView(start,end){
  const [lo,hi]=this.full,span=Math.min(hi-lo,Math.max(1,end-start));
  let from=Math.max(lo,Math.min(start,hi-span));
  this.view=[from,from+span];this.changed();
 }
 reset(){this.view=[...this.full];this.changed();}
 zoom(multiplier){const center=(this.view[0]+this.view[1])/2;const span=(this.view[1]-this.view[0])*multiplier;this.setView(center-span/2,center+span/2);}
 pan(frac){const delta=(this.view[1]-this.view[0])*frac;this.setView(this.view[0]+delta,this.view[1]+delta);}
 drawSelection(){
  if(this.dragStart==null){this.overlay.hidden=true;return;}
  const a=Math.min(this.dragStart,this.dragEnd),b=Math.max(this.dragStart,this.dragEnd);
  this.overlay.hidden=false;this.overlay.style.left=a+'px';this.overlay.style.width=(b-a)+'px';
 }
 changed(){
  const [a,b]=this.view,[lo,hi]=this.full;
  const portion=Math.max(0.0001,(b-a)/(hi-lo));
  const format=t=>new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  this.label.textContent=format(a)+' – '+format(b)+' · '+(portion>=.999?'full range':Math.round(1/portion*10)/10+'× zoom');
  this.onChange();
 }
}
global.ChartViewport=ChartViewport;
})(window);