/*
 * Look Ahead — experimental historical-analogue exploration.
 * Inspired by Section 7.3 and Figure 7.1, Visual Analytics of Event Data
 * (Riley T Perry, UNSW, March 2019).
 *
 * The thesis proposes an interface showing two possible future price paths,
 * but does not prescribe a fitted prediction algorithm. Accordingly this is
 * a transparent, deterministic prototype — not a recreation of a trained
 * model from the thesis and not an investment forecasting system.
 *
 * Critically, a neighbour is eligible only if both its input window AND its
 * complete future window are strictly earlier than the chosen cutoff. No
 * future test labels or observations are used to train the prediction.
 */
(function(global){'use strict';
const ms=e=>+new Date(e.TimeStamp);
function median(xs){if(!xs.length)return 0;const v=[...xs].sort((a,b)=>a-b),m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;}
function build(prices,events,cutIndex,options={}){
 const o={history:Math.max(5,Math.floor(options.history||12)),horizon:Math.max(2,Math.floor(options.horizon||12)),neighbours:Math.max(2,Math.floor(options.neighbours||8))};
 const sorted=prices.filter(e=>e.Significance==='Price Update'&&Number.isFinite(+e.LIST_PRICE)&&e.LIST_PRICE>0&&Number.isFinite(ms(e)))
   .sort((a,b)=>ms(a)-ms(b));
 const index=Math.max(0,Math.min(sorted.length-1,Math.floor(cutIndex)));
 const cutoff=sorted[index];
 if(!cutoff||index<o.history+o.horizon+1)return {error:'Not enough earlier prices for a leak-free lookahead. Move the cutoff later or shorten the windows.',index,prices:sorted,options:o};
 const sec=cutoff.SECURITY;
 // Prices for this security only. No accidental cross-company comparisons.
 const series=sorted.filter(e=>e.SECURITY===sec);
 const anchor=series.findIndex(e=>e.Id===cutoff.Id);
 if(anchor<o.history+o.horizon+1)return {error:'This security does not have enough earlier prices for the selected horizon.',index,prices:series,options:o};
 const stamp=ms(cutoff);
 const eventTypes=['Price Jump','Price Fall','News Update','News Story','News Story Plus','News Story Minus','News Update Plus','News Update Minus'];
 const relevant=(events||[]).filter(e=>eventTypes.includes(e.Significance)&&Number.isFinite(ms(e))&&ms(e)<=stamp&&(
  // A news event can be linked to a security through RICs; a derived event can
  // also be from the single-security sample. Do not use another company's news.
  e.SECURITY===sec || (e.RELATED_RICS||[]).includes(sec) || (!e.SECURITY&&!e.RELATED_RICS)
 )).sort((a,b)=>ms(a)-ms(b));
 const newsAt=t=>relevant.filter(e=>ms(e)<=t&&ms(e)>t-30*60000);
 function features(end){
   const v=series.slice(end-o.history,end+1);
   const returns=[];
   for(let i=1;i<v.length;i++)returns.push(100*(v[i].LIST_PRICE-v[i-1].LIST_PRICE)/v[i-1].LIST_PRICE);
   const at=ms(series[end]),news=newsAt(at);
   return {returns,types:news.reduce((acc,e)=>(acc[e.Significance]=(acc[e.Significance]||0)+1,acc),{})};
 }
 function distance(a,b){
   let score=0;
   for(let i=0;i<a.returns.length;i++)score+=(a.returns[i]-b.returns[i])**2;
   score/=Math.max(1,a.returns.length);
   for(const type of eventTypes){
     const x=Math.min(4,a.types[type]||0),y=Math.min(4,b.types[type]||0);
     score+=.09*(x-y)**2;
   }
   return Math.sqrt(score);
 }
 const now=features(anchor),candidates=[];
 // Strictly historical analogues: the last actual outcome in every training
 // example is prior to cutoff, so the evaluation tail is never leaked.
 for(let i=o.history;i+o.horizon<anchor;i++){
   const f=features(i),start=series[i].LIST_PRICE;
   const changes=series.slice(i+1,i+o.horizon+1).map(p=>100*(p.LIST_PRICE-start)/start);
   if(changes.length!==o.horizon)continue;
   const terminal=changes.at(-1);
   candidates.push({at:i,date:series[i].TimeStamp,eventId:series[i].Id,similarity:distance(now,f),changes,terminal});
 }
 candidates.sort((a,b)=>a.similarity-b.similarity);
 // Keep candidates reasonably separated to avoid showing a single episode
 // multiple times. This is based exclusively on past timestamps.
 const ranked=[];
 for(const c of candidates){if(ranked.every(r=>Math.abs(r.at-c.at)>Math.max(3,Math.floor(o.history/2))))ranked.push(c);}
 const upward=ranked.filter(c=>c.terminal>=0).slice(0,o.neighbours);
 const downward=ranked.filter(c=>c.terminal<0).slice(0,o.neighbours);
 const meanPath=list=>list.length?Array.from({length:o.horizon},(_,k)=>{
   const weights=list.map(v=>1/(.01+v.similarity));const denominator=weights.reduce((a,b)=>a+b,0);
   return list.reduce((sum,c,j)=>sum+c.changes[k]*weights[j],0)/denominator;
 }):null;
 const scenarios=[
   {id:'A',label:'Higher-price scenario',kind:'rise',sampleCount:upward.length,analogues:upward,percent:meanPath(upward)},
   {id:'B',label:'Lower-price scenario',kind:'fall',sampleCount:downward.length,analogues:downward,percent:meanPath(downward)}
 ].map(p=>({...p,prices:p.percent?.map(percent=>cutoff.LIST_PRICE*(1+percent/100))||null}));
 const future=series.slice(anchor+1,anchor+o.horizon+1);
 const actual=future.length?future.map(p=>p.LIST_PRICE):[];
 const mae=p=>p.prices&&actual.length?actual.reduce((sum,value,i)=>sum+Math.abs(value-p.prices[i]),0)/actual.length:null;
 scenarios.forEach(s=>s.mae=mae(s));
 return {security:sec,cutoff:cutoff.TimeStamp,cutoffId:cutoff.Id,cutoffPrice:cutoff.LIST_PRICE,history:series.slice(Math.max(0,anchor-o.history),anchor+1),options:o,scenarios,actual,actualEvents:future,inputs:now,availableAnalogues:ranked.length,lookaheadPatterns:relevant.filter(e=>ms(e)<=stamp&&ms(e)>ms(series[Math.max(0,anchor-o.history)])).map(e=>({Id:e.Id,Significance:e.Significance,TimeStamp:e.TimeStamp})),index,availableFuture:actual.length};
}
global.CEPLookAhead={build,median};
})(window);
