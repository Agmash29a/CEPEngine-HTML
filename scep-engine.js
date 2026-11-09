/*
 * SCEP: Semantic Complex Event Processing (browser-only teaching implementation)
 *
 * Based on Chapter 6 of Riley T Perry's UNSW thesis, especially §§6.2.1,
 * 6.2.2, 6.2.4 and 6.2.6. Original CEP and its ActivePatterns are unchanged.
 *
 * Knowledge is stored as RDF-like [subject,predicate,object] triples.
 * This is a deliberately limited in-browser RDFS subset, NOT a full RDF/OWL
 * reasoner or SPARQL execution engine.
 *
 * SCEP adds domain knowledge to pattern matching and to the event's form.
 * All output keeps references to the original event(s) and facts used.
 */
(function(global){'use strict';
 const ALLOWED_PREDICATES=new Set(['rdf:type','rdfs:subClassOf','ex:industry','ex:employees','ex:netProfitUSD','ex:instrument','ex:companyName','ex:country','ex:parentCompany','ex:material','ex:builds']);
 const NUMERIC=new Set(['ex:employees','ex:netProfitUSD']);
 const time=e=>new Date(e.TimeStamp).getTime();
 const slug=s=>String(s).replace(/[^a-zA-Z0-9_-]/g,'_');
 const stable=e=>String(e.Id||'unknown');
 class KnowledgeBase {
   constructor(triples=[]){this.triples=[];this.load(triples);}
   load(triples){if(!Array.isArray(triples))throw Error('Knowledge must be an array of triples');this.triples=triples.map(t=>{const [s,p,o]=Array.isArray(t)?t:[t.subject,t.predicate,t.object];if(!s||!ALLOWED_PREDICATES.has(p)||o===undefined||o===null)throw Error('Invalid or unsupported knowledge fact: '+JSON.stringify(t));if(NUMERIC.has(p)&&!Number.isFinite(Number(o)))throw Error('Invalid number in '+p);return [String(s),p,NUMERIC.has(p)?Number(o):String(o)];});return this;}
   add(s,p,o){this.load([...this.triples,[s,p,o]]);}
   facts(subject,predicate=null){return this.triples.filter(t=>t[0]===subject&&(!predicate||t[1]===predicate));}
   values(subject,predicate){return this.facts(subject,predicate).map(t=>t[2]);}
   // rdfs:subClassOf closure: an instance of a subclass is also an instance
   // of each ancestor class. Visited-set protects against cyclic input.
   isA(subject,klass){const queue=this.values(subject,'rdf:type'),seen=new Set();while(queue.length){const item=queue.shift();if(item===klass)return true;if(seen.has(item))continue;seen.add(item);queue.push(...this.values(item,'rdfs:subClassOf'));}return false;}
   describe(subject){return {subject,facts:this.facts(subject).map(t=>({subject:t[0],predicate:t[1],object:t[2]})),types:this.values(subject,'rdf:type')};}
   // Link market SECURITY/RIC to a company entity through ex:instrument.
   companyFor(e){const identifier=e.SECURITY||e.STOCK_RIC||(Array.isArray(e.RELATED_RICS)?e.RELATED_RICS[0]:null);if(!identifier)return null;const fact=this.triples.find(t=>t[1]==='ex:instrument'&&t[2]===String(identifier));return fact?.[0]||null;}
   companyFacts(company){return this.facts(company);}
 }
 // Basic semantic filters. Deliberately explicit: no eval(), remote code,
 // dynamic SQL, or arbitrary user-written SPARQL.
 function checkCompany(kb,company,rule){
   if(!company)return false;
   if(rule.className&&!kb.isA(company,rule.className))return false;
   if(rule.industry&&!kb.values(company,'ex:industry').includes(rule.industry))return false;
   for(const [field,minimum,maximum] of [['ex:employees',rule.minEmployees,rule.maxEmployees],['ex:netProfitUSD',rule.minProfitUSD,rule.maxProfitUSD]]){
     if(minimum==null&&maximum==null)continue;
     const values=kb.values(company,field);
     if(!values.length || !values.some(v=>(minimum==null||v>=minimum)&&(maximum==null||v<=maximum)))return false;
   }
   return true;
 }
 function profile(kb,e){
   const company=kb.companyFor(e);
   if(!company)return {...e,Semantic:{company:null,status:'No matching company in knowledge base',facts:[]}};
   const described=kb.describe(company);
   return {...e,Semantic:{company,status:'Company matched',facts:described.facts,types:described.types,companyName:kb.values(company,'ex:companyName')[0]||company,industry:kb.values(company,'ex:industry')[0]||null,employees:kb.values(company,'ex:employees')[0]??null,netProfitUSD:kb.values(company,'ex:netProfitUSD')[0]??null}};
 }
 function analyze(events,kb,rule={}){
   const config={className:rule.className||'',industry:rule.industry||'',minEmployees:rule.minEmployees===''?null:rule.minEmployees??null,maxEmployees:rule.maxEmployees===''?null:rule.maxEmployees??null,minProfitUSD:rule.minProfitUSD===''?null:rule.minProfitUSD??null,maxProfitUSD:rule.maxProfitUSD===''?null:rule.maxProfitUSD??null,priceThresholdPct:Number(rule.priceThresholdPct??0.05),newsWindowMinutes:Number(rule.newsWindowMinutes??30)};
   const enrich=events.map(e=>profile(kb,e));
   const selected=enrich.filter(e=>checkCompany(kb,e.Semantic.company,config));
   const skipped=enrich.filter(e=>!selected.includes(e));
   const output=[];const pricesByCompany=new Map(),latestNews=new Map();
   // Process the original timestamp order, not all prices in one pass.
   for(const e of [...selected].sort((a,b)=>time(a)-time(b))){
     if(e.Significance==='News Update'){
       latestNews.set(e.Semantic.company,e);
       continue;
     }
     if(e.Significance!=='Price Update'||!Number.isFinite(Number(e.LIST_PRICE)))continue;
     const company=e.Semantic.company,prior=pricesByCompany.get(company);
     pricesByCompany.set(company,e);
     if(!prior || !prior.LIST_PRICE)continue;
     const pct=100*(Number(e.LIST_PRICE)-Number(prior.LIST_PRICE))/Number(prior.LIST_PRICE);
     if(Math.abs(pct)<=config.priceThresholdPct)continue;
     const rising=pct>0,news=latestNews.get(company);
     const nearby=news&&time(news)<time(e)&&time(e)-time(news)<=config.newsWindowMinutes*60000;
     const causes=nearby?[prior,e,news]:[prior,e];
     const companyFacts=kb.companyFacts(company);
     output.push({
       Id:'scep-'+slug(company)+'-'+stable(e),
       Significance:nearby?(rising?'Semantic News and Price Rise':'Semantic News and Price Fall'):(rising?'Semantic Price Rise':'Semantic Price Fall'),
       TimeStamp:e.TimeStamp,SECURITY:e.SECURITY,LIST_PRICE:e.LIST_PRICE,PercentChange:Number(pct.toFixed(4)),
       CausalVector:causes.map(x=>x.Id),
       DAG:causes.map(x=>({from:x.Id,to:'scep-'+slug(company)+'-'+stable(e)})),
       PatternInstance:'SCEP Knowledge-Aware Price Pattern',
       MatchDescription:'Price rule + company classification + background knowledge'+(nearby?' + nearby news':''),
       Semantic:{...e.Semantic,rule:{...config},matchedFacts:companyFacts.map(t=>({subject:t[0],predicate:t[1],object:t[2]})),sourceEventIds:causes.map(x=>x.Id),knowledgeMatched:true}
     });
   }
   return {rule:config,selected,skipped,derived:output,all:[...selected,...output].sort((a,b)=>time(a)-time(b)),summary:{input:events.length,matched:selected.length,excluded:skipped.length,detected:output.length,unmapped:enrich.filter(e=>!e.Semantic.company).length}};
 }
 function sample(){
   // Illustrative data only: BHP profit/employee figures are invented.
   // BMW & Example Motors employee figures are ALSO illustrative.
   // The example demonstrates class inheritance, company metadata,
   // filtered streams, and semantic enrichment of newly created events.
   const triples=[
     ['ex:CarManufacturer','rdfs:subClassOf','ex:Manufacturer'],
     ['ex:MiningCompany','rdfs:subClassOf','ex:Company'],
     ['ex:Manufacturer','rdfs:subClassOf','ex:Company'],
     ['ex:BMW','rdf:type','ex:CarManufacturer'],
     ['ex:BMW','ex:companyName','BMW (illustrative profile)'],
     ['ex:BMW','ex:instrument','BMW.DE'],
     ['ex:BMW','ex:industry','Automotive'],
     ['ex:BMW','ex:employees',12000],
     ['ex:BMW','ex:netProfitUSD',1700000000],
     ['ex:BMW','ex:country','Germany'],
     ['ex:ExampleMotors','rdf:type','ex:CarManufacturer'],
     ['ex:ExampleMotors','ex:companyName','Example Motors (fictional)'],
     ['ex:ExampleMotors','ex:instrument','EXM'],
     ['ex:ExampleMotors','ex:industry','Automotive'],
     ['ex:ExampleMotors','ex:employees',7000],
     ['ex:ExampleMotors','ex:netProfitUSD',1200000000],
     ['ex:ExampleMotors','ex:country','Australia'],
     ['ex:BHP','rdf:type','ex:MiningCompany'],
     ['ex:BHP','ex:companyName','BHP (illustrative profile)'],
     ['ex:BHP','ex:instrument','BHP'],
     ['ex:BHP','ex:industry','Mining'],
     ['ex:BHP','ex:employees',30000],
     ['ex:BHP','ex:netProfitUSD',2500000000],
     ['ex:BHP','ex:country','Australia']
   ];
   const start=Date.UTC(2026,0,12,9);
   let index=0;
   function at(m){return new Date(start+m*60000);}
   function price(company,minute,value){return {Id:'sample-price-'+(++index),Significance:'Price Update',TimeStamp:at(minute),SECURITY:company,LIST_PRICE:value};}
   function news(company,minute,headline,pnac){return {Id:'sample-news-'+(++index),Significance:'News Update',TimeStamp:at(minute),RELATED_RICS:[company],PNAC:pnac,EVENT_TYPE:'HEADLINE',HEADLINE_ALERT_TEXT:headline};}
   const events=[
     price('EXM',0,40),news('EXM',3,'Fictional manufacturer announces new orders','EXM-1'),price('EXM',11,42.5),
     price('BMW.DE',0,90),news('BMW.DE',8,'Illustrative BMW manufacturing update','BMW-1'),price('BMW.DE',16,94),
     price('BHP',0,45),news('BHP',6,'Illustrative mining sector update','BHP-1'),price('BHP',19,48),
     price('EXM',35,42.5),news('EXM',36,'Fictional manufacturer reports delays','EXM-2'),price('EXM',43,40.8),
     price('UNMAPPED',0,10),price('UNMAPPED',12,11)
   ];
   return {triples,events};
 }
 global.SCEP={KnowledgeBase,checkCompany,profile,analyze,sample};
})(window);
