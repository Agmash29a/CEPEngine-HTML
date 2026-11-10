/*
 * Section 7.3 Look Ahead visual interface.
 * Historical data cut-off, two alternative price paths, event-pattern context,
 * and out-of-sample outcomes (when subsequent observations exist).
 */
(function(global){'use strict';
 const $=id=>document.getElementById(id),panel=$('lookaheadPanel');
 if(!panel||!global.CEPLookAhead)return;
 let prices=[],events=[],current=null;
 const canvas=$('lookaheadCanvas'),ctx=canvas.getContext('2d');
 const fmt=t=>new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 const range=$('lookaheadCutoff');
 function selectedIndex(){return Math.round(Number(range.value));}
 function refresh(){
   if(!prices.length){$('lookaheadStats').textContent='Load a Price CSV to begin.';return;}
   const index=selectedIndex(),h=Number($('lookaheadHistory').value),n=Number($('lookaheadHorizon').value);
   current=CEPLookAhead.build(prices,events,index,{history:h,horizon:n,neighbours:Number($('lookaheadNeighbours').value)});
   $('lookaheadCutoffLabel').textContent='Historical cut-off: '+fmt(prices[index].TimeStamp)+' · '+(prices[index].SECURITY||'Unknown security');
   if(current.error){$('lookaheadStats').textContent=current.error;$('lookaheadDescription').textContent='Choose a later cut-off or shorter horizon.';drawEmpty(current.error);return;}
   const paths=current.scenarios,shown=paths.filter(p=>p.prices);
   $('lookaheadStats').textContent=current.security+' · '+current.availableAnalogues+' historical analogue candidates · '+current.lookaheadPatterns.length+' nearby observed higher-level events · '+current.availableFuture+' future price observations available for comparison';
   $('lookaheadDescription').textContent=paths.map(s=>s.label+': '+(s.prices? s.sampleCount+' prior examples; final estimated change '+s.percent.at(-1).toFixed(2)+'%'+(s.mae==null?'':' · later-observed MAE '+s.mae.toFixed(3)) : 'no qualifying historical examples')).join('\n')+'\nThese are plausible historical pattern continuations, not calibrated probabilities or demonstrated causal effects.';
   draw();
 }
 function drawEmpty(message){
   const w=canvas.clientWidth||800,h=canvas.clientHeight||355,scale=window.devicePixelRatio||1;
   canvas.width=w*scale;canvas.height=h*scale;ctx.setTransform(scale,0,0,scale,0,0);
   ctx.clearRect(0,0,w,h);ctx.fillStyle='#687a92';ctx.font='13px system-ui';ctx.fillText(message||'No observations',20,35);
 }
 function draw(){
   if(!current||current.error)return;
   const width=Math.max(480,canvas.clientWidth||480),height=355,dpr=window.devicePixelRatio||1;
   canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
   const {history,scenarios,actual,cutoffPrice,options}=current,m={l:65,r:18,t:26,b:48},iw=width-m.l-m.r,ih=height-m.t-m.b;
   const hist=history.map(e=>+e.LIST_PRICE);
   const series=[...hist,...scenarios.flatMap(s=>s.prices||[]),...actual],bottom=Math.min(...series),top=Math.max(...series),pad=Math.max(.1,(top-bottom)*.14),lo=bottom-pad,hi=top+pad;
   const countLeft=hist.length-1,total=countLeft+options.horizon;
   const x=i=>m.l+(i/total)*iw,y=v=>m.t+ih-(v-lo)/(hi-lo)*ih;
   ctx.font='11px system-ui';
   for(let i=0;i<=4;i++){const price=lo+(hi-lo)*i/4,yy=y(price);ctx.strokeStyle='#e2e9f2';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(m.l,yy);ctx.lineTo(width-m.r,yy);ctx.stroke();ctx.fillStyle='#64758b';ctx.fillText(price.toFixed(2),9,yy+4);}
   const line=(points,colour,dash=[],weight=2)=>{
     ctx.strokeStyle=colour;ctx.lineWidth=weight;ctx.setLineDash(dash);ctx.beginPath();
     points.forEach((p,i)=>i?ctx.lineTo(x(p[0]),y(p[1])):ctx.moveTo(x(p[0]),y(p[1])));
     ctx.stroke();ctx.setLineDash([]);
   };
   line(hist.map((value,i)=>[i,value]),'#172b48',[],2.8);
   const cutoffX=x(countLeft);
   ctx.setLineDash([5,4]);ctx.strokeStyle='#d34f52';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cutoffX,m.t);ctx.lineTo(cutoffX,m.t+ih);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#b62c3f';ctx.fillText('Current time / cut-off',Math.min(cutoffX+5,width-155),18);
   for(const [i,s] of scenarios.entries()){
     if(!s.prices)continue;
     line([[countLeft,cutoffPrice],...s.prices.map((p,j)=>[countLeft+j+1,p])],i===0?'#1a9b74':'#c78235',[6,3],2.7);
     const last=s.prices.at(-1),endX=x(total),label=s.id+' '+s.percent.at(-1).toFixed(1)+'%';
     ctx.fillStyle=i===0?'#188664':'#a86821';ctx.font='bold 12px system-ui';ctx.fillText(label,Math.max(m.l,Math.min(width-75,endX-52)),y(last)-8);ctx.font='11px system-ui';
   }
   if($('lookaheadActual').checked&&actual.length)line([[countLeft,cutoffPrice],...actual.map((p,j)=>[countLeft+j+1,p])],'#71859d',[2,3],1.8);
   // Mark historical CEP events in an unambiguous separate lower row. A red
   // boundary separates the known history from the hypothetical continuations.
   const ticks=current.lookaheadPatterns.slice(-100);
   const first=+new Date(history[0].TimeStamp),end=+new Date(current.cutoff);
   for(const e of ticks){
     const t=+new Date(e.TimeStamp);
     if(t<first||t>end)continue;
     const px=m.l+((t-first)/(end-first||1))*(cutoffX-m.l);
     ctx.fillStyle=/Fall|Minus/.test(e.Significance)?'#da6573':/News/.test(e.Significance)?'#8b66bb':'#21a578';
     ctx.fillRect(px-2,height-m.b+9,4,7);
   }
   ctx.fillStyle='#617189';ctx.fillText('Historical event matches',m.l,height-10);
   ctx.fillText('← observed past',m.l+5,m.t+12);ctx.fillText('hypothetical futures →',Math.min(cutoffX+14,width-165),m.t+12);
 }
 function setData(all){
   events=all||[];
   prices=events.filter(e=>e.Significance==='Price Update'&&Number.isFinite(+new Date(e.TimeStamp))&&Number.isFinite(Number(e.LIST_PRICE))&&Number(e.LIST_PRICE)>0)
     .sort((a,b)=>+new Date(a.TimeStamp)-new Date(b.TimeStamp));
   range.max=Math.max(0,prices.length-1);
   // Hold out the final 15% by default for a visible comparison with
   // actual values, while still retaining enough earlier training examples.
   range.value=Math.max(0,Math.floor((prices.length-1)*.85));
   refresh();
 }
 function save(){
   if(!current||current.error)return;
   const output={...current,model:'Historical-analogue exploration, not machine learning probability or investment advice',generatedAt:new Date().toISOString()};
   const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='cep-lookahead.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 range.addEventListener('input',refresh);
 for(const id of ['lookaheadHistory','lookaheadHorizon','lookaheadNeighbours','lookaheadActual'])$(id).addEventListener('change',refresh);
 $('lookaheadLatest').addEventListener('click',()=>{range.value=range.max;refresh();});
 $('lookaheadHoldout').addEventListener('click',()=>{range.value=Math.floor((prices.length-1)*.75);refresh();});
 $('lookaheadExport').addEventListener('click',save);
 window.addEventListener('resize',draw);
 global.LookAheadUI={setData,refresh};
})(window);