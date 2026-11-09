/*
 * SCEP interface: plain-language controls for knowledge-based event detection.
 * Uses scep-engine.js; does not modify the original CEP algorithms.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let example=SCEP.sample(),kb=new SCEP.KnowledgeBase(example.triples),input=example.events,analysis=null;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const date=x=>new Date(x).toLocaleString();
 function rules(){
   const opt=id=>$(id).value.trim();
   return {className:opt('scepClass'),industry:opt('scepIndustry'),minEmployees:opt('scepMinStaff')===''?null:Number(opt('scepMinStaff')),maxEmployees:opt('scepMaxStaff')===''?null:Number(opt('scepMaxStaff')),minProfitUSD:opt('scepMinProfit')===''?null:Number(opt('scepMinProfit'))*1e9,priceThresholdPct:Number(opt('scepPriceMove')),newsWindowMinutes:Number(opt('scepNewsWindow'))};
 }
 function updateClassChoices(){
   const classes=[...new Set(kb.triples.filter(t=>t[1]==='rdf:type'||t[1]==='rdfs:subClassOf').map(t=>t[1]==='rdf:type'?t[2]:t[0]).concat(kb.triples.filter(t=>t[1]==='rdfs:subClassOf').map(t=>t[2])))].sort();
   const select=$('scepClass'),old=select.value;
   select.replaceChildren();
   for(const value of ['',...classes]){const option=document.createElement('option');option.value=value;option.textContent=value?value.replace(/^ex:/,''):'Any company type';select.append(option);}
   if(classes.includes(old))select.value=old;
 }
 function updateFacts(){
   $('scepFacts').innerHTML=kb.triples.map(t=>'<tr><td>'+esc(t[0])+'</td><td>'+esc(t[1])+'</td><td>'+esc(t[2])+'</td></tr>').join('');
 }
 function run(){
   try{
     analysis=SCEP.analyze(input,kb,rules());
     const s=analysis.summary;
     $('scepStats').textContent=s.matched+' observations matched your company criteria; '+s.excluded+' excluded; '+s.detected+' new events detected. '+s.unmapped+' observations had no known company mapping.';
     $('scepEvents').innerHTML=analysis.derived.map(e=>'<tr data-id="'+esc(e.Id)+'"><td>'+esc(date(e.TimeStamp))+'</td><td>'+esc(e.Significance)+'</td><td>'+esc(e.Semantic.companyName)+'</td><td>'+e.PercentChange.toFixed(2)+'%</td><td>'+esc(e.Semantic.industry)+'</td><td>'+esc(e.Semantic.employees)+'</td></tr>').join('');
     if(!analysis.derived.length)$('scepEvents').innerHTML='<tr><td colspan="6">No events met these criteria. Try removing a filter or lowering the minimum price change.</td></tr>';
     $('scepDetail').textContent='Choose a result to see both its original observations and the company facts used by the rule.';
   }catch(error){$('scepStats').textContent='Problem: '+error.message;console.error(error);}
 }
 function exportFile(name,value){
   const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function useExample(){
   example=SCEP.sample();kb=new SCEP.KnowledgeBase(example.triples);input=example.events;
   $('scepClass').value='';$('scepIndustry').value='';$('scepMinStaff').value='';$('scepMaxStaff').value='';$('scepMinProfit').value='1';$('scepPriceMove').value='0.05';$('scepNewsWindow').value='30';
   updateClassChoices();updateFacts();run();
   $('scepSource').textContent='Synthetic demonstration: fictional event times, prices, employees and profits. No actual market records.';
 }
 $('scepDemo').addEventListener('click',useExample);
 $('scepRun').addEventListener('click',run);
 $('scepExport').addEventListener('click',()=>{if(analysis)exportFile('scep-results.json',{rule:analysis.rule,summary:analysis.summary,derived:analysis.derived,knowledge:kb.triples});});
 $('scepExportExample').addEventListener('click',()=>exportFile('scep-example-data.json',example));
 $('scepKnowledgeFile').addEventListener('change',async e=>{
   const file=e.target.files[0];if(!file)return;
   try{const value=JSON.parse(await file.text());kb=new SCEP.KnowledgeBase(Array.isArray(value)?value:value.triples);updateClassChoices();updateFacts();run();$('scepSource').textContent='Loaded company facts: '+file.name;}catch(err){alert('Could not read company facts: '+err.message);}
 });
 $('scepEventsFile').addEventListener('change',async e=>{
   const file=e.target.files[0];if(!file)return;
   try{const value=JSON.parse(await file.text());input=Array.isArray(value)?value:value.events;if(!Array.isArray(input))throw Error('Expected an array of events');run();$('scepSource').textContent='Loaded example events: '+file.name;}catch(err){alert('Could not read events: '+err.message);}
 });
 $('scepEvents').addEventListener('click',e=>{
   const tr=e.target.closest('tr[data-id]');if(!tr||!analysis)return;
   const item=analysis.derived.find(x=>x.Id===tr.dataset.id);if(!item)return;
   const sources=analysis.selected.filter(x=>item.CausalVector.includes(x.Id));
   $('scepDetail').textContent='Detected: '+item.Significance+'\nCompany: '+item.Semantic.companyName+'\nPrice change: '+item.PercentChange+'%\n\nInput observations:\n'+sources.map(x=>'- '+x.Significance+' at '+date(x.TimeStamp)+(x.LIST_PRICE!=null?', price '+x.LIST_PRICE:'')+(x.HEADLINE_ALERT_TEXT?', '+x.HEADLINE_ALERT_TEXT:'')).join('\n')+'\n\nCompany facts used in evaluation:\n'+item.Semantic.matchedFacts.map(x=>x.subject+' '+x.predicate+' '+x.object).join('\n')+'\n\nThese links explain the rule match, not why the market actually moved.';
 });
 $('scepClass').addEventListener('change',run);
 updateClassChoices();updateFacts();run();
})();
