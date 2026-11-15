/* Progressive disclosure for the workspace; detection logic is unchanged. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 document.querySelectorAll('.workspace-bar a[href^="#"]').forEach(link=>{
  link.addEventListener('click',()=>{const panel=$(link.getAttribute('href').slice(1));if(panel?.tagName==='DETAILS')panel.open=true;});
 });
 $('detectedPanel').addEventListener('toggle',()=>{
  if($('detectedPanel').open&&!$('hierarchyPanel').hidden)requestAnimationFrame(()=>$('hierarchyFit').click());
 });
 const tabs=[...document.querySelectorAll('.inspector-tabs [role="tab"]')];
 function activate(tab,focus=false){
  for(const item of tabs){
   const active=item===tab;
   item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;
   $(item.getAttribute('aria-controls')).hidden=!active;
  }
  if(focus)tab.focus();
  if(tab.id==='tab-tree')requestAnimationFrame(()=>$('hierarchyFit').click());
 }
 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>activate(tab));
  tab.addEventListener('keydown',e=>{
   let next;
   if(e.key==='ArrowRight')next=(index+1)%tabs.length;
   if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
   if(e.key==='Home')next=0;
   if(e.key==='End')next=tabs.length-1;
   if(next!==undefined){e.preventDefault();activate(tabs[next],true);}
  });
 });
})();
