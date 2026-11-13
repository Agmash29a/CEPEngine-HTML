/*
 * One-time light sweep when research graphs receive new data.
 * Hidden diagrams defer the effect until Research is expanded.
 */
(function(global){'use strict';
const panel=document.getElementById('researchPanel');
const stages={pdag:document.getElementById('pdagGraphStage'),scep:document.getElementById('scepGraphStage')};
const pending=new Set();
function animate(stage){
 if(!stage)return;
 stage.classList.remove('graph-shimmer-active');
 // Reflow allows repeat imports to replay the CSS keyframe.
 void stage.offsetWidth;
 stage.classList.add('graph-shimmer-active');
}
function shimmer(kind){
 const stage=stages[kind];
 if(!stage)return;
 if(!panel.open){pending.add(kind);return;}
 animate(stage);
}
panel.addEventListener('toggle',()=>{
 if(!panel.open)return;
 // The existing hierarchy is drawn while hidden; fitting after expansion
 // uses the real container dimensions. Notify listeners independently.
 panel.dispatchEvent(new CustomEvent('research:opened'));
 for(const kind of pending)animate(stages[kind]);
 pending.clear();
});
for(const stage of Object.values(stages)){
 stage?.addEventListener('animationend',e=>{
  if(e.animationName==='graph-shimmer')stage.classList.remove('graph-shimmer-active');
 });
}
global.ResearchGraphEffects={shimmer};
})(window);
