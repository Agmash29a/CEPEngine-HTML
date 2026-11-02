/*
 * Research test harness for CEPEngine.
 * Runs deterministic regression fixtures, evaluates expected complex events,
 * and compares throughput against input sizes. No dependencies.
 *
 * These fixtures are constructed from the published C# matching rules.
 * They are NOT the user's private Academia Co-scientist experiment results.
 */
(function(global){'use strict';
const at=(m)=>new Date(Date.UTC(2026,0,1,0,m));
function price(m,v){return CEP.makeEvent('Price Update',at(m),{SECURITY:'TEST',LIST_PRICE:v});}
function news(m,p,type='HEADLINE'){return CEP.makeEvent('News Update',at(m),{PNAC:p,EVENT_TYPE:type,HEADLINE_ALERT_TEXT:'Test '+p});}
function analyze(input,options={}){const engine=new CEP.Engine(options);const events=engine.Initialise(input);return {engine,events,counts:engine.ShowAllEvents()};}
const tests=[
{name:'Positive price threshold: strict greater-than',input:()=>[price(0,100),price(1,100.05)],options:{priceThreshold:.0005},expected:{'Price Jump':0}},
{name:'Positive price jump above threshold',input:()=>[price(0,100),price(1,101)],expected:{'Price Jump':1,'Price Fall':0}},
{name:'Negative price fall below threshold',input:()=>[price(0,100),price(1,98)],expected:{'Price Fall':1,'Price Jump':0}},
{name:'News update correlates with price jump inside 30 minutes',input:()=>[price(0,100),news(5,'A'),price(10,102)],expected:{'News Update Plus':1}},
{name:'Expired news update does not correlate',input:()=>[news(0,'A'),price(35,100),price(40,102)],expected:{'News Update Plus':0}},
{name:'News update correlates with price fall',input:()=>[price(0,100),news(5,'B'),price(10,98)],expected:{'News Update Minus':1}},
{name:'Overwrite completes a news story',input:()=>[news(0,'C'),news(3,'C','STORY_TAKE_OVERWRITE')],expected:{'News Story':1}},
{name:'Different PNACs do not form a story',input:()=>[news(0,'A'),news(3,'B','STORY_TAKE_OVERWRITE')],expected:{'News Story':0}},
{name:'Duplicate overwrite produces one story per PNAC',input:()=>[news(0,'A'),news(3,'A','STORY_TAKE_OVERWRITE'),news(4,'A','STORY_TAKE_OVERWRITE')],expected:{'News Story':1}},
{name:'Price jump emits causal DAG',input:()=>[price(0,100),price(1,102)],expected:{'Price Jump':1},check:({events})=>{const e=events.find(e=>e.Significance==='Price Jump');return e.DAG.length===2&&e.CausalVector.length===2;}},
{name:'Reset does not leak pattern state between runs',input:()=>[price(0,100),price(1,101)],expected:{'Price Jump':1},check:()=>{const engine=new CEP.Engine();const first=engine.Initialise([price(0,100),price(1,102)]);const second=engine.Initialise([price(0,100)]);return first.length===3&&second.length===1;}},
{name:'CSV quoted values and embedded delimiters',input:()=>[],expected:{},check:()=>CEP.parseCSV('a,b\n"hello, world","he said ""yes"""').at(-1).join('|')==='hello, world|he said "yes"'},
{name:'Buffer maximum bounds retained events',input:()=>[price(0,100),price(1,101),price(2,102)],options:{bufferSize:2},expected:{},check:({events})=>events.length<=2}
];
function runRegression(){return tests.map(test=>{let passed=false,error='',actual={};try{const outcome=analyze(test.input(),test.options);actual=outcome.counts;passed=Object.entries(test.expected).every(([type,n])=>(actual[type]||0)===n)&&(!test.check||test.check(outcome));}catch(e){error=String(e);}return {name:test.name,passed,error,expected:test.expected,actual};});}
function benchmark({sizes=[100,1000,5000],repeats=3}={}){
  return sizes.map(size=>{const samples=[];let count=0;for(let r=0;r<repeats;r++){const input=Array.from({length:size},(_,i)=>price(i,i%2?100.4:100));const begin=performance.now();const {events}=analyze(input);samples.push(performance.now()-begin);count=events.length;}samples.sort((a,b)=>a-b);const medianMilliseconds=samples[Math.floor(samples.length/2)];return {inputEvents:size,outputEvents:count,medianMilliseconds:Number(medianMilliseconds.toFixed(2)),eventsPerSecond:medianMilliseconds>0?Math.round(size*1000/medianMilliseconds):null};});
}
function compareExpected(input,expected,options={}){
  const outcome=analyze(input,options);const expectedCounts=expected||{};const keys=new Set([...Object.keys(expectedCounts),...Object.keys(outcome.counts)]);return [...keys].map(type=>({type,expected:expectedCounts[type]||0,actual:outcome.counts[type]||0,difference:(outcome.counts[type]||0)-(expectedCounts[type]||0)}));
}
global.CEPResearch={tests,runRegression,benchmark,compareExpected};
})(window);
