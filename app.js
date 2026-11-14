/* Browser UI for CEPEngine. CEP matching is entirely in cep-engine.js. */
(()=>{'use strict';const $=id=>document.getElementById(id);let rawEvents=CEP.demoEvents(),results=[],engine=null;const SIMPLE=['Price Update','News Update','Sentiment'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>new Date(d).toLocaleString(undefined,{dateStyle:'short',timeStyle:'medium'});
const count=(type)=>results.filter(e=>e.Significance===type).length;
// Sidebar starts collapsed so charts and event results get maximum space.
const sidebarLayout=$('appLayout'),sidebarToggle=$('sidebarToggle'),sidebarContent=$('sidebarContent');
function setSidebar(open){
 sidebarLayout.classList.toggle('sidebar-collapsed',!open);
 sidebarToggle.setAttribute('aria-expanded',String(open));
 sidebarToggle.setAttribute('aria-label',open?'Collapse controls':'Expand controls');
 sidebarToggle.title=open?'Collapse controls':'Expand controls';
 sidebarContent.inert=!open;
 // Charts measure their own canvas width. Recalculate after grid reflow.
 requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
}
sidebarToggle.addEventListener('click',()=>setSidebar(sidebarLayout.classList.contains('sidebar-collapsed')));

const hierarchy=new EventHierarchy($('hierarchySvg'),$('detail'),$('hierarchyStatus'));
const pdag=new EventPDAG($('pdagSvg'),$('pdagDetails'),$('pdagStatus'));
// Event diagrams are now outside Research and visible at all times.
// Details and provenance are always displayed directly below the table.
function showEventAttributes(e){
 const holder=$('selectedEventDetails');
 holder.replaceChildren();
 if(!e){
   $('selectedEventStatus').textContent='No event selected';
   holder.textContent='Select a row to inspect the event and its supporting evidence.';
   return;
 }
 const make=(tag,klass,text)=>{
   const el=document.createElement(tag);
   if(klass)el.className=klass;
   if(text!==undefined)el.textContent=text;
   return el;
 };
 const printable=v=>v instanceof Date?fmt(v):v&&typeof v==='object'?JSON.stringify(v,null,2):String(v??'');
 const present=v=>v!==undefined&&v!==null&&v!=='';
 const section=(heading,description)=>{
   const el=make('section','event-detail-section');
   el.append(make('h4','event-section-heading',heading));
   if(description)el.append(make('p','event-section-desc',description));
   holder.append(el);
   return el;
 };
 const metric=(parent,label,value,emphasis=false)=>{
   if(!present(value))return;
   const item=make('div','event-metric'+(emphasis?' event-metric-primary':''));
   item.append(make('div','event-metric-label',label),make('div','event-metric-value',printable(value)));
   parent.append(item);
 };
 const row=(parent,label,value)=>{
   if(!present(value))return;
   const item=make('div','event-detail-row');
   item.append(make('dt','event-detail-label',label),make('dd','event-detail-data',printable(value)));
   parent.append(item);
 };
 const kind=e.CausalVector?.length?'COMPLEX EVENT':'SOURCE EVENT';
 const hero=make('div','event-hero');
 const identity=make('div','event-identity');
 const eyebrow=make('div','event-eyebrow',kind);
 const name=make('h4','event-hero-title',e.Significance||'Event');
 const sub=make('p','event-hero-subtitle',fmt(e.TimeStamp));
 identity.append(eyebrow,name,sub);
 hero.append(identity);
 if(e.SECURITY||e.PNAC)hero.append(make('div','event-hero-badge',e.SECURITY||e.PNAC));
 holder.append(hero);
 $('selectedEventStatus').textContent='Event '+(e.Id||'')+' · '+kind.toLowerCase();
 const metrics=make('div','event-metrics');
 metric(metrics,'List price',e.LIST_PRICE,true);
 metric(metrics,'Average price',e.AVERAGE_PRICE);
 metric(metrics,'Volume',e.TOTAL_VOLUME);
 metric(metrics,'Number of trades',e.NUM_TRADE);
 if(metrics.children.length)holder.append(metrics);
 if(present(e.HEADLINE_ALERT_TEXT)){
   const headline=section('News headline');
   headline.append(make('p','event-headline',e.HEADLINE_ALERT_TEXT));
 }
 const newsRows=[['Story identifier',e.PNAC],['Message type',e.EVENT_TYPE],['Story ID',e.UNIQUE_STORY_INDEX],['Related securities',e.RELATED_RICS],['Topics',e.TOPICS],['Products',e.PRODUCTS],['Attribution',e.ATTRIBUTION]];
 if(newsRows.some(([,value])=>present(value))){
   const group=section('News metadata');
   const dl=make('dl','event-detail-list');newsRows.forEach(([label,value])=>row(dl,label,value));group.append(dl);
 }
 if(present(e.MatchDescription)||present(e.PatternInstance)||e.CausalVector?.length){
   const group=section('Detection and provenance','These are relationships recorded by CEP rules, not proof of real-world causality.');
   if(present(e.MatchDescription))group.append(make('p','event-rule-description',e.MatchDescription));
   const dl=make('dl','event-detail-list');
   row(dl,'Pattern',e.PatternInstance);
   row(dl,'Source events',e.CausalVector?.length?e.CausalVector.join(', '):undefined);
   group.append(dl);
 }
 const body=[['Accumulated story text',e.ACCUMULATED_STORY_TEXT],['Story text',e.TAKE_TEXT]].filter(([,v])=>present(v));
 if(body.length){
   const group=section('Story content');
   for(const [label,value] of body){
     group.append(make('h5','event-content-label',label),make('p','event-story-text',printable(value)));
   }
 }
 const extras=make('details','event-raw-details');
 extras.append(make('summary','event-raw-toggle','All event attributes · raw record'));
 const raw=make('dl','event-raw-grid');
 for(const key of Object.keys(e).sort((x,y)=>x.localeCompare(y))){
   const pair=make('div','event-raw-row');
   pair.append(make('dt','event-raw-key',key),make('dd','event-raw-value',printable(e[key])));
   raw.append(pair);
 }
 extras.append(raw);holder.append(extras);
}
function selectEvent(id,scroll=false){
 const event=results.find(e=>String(e.Id)===String(id));
 if(!event)return;
 pdag.select(event.Id);
 hierarchy.select(event.Id);
 $('hierarchyPicker').value=hierarchy.selectedId||'';
 showEventAttributes(event);
 $('events').querySelectorAll('tr[aria-selected="true"]').forEach(row=>row.removeAttribute('aria-selected'));
 const selectedRow=[...$('events').querySelectorAll('tr[data-id]')].find(row=>row.dataset.id===String(id));
 if(selectedRow)selectedRow.setAttribute('aria-selected','true');
 if(scroll)$('selectedEventPanel').scrollIntoView({behavior:'smooth',block:'start'});
}

const chartHover=new ChartHover($('chart'),$('chartTooltip'));
chartHover.onSelect=e=>{
  selectEvent(e.Id,true);
};
function updateHierarchy(){
 const complex=results.filter(e=>e.CausalVector?.length);
 const selector=$('hierarchyPicker'),previous=hierarchy.selectedId;
 selector.replaceChildren();
 for(const e of results){
   const option=document.createElement('option');option.value=e.Id;
   option.textContent=(e.Significance==='News Update Plus'?'News near a price rise':e.Significance==='News Update Minus'?'News near a price fall':e.Significance)+' · '+fmt(e.TimeStamp);
   selector.append(option);
 }
 hierarchy.setEvents(results);
 pdag.setEvents(results);
 if(previous && results.some(e=>e.Id===previous)) selectEvent(previous);
 else if(complex.length)selectEvent(complex[0].Id);
 else if(results.length)selectEvent(results[0].Id);
 else showEventAttributes(null);
 selector.value=hierarchy.selectedId||'';
 if(!results.length){
   const option=document.createElement('option');option.textContent='No events found';selector.append(option);
 }
}
$('hierarchyPicker').addEventListener('change',e=>selectEvent(e.target.value));
$('hierarchyIn').addEventListener('click',()=>hierarchy.zoomBy(1.3));
$('hierarchyOut').addEventListener('click',()=>hierarchy.zoomBy(1/1.3));
$('hierarchyFit').addEventListener('click',()=>hierarchy.fit());
$('hierarchyDownload').addEventListener('click',()=>hierarchy.downloadSVG());
// Paint the busy state before synchronous CEP work blocks the browser thread.
const renderPanel=$('chart').closest('.panel');
renderPanel.style.position='relative';
const renderOverlay=document.createElement('div');
renderOverlay.hidden=true;
renderOverlay.setAttribute('aria-hidden','true');
renderOverlay.style.cssText='position:absolute;inset:0;z-index:20;background:rgba(245,247,250,.88);align-items:center;justify-content:center;border-radius:inherit;cursor:wait;font:600 20px system-ui;color:#1f3b64;';
renderOverlay.textContent='Rendering…';
renderPanel.append(renderOverlay);
// Keep the announcement outside the inert application controls.
const renderStatus=document.createElement('div');
renderStatus.setAttribute('role','status');renderStatus.setAttribute('aria-live','polite');
renderStatus.style.cssText='position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
document.body.append(renderStatus);
let isRendering=false,renderAgain=false,renderTask=null;
const paintFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function run(){
 if(isRendering){renderAgain=true;return renderTask;}
 isRendering=true;
 const layout=$('appLayout'),previousInert=layout.inert,previousFocus=document.activeElement;
 layout.inert=true;renderPanel.setAttribute('aria-busy','true');
 renderOverlay.hidden=false;renderOverlay.style.display='flex';
 renderStatus.textContent='Rendering';
 renderTask=(async()=>{
  let failure=null;
  try{
   do{
    renderAgain=false;
    const source=rawEvents.slice();
    const options={priceThreshold:Number($('priceThreshold').value)/100,storyThreshold:Number($('storyThreshold').value)/100,newsWindow:Number($('newsWindow').value)};
    await paintFrame();
    engine=new CEP.Engine(options);results=engine.Initialise(source);render();
    // Retain the lock until the freshly drawn graph has had a paint opportunity.
    await paintFrame();
   }while(renderAgain);
  }catch(err){failure=err;console.error(err);}
  finally{
   renderOverlay.hidden=true;renderOverlay.style.display='none';
   renderPanel.setAttribute('aria-busy','false');layout.inert=previousInert;
   isRendering=false;renderTask=null;
   renderStatus.textContent=failure?'Rendering failed':'Rendering complete';
   if(previousFocus?.isConnected&&!previousInert)previousFocus.focus({preventScroll:true});
  }
  if(failure)alert('Could not process event stream: '+failure.message);
 })();
 return renderTask;
}
function render(){const items=[['Price updates',count('Price Update')],['News updates',count('News Update')],['Price jumps / falls',count('Price Jump')+count('Price Fall')],['Complex matches',results.filter(e=>!SIMPLE.includes(e.Significance)).length]];$('stats').innerHTML=items.map(([n,v])=>`<div class="stat"><div class="value">${v}</div><div class="name">${n}</div></div>`).join('');const types=[...new Set(results.map(e=>e.Significance))].sort();const selected=$('filter').value;$('filter').innerHTML='<option value="">All event types</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('filter').value=types.includes(selected)?selected:'';renderTable();prepareChart();updateHierarchy();LookAheadUI.setData(results);}
// A stable, type-aware sort acts on the entire filtered set BEFORE the
// 3000-row rendering cap, so a price/date sort is not restricted to page one.
const eventSort={key:'timestamp',direction:'asc'};
const sortCollator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
function sortValue(e,key){
 switch(key){
  case 'timestamp':{const t=+new Date(e.TimeStamp);return Number.isFinite(t)?t:null;}
  case 'significance':return e.Significance||null;
  case 'security':return e.PNAC||e.SECURITY||null;
  case 'price':{if(e.LIST_PRICE===undefined||e.LIST_PRICE===null||e.LIST_PRICE==='')return null;const n=Number(e.LIST_PRICE);return Number.isFinite(n)?n:null;}
  case 'headline':return e.HEADLINE_ALERT_TEXT||e.MatchDescription||null;
  default:return null;
 }
}
function compareEvents(a,b,key,dir){
 const x=sortValue(a,key),y=sortValue(b,key);
 // Missing values always go last in either direction.
 if(x==null)return y==null?0:1;
 if(y==null)return -1;
 const comparison=typeof x==='number'&&typeof y==='number'?Math.sign(x-y):sortCollator.compare(String(x),String(y));
 return dir==='asc'?comparison:-comparison;
}
function renderTable(){
 const term=$('search').value.toLowerCase(),filter=$('filter').value;
 const shown=results.filter(e=>(!filter||e.Significance===filter)&&(!term||JSON.stringify(e).toLowerCase().includes(term)))
  .map((e,index)=>({e,index}))
  .sort((a,b)=>compareEvents(a.e,b.e,eventSort.key,eventSort.direction)||a.index-b.index);
 const visible=shown.slice(0,3000);
 $('count').textContent=`${visible.length} of ${shown.length} matching events (${results.length} total)`;
 $('events').innerHTML=visible.map(({e})=>`<tr tabindex="0" data-id="${esc(e.Id)}"><td>${esc(fmt(e.TimeStamp))}</td><td><span class="pill ${SIMPLE.includes(e.Significance)?'':'complex'}">${esc(e.Significance)}</span></td><td>${esc(e.PNAC||e.SECURITY||'—')}</td><td>${e.LIST_PRICE!==undefined?Number(e.LIST_PRICE).toFixed(3):'—'}</td><td>${esc(e.HEADLINE_ALERT_TEXT||e.MatchDescription||'')}</td></tr>`).join('');
 const previousId=pdag.selectedId;
 if(previousId){
  const selected=$('events').querySelectorAll('tr[data-id]');
  for(const row of selected)if(row.dataset.id===String(previousId))row.setAttribute('aria-selected','true');
 }
 $('detectedPanel').querySelectorAll('th[data-sort]').forEach(th=>{
   const active=th.dataset.sort===eventSort.key;
   th.setAttribute('aria-sort',active?(eventSort.direction==='asc'?'ascending':'descending'):'none');
   th.querySelector('.sort-indicator').textContent=active?(eventSort.direction==='asc'?'▲':'▼'):'↕';
 });
}
$('detectedPanel').addEventListener('click',e=>{
 const button=e.target.closest('button.event-sort');
 if(!button)return;
 const key=button.dataset.sort;
 eventSort.direction=eventSort.key===key&&eventSort.direction==='asc'?'desc':'asc';
 eventSort.key=key;
 renderTable();
});
// Keep the plotted data separate from the full event buffer. Viewing a smaller
// time window should not change what CEP detects.
let chartPrices=[],chartEvents=[];
const viewport=new ChartViewport($('chart'),$('chartSelection'),$('zoomRange'),()=>drawChart());
function prepareChart(){
 chartPrices=results.filter(e=>e.Significance==='Price Update'&&Number.isFinite(Number(e.LIST_PRICE))&&Number.isFinite(+new Date(e.TimeStamp)))
  .map(e=>({event:e,t:+new Date(e.TimeStamp),v:Number(e.LIST_PRICE)})).sort((a,b)=>a.t-b.t);
 const colors={'Price Jump':'#1d9c73','Price Fall':'#df6d6d','News Update':'#d99b29','News Story':'#955bcc','News Story Plus':'#955bcc','News Story Minus':'#955bcc'};
 chartEvents=results.filter(e=>colors[e.Significance]&&Number.isFinite(+new Date(e.TimeStamp)))
  .map(e=>({event:e,t:+new Date(e.TimeStamp),color:colors[e.Significance]})).sort((a,b)=>a.t-b.t);
 if(chartPrices.length)viewport.setDomain(chartPrices[0].t,chartPrices[chartPrices.length-1].t);
 else {chartHover.setPoints([]);viewport.setDomain(0,1);}
}
function lowerBound(items,t){let lo=0,hi=items.length;while(lo<hi){const m=(lo+hi)>>>1;if(items[m].t<t)lo=m+1;else hi=m;}return lo;}
// Monotone cubic interpolation passes through every plotted value without
// inventing peaks or dips between neighbouring prices.
function curvedPricePath(context,points,x,y){
 if(!points.length)return;
 const nodes=points.map(p=>({x:x(p.t),y:y(p.v)}));
 const slopes=nodes.slice(1).map((p,i)=>{
  const dx=p.x-nodes[i].x;
  return dx>0?(p.y-nodes[i].y)/dx:0;
 });
 const tangents=nodes.map((p,i)=>{
  if(i===0)return slopes[0]||0;
  if(i===nodes.length-1)return slopes[i-1]||0;
  const a=slopes[i-1],b=slopes[i];
  return a*b>0?2*a*b/(a+b):0;
 });
 context.moveTo(nodes[0].x,nodes[0].y);
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i],dx=(b.x-a.x)/3;
  if(dx<=0){context.lineTo(b.x,b.y);continue;}
  context.bezierCurveTo(a.x+dx,a.y+dx*tangents[i-1],b.x-dx,b.y-dx*tangents[i],b.x,b.y);
 }
}
function drawChart(){
 const [minT,maxT]=viewport.view;
 const visibleMarkers=chartEvents.slice(lowerBound(chartEvents,minT),lowerBound(chartEvents,maxT+1));
 const markerGroups=new Map();
 for(const marker of visibleMarkers){
  if(!markerGroups.has(marker.t))markerGroups.set(marker.t,[]);
  markerGroups.get(marker.t).push(marker);
 }
 const stackGap=12;
 let largestStack=1;
 for(const group of markerGroups.values())largestStack=Math.max(largestStack,group.length);
 const canvas=$('chart'),rect=canvas.getBoundingClientRect(),w=Math.max(350,rect.width),h=Math.max(290,78+(largestStack-1)*stackGap),dpr=window.devicePixelRatio||1;
 canvas.style.height=h+'px';canvas.style.maxHeight='none';
 canvas.width=w*dpr;canvas.height=h*dpr;
 const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);
 if(!chartPrices.length){chartHover.setPoints([]);c.fillText('Import prices to display the timeline.',22,40);return;}
 const margin={l:60,r:15,t:20,b:38},iw=w-margin.l-margin.r,ih=h-margin.t-margin.b;
 const start=lowerBound(chartPrices,minT),end=lowerBound(chartPrices,maxT+1);
 const visible=chartPrices.slice(start,end);
 if(!visible.length){chartHover.setPoints([]);c.fillText('No price records in this selected time range.',22,40);return;}
 const vals=visible.map(p=>p.v),minY=Math.min(...vals),maxY=Math.max(...vals),pad=Math.max(.01,(maxY-minY)*.1);
 const x=t=>margin.l+(t-minT)/Math.max(1,maxT-minT)*iw;
 const y=v=>margin.t+(1-(v-(minY-pad))/(maxY-minY+2*pad))*ih;
 c.font='11px system-ui';c.lineWidth=1;
 for(let i=0;i<=4;i++){const yy=margin.t+i*ih/4;c.strokeStyle='#e5ebf3';c.beginPath();c.moveTo(margin.l,yy);c.lineTo(w-margin.r,yy);c.stroke();c.fillStyle='#75869c';c.fillText((maxY+pad-i*(maxY-minY+2*pad)/4).toFixed(2),8,yy+3);}
 // Min/max envelope per display pixel preserves sharp price spikes.
 // The original full-resolution series remains available when zooming in.
 const points=[];
 if(visible.length>iw*3){
   const buckets=new Map();
   for(const p of visible){const bin=Math.floor(x(p.t));let b=buckets.get(bin);if(!b){b={first:p,last:p,min:p,max:p};buckets.set(bin,b);}else{b.last=p;if(p.v<b.min.v)b.min=p;if(p.v>b.max.v)b.max=p;}}
   for(const b of buckets.values()){const unique=[b.first,b.min,b.max,b.last].filter((p,i,arr)=>arr.indexOf(p)===i).sort((a,z)=>a.t-z.t);points.push(...unique);}
 }else points.push(...visible);
 c.beginPath();curvedPricePath(c,points,x,y);c.strokeStyle='#266bb5';c.lineWidth=2.1;c.lineJoin='round';c.lineCap='round';c.stroke();
 const hitPoints=points.map(p=>({event:p.event,x:x(p.t),y:y(p.v),kind:'price'}));
 // Locate the matching price using binary search, not O(prices×events) findIndex.
 // Only draw the markers inside the visible window.
 for(const [timestamp,group] of markerGroups){
   const idx=Math.min(chartPrices.length-1,lowerBound(chartPrices,timestamp));
   const px=x(timestamp),referenceY=y(chartPrices[idx].v);
   // Keep each timestamp at its true x position. Grow the stack upwards,
   // shifting the whole column down only when needed to keep it in view.
   const baseY=Math.max(referenceY,margin.t+5+(group.length-1)*stackGap);
   if(group.length>1){
     c.beginPath();c.moveTo(px,referenceY);c.lineTo(px,baseY);
     c.lineTo(px,baseY-(group.length-1)*stackGap);
     c.strokeStyle='#a8b5c6';c.lineWidth=1;c.stroke();
   }
   group.forEach((m,index)=>{
     const py=baseY-index*stackGap;
     c.fillStyle=m.color;c.beginPath();c.arc(px,py,m.event.Significance==='News Update'?3:5,0,Math.PI*2);c.fill();
     hitPoints.push({event:m.event,x:px,y:py,kind:'event'});
   });
 }
 c.fillStyle='#7b8a9c';c.fillText(fmt(minT),margin.l,h-10);c.textAlign='right';c.fillText(fmt(maxT),w-margin.r,h-10);c.textAlign='left';
 $('range').textContent=visible.length.toLocaleString()+' of '+chartPrices.length.toLocaleString()+' price points · '+visibleMarkers.length.toLocaleString()+' event markers';
 chartHover.setPoints(hitPoints);
}
$('zoomIn').addEventListener('click',()=>viewport.zoom(.5));
$('zoomOut').addEventListener('click',()=>viewport.zoom(2));
$('zoomLeft').addEventListener('click',()=>viewport.pan(-.6));
$('zoomRight').addEventListener('click',()=>viewport.pan(.6));
$('zoomReset').addEventListener('click',()=>viewport.reset());
$('events').addEventListener('click',e=>{const tr=e.target.closest('tr[data-id]');if(!tr)return;selectEvent(tr.dataset.id,true);});
$('events').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const tr=e.target.closest('tr[data-id]');if(!tr)return;e.preventDefault();selectEvent(tr.dataset.id,true);});
// A pending manual upload must not overwrite a newer upload or demo selection.
let loadGeneration=0;
$('run').addEventListener('click',run);
$('demo').addEventListener('click',()=>{
 loadGeneration++;
 rawEvents=CEP.demoEvents();
 $('pricesFile').value='';$('newsFile').value='';
 $('source').textContent='WWDC 2022 demonstration: 190 prices and 40 news updates; story groups and completion labels adapted for testing';
 run();
});$('filter').addEventListener('change',renderTable);$('search').addEventListener('input',renderTable);window.addEventListener('resize',()=>{if(engine)drawChart();});
$('export').addEventListener('click',()=>{const data=JSON.stringify(results,null,2),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cep-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);});
async function load(){
 const generation=++loadGeneration;
 try{
  const files=[$('pricesFile').files[0],$('newsFile').files[0]];
  if(!files.some(Boolean))return;
  const arrays=await Promise.all(files.map(async(f,i)=>f?(i===0?CEP.parsePricesFile(await f.text()):CEP.parseNewsFile(await f.text())):[]));
  if(generation!==loadGeneration)return;
  rawEvents=arrays.flat();
  $('source').textContent=`Imported ${arrays[0].length} prices and ${arrays[1].length} news updates (local browser files)`;
  run();
  ResearchGraphEffects.shimmer('pdag');
  ResearchGraphEffects.shimmer('scep');
 }catch(err){
  if(generation===loadGeneration)alert('CSV import failed: '+err.message);
 }
}
let researchReport={regression:[],benchmark:[],source:'Synthetic regression fixtures derived from C# patterns; no private Academia research data included'};
$('runTests').addEventListener('click',()=>{researchReport.regression=CEPResearch.runRegression();const passed=researchReport.regression.filter(t=>t.passed).length;$('researchReport').textContent='Software checks: '+passed+'/'+researchReport.regression.length+' passed\\n\\n'+researchReport.regression.map(t=>(t.passed?'PASS ':'FAIL ')+t.name+(t.error?' — '+t.error:'')).join('\\n');});
$('runBench').addEventListener('click',()=>{const result=CEPResearch.benchmark();researchReport.benchmark=result;$('researchReport').textContent='Processing speed on this computer (middle of three runs)\\n'+result.map(r=>r.inputEvents+' inputs | '+r.outputEvents+' outputs | '+r.medianMilliseconds+' ms | '+r.eventsPerSecond+' events/second').join('\\n')+'\\n\\nThese results are specific to this device/browser, and are not historical validation.';});
$('exportResearch').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...researchReport,createdAt:new Date().toISOString(),userAgent:navigator.userAgent},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cep-research-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);});
$('compareRules').addEventListener('click',()=>{const original=engine.ShowAllEvents(),v=CEPInsights.compare(rawEvents,{points:Number($('pointRise').value)});$('insightReport').textContent='Original method: '+(original['Price Jump']||0)+' price jumps, '+(original['News Story']||0)+' completed stories.\nAlternative method: '+v.priceJumps+' price jumps, '+v.stories+' story groups, '+v.newsAndPriceMatches+' news/price matches.\n'+v.singleMessageStories+' story groups have only ONE message (not proof of a completed story).\n\n'+v.notes.join('\n');});
$('orderCheck').addEventListener('click',()=>{const v=CEPInsights.orderingCheck(rawEvents,{points:Number($('pointRise').value)});$('insightReport').textContent=(v.sameCounts?'Counts stayed the same.':'WARNING: Some counts changed when input order was reversed.')+'\nOriginal: '+JSON.stringify({jumps:v.original.priceJumps,stories:v.original.stories,matches:v.original.newsAndPriceMatches})+'\nReversed: '+JSON.stringify({jumps:v.reversed.priceJumps,stories:v.reversed.stories,matches:v.reversed.newsAndPriceMatches})+'\n'+v.notice;});
$('thresholdCheck').addEventListener('click',()=>{const rows=CEPInsights.thresholdCheck(rawEvents);$('insightReport').textContent='How changing the minimum price rise changes what is detected:\n'+rows.map(r=>r.priceRiseNeeded+' points: '+r.priceJumps+' jumps, '+r.newsAndPriceMatches+' news/price matches').join('\n')+'\nThese are different rules, not estimates of forecast accuracy.';});
$('pricesFile').addEventListener('change',load);$('newsFile').addEventListener('change',load);
$('source').textContent='WWDC 2022 demonstration: 190 prices and 40 news updates; story groups and completion labels adapted for testing';
run();})();
