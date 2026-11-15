/* Shared rendering feedback and background computation. */
(function(global){'use strict';
 const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 class Progress {
  constructor(panel,lockTarget){
   this.panel=panel;this.target=lockTarget;
   panel.style.position='relative';
   this.overlay=document.createElement('div');this.overlay.hidden=true;
   this.overlay.setAttribute('aria-hidden','true');
   this.overlay.style.cssText='position:absolute;inset:0;z-index:20;background:rgba(245,247,250,.90);align-items:center;justify-content:center;flex-direction:column;gap:8px;border-radius:inherit;cursor:wait;color:#1f3b64;';
   const title=document.createElement('strong');title.textContent='Rendering…';title.style.font='600 20px system-ui';
   this.overlay.append(title);panel.append(this.overlay);
   this.status=document.createElement('div');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
   this.status.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
   document.body.append(this.status);
  }
  start(){
   if(!this.active){this.previousInert=this.target.inert;this.focus=document.activeElement;this.active=true;}
   this.target.inert=true;this.panel.setAttribute('aria-busy','true');
   this.overlay.hidden=false;this.overlay.style.display='flex';
   this.status.textContent='Rendering…';
  }
  finish(failed=false){
   this.overlay.hidden=true;this.overlay.style.display='none';
   this.panel.setAttribute('aria-busy','false');this.target.inert=this.previousInert;this.active=false;
   this.status.textContent=failed?'Rendering failed':'Rendering complete';
   if(this.focus?.isConnected&&this.target.contains(this.focus)&&!this.previousInert&&!this.focus.closest('[inert]'))this.focus.focus({preventScroll:true});
  }
 }
 function compute(source,operation,payload,fallback){
  return new Promise((resolve,reject)=>{
   let worker,url,received=false,fallbackStarted=false;
   const cleanup=()=>{if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);};
   const useFallback=async()=>{if(received||fallbackStarted)return;fallbackStarted=true;cleanup();await paint();try{resolve(fallback());}catch(e){reject(e);}};
   try{
    if(!global.Worker){useFallback();return;}
    url=URL.createObjectURL(new Blob([source,'\nself.onmessage=function(e){try{const result=(',operation,')(e.data);self.postMessage({ok:true,result});}catch(err){self.postMessage({ok:false,error:err.message});}};'],{type:'text/javascript'}));
    worker=new Worker(url);
    worker.onmessage=e=>{received=true;cleanup();e.data.ok?resolve(e.data.result):reject(Error(e.data.error));};
    worker.onmessageerror=()=>{received=true;cleanup();reject(Error("Could not read background rendering result."));};
    worker.onerror=e=>{e.preventDefault();if(!received)useFallback();};
    worker.postMessage(payload);
   }catch(_){useFallback();}
  });
 }
 global.RenderProgress={Progress,paint,compute};
})(window);
