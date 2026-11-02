/* Research-informed comparisons, distinct from the historical C# rules.
 * These are exploratory diagnostics, NOT claims of causation or validation.
 * Based on the uploaded 2015-model reconstruction, event-inference-validity,
 * event-sensitivity and StockNet matched-timing research reports.
 */
(function(global){'use strict';
const ms=e=>+new Date(e.TimeStamp);
function compare(input,settings={}){
 const threshold=Number(settings.points??2),windowMinutes=Number(settings.windowMinutes??30);
 const normalized=input.map((e,i)=>({...e,_position:i,_security:e.SECURITY||e.STOCK_RIC||e.RELATED_RICS?.[0]||'UNKNOWN'}));
 const ordered=[...normalized].sort((a,b)=>ms(a)-ms(b)||a._position-b._position);
 const prices=ordered.filter(e=>e.Significance==='Price Update'&&Number.isFinite(Number(e.LIST_PRICE)));
 const news=ordered.filter(e=>e.Significance==='News Update');
 const byStock=new Map();
 for(const p of prices){if(!byStock.has(p._security))byStock.set(p._security,[]);byStock.get(p._security).push(p);}
 const jumps=[];
 for(const [stock,arr] of byStock)for(let i=1;i<arr.length;i++){const a=arr[i-1],b=arr[i];if(b.LIST_PRICE-a.LIST_PRICE>threshold)jumps.push({stock,from:a,to:b,delta:b.LIST_PRICE-a.LIST_PRICE});}
 const groups=new Map();
 for(const n of news){const k=n._security+'|'+(n.PNAC||n.Id);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n);}
 const stories=[...groups.entries()].map(([key,updates])=>({key,stock:updates[0]._security,pnac:updates[0].PNAC||'',updates,start:updates[0],end:updates.at(-1),single:updates.length===1}));
 // Paper-inspired event inclusion: price-pair beginning <= story beginning <= story ending <= pair ending.
 const linked=[];
 for(const j of jumps)for(const s of stories){if(j.stock!==s.stock)continue;if(ms(j.from)<=ms(s.start)&&ms(s.end)<=ms(j.to))linked.push({stock:j.stock,pnac:s.pnac,delta:j.delta,storyUpdates:s.updates.length,priceStart:j.from.TimeStamp,priceEnd:j.to.TimeStamp,storyStart:s.start.TimeStamp,storyEnd:s.end.TimeStamp});}
 const proximity=news.reduce((n,e)=>n+(jumps.some(j=>j.stock===e._security&&Math.abs(ms(j.to)-ms(e))<=windowMinutes*60000)?1:0),0);
 return {priceUpdates:prices.length,newsUpdates:news.length,priceJumps:jumps.length,stories:stories.length,singleMessageStories:stories.filter(s=>s.single).length,newsAndPriceMatches:linked.length,nearbyNewsMessages:proximity,linked,notes:[
 'A match means two events occurred within a rule-defined period; it does not prove that the news caused the price movement.',
 'Stories made from one message are labelled incomplete/uncertain rather than verified finished stories.',
 'The 2-point price rise and containing time window are one reconstruction of the research example, not a rule established for every market.',
 'The dataset must supply consistent company identifiers to connect prices and news reliably.'
 ]};
}
function orderingCheck(input,settings={}){
 const first=compare(input,settings);
 const second=compare([...input].reverse(),settings);
 const fields=['priceJumps','stories','newsAndPriceMatches','singleMessageStories'];
 return {sameCounts:fields.every(k=>first[k]===second[k]),original:first,reversed:second,notice:'Equal totals do not guarantee identical underlying matches. Time ties require stable IDs and a declared ordering rule.'};
}
function thresholdCheck(input,thresholds=[.5,1,2,3,4]){
 return thresholds.map(points=>{const r=compare(input,{points});return {priceRiseNeeded:points,priceJumps:r.priceJumps,newsAndPriceMatches:r.newsAndPriceMatches};});
}
global.CEPInsights={compare,orderingCheck,thresholdCheck};
})(window);