/*
 * CEPEngine — JavaScript port of Agmash29a/CEPEngine.
 * Source concepts: Engine/Buffer.cs, Events.cs, NewsEvents.cs, NewsPatterns.cs,
 * Parser.cs, Engine.cs. Terminology and explanatory comments are retained.
 * No ASP.NET, SQL Server, or libraries are required.
 */
(function (global) {
  'use strict';
  const EVENT_TYPES = Object.freeze({ STORY_TAKE_OVERWRITE:'STORY_TAKE_OVERWRITE', ALERT:'ALERT', HEADLINE:'HEADLINE', STORY_TAKE_APPEND:'STORY_TAKE_APPEND', DELETE:'DELETE' });
  let serial = 0;
  const stamp = t => t instanceof Date ? t.getTime() : new Date(t).getTime();
  function makeEvent(Significance, TimeStamp, fields = {}) {
    return { Id: 'event-' + (++serial), Significance, TimeStamp: new Date(TimeStamp), ...fields };
  }
  class DAG {
    constructor() { this.edges = []; }
    AddEdge(from, to) { this.edges.push({ from: from.Id, to: to.Id }); }
  }
  class Pattern {
    constructor(name) { this.Name = name; this.Relativity = null; }
    Match(simpleEvent, buffer) { return null; }
    create(significance, timeStamp, causes, fields = {}) {
      const complexEvent = makeEvent(significance, timeStamp, fields);
      const dag = new DAG();
      // Relativity - This is the causal vector
      [...causes, complexEvent].forEach((e,i,a) => { if(i) dag.AddEdge(a[i-1],e); });
      this.Relativity = dag;
      complexEvent.PatternInstance = this.Name;
      complexEvent.CausalVector = causes.map(e=>e.Id);
      complexEvent.DAG = dag.edges;
      complexEvent.MatchDescription = `${this.Name}: ${causes.map(e=>e.Significance).join(' → ')} → ${significance}`;
      return complexEvent;
    }
  }
  class PriceChangedPositive extends Pattern {
    constructor(threshold=.0005) { super('PriceChangedPositive'); this.Threshold=threshold; this.LastPriceUpdate=null; }
    Match(simpleEvent) {
      // ---> STEP 1 - Check if the incoming event is of the right type
      if(simpleEvent.Significance!=='Price Update') return null;
      // ---> STEP 2 - Scan for matches, run through most recent queue entries
      // and find the most recent price update before the current one, then compare.
      const earlierPriceUpdate=this.LastPriceUpdate;
      if(earlierPriceUpdate && stamp(simpleEvent.TimeStamp)<=stamp(earlierPriceUpdate.TimeStamp)) return null;
      this.LastPriceUpdate=simpleEvent;
      if(!earlierPriceUpdate) return null;
      return (simpleEvent.LIST_PRICE-earlierPriceUpdate.LIST_PRICE) > this.Threshold*earlierPriceUpdate.LIST_PRICE
        ? this.create('Price Jump',simpleEvent.TimeStamp,[earlierPriceUpdate,simpleEvent],{PriceUpdate1:earlierPriceUpdate.Id,PriceUpdate2:simpleEvent.Id}) : null;
    }
  }
  class PriceChangedNegative extends Pattern {
    constructor(threshold=.0005) { super('PriceChangedNegative'); this.Threshold=threshold; this.LastPriceUpdate=null; }
    Match(simpleEvent) {
      // ---> STEP 1 - Check if the incoming event is of the right type
      if(simpleEvent.Significance!=='Price Update') return null;
      // ---> STEP 2 - Scan for matches, run through most recent queue entries
      // and find the most recent price update before the current one, then compare.
      const earlierPriceUpdate=this.LastPriceUpdate;
      if(earlierPriceUpdate && stamp(simpleEvent.TimeStamp)<=stamp(earlierPriceUpdate.TimeStamp)) return null;
      this.LastPriceUpdate=simpleEvent;
      if(!earlierPriceUpdate) return null;
      return (earlierPriceUpdate.LIST_PRICE-simpleEvent.LIST_PRICE) > this.Threshold*earlierPriceUpdate.LIST_PRICE
        ? this.create('Price Fall',simpleEvent.TimeStamp,[earlierPriceUpdate,simpleEvent],{PriceUpdate1:earlierPriceUpdate.Id,PriceUpdate2:simpleEvent.Id}) : null;
    }
  }
  class PriceChangedWithNewsUpdate extends Pattern {
    constructor(direction, thresholdMinutes=30) { super(direction==='plus'?'PriceChangedPositiveWithNewsUpdate':'PriceChangedNegativeWithNewsUpdate'); this.direction=direction; this.NewsUpdateThreshold=thresholdMinutes; }
    Match(simpleEvent, buffer) {
      // ---> STEP 1 - Check if the incoming event is of the right type
      if(simpleEvent.Significance!==(this.direction==='plus'?'Price Jump':'Price Fall')) return null;
      // ---> STEP 2 - Scan for matches, run through most recent queue entries
      // and find the most recent news update before the current price jump.
      // Copy Queue into a stack
      const earlierNewsUpdate=[...buffer.EventBuffer].reverse().find(e=>e.Significance==='News Update' && stamp(e.TimeStamp)<stamp(simpleEvent.TimeStamp));
      if(!earlierNewsUpdate) return null;
      if(stamp(simpleEvent.TimeStamp)-stamp(earlierNewsUpdate.TimeStamp)>this.NewsUpdateThreshold*60000) return null;
      return this.create(this.direction==='plus'?'News Update Plus':'News Update Minus',simpleEvent.TimeStamp,[earlierNewsUpdate,simpleEvent],{NewsUpdate:earlierNewsUpdate.Id,PriceChange:simpleEvent.Id});
    }
  }
  class BasicStory extends Pattern {
    constructor() { super('BasicStory'); this.PNACs = new Set(); }
    Match(simpleEvent, buffer) {
      // ---> STEP 1 - Check if the incoming event is of the right type
      if(simpleEvent.Significance!=='News Update') return null;
      // ---> STEP 2 - Scan for first matching PNAC
      // An analysis of news items from the German stock market shows that most stories end with a single OVERWRITE event.
      if(simpleEvent.EVENT_TYPE!==EVENT_TYPES.STORY_TAKE_OVERWRITE || this.PNACs.has(simpleEvent.PNAC)) return null;
      // Find first event with the same PNAC as the story with the OVERWRITE
      const earlierNewsUpdate=buffer.EventBuffer.find(e=>e.Significance==='News Update' && e.PNAC===simpleEvent.PNAC);
      if(!earlierNewsUpdate) return null;
      // If a news story has not already been generated for this PNAC then generate new event
      this.PNACs.add(simpleEvent.PNAC);
      return this.create('News Story',simpleEvent.TimeStamp,[earlierNewsUpdate,simpleEvent],{PNAC:simpleEvent.PNAC,StoryStartTimeStamp:earlierNewsUpdate.TimeStamp,StoryEndTimeStamp:simpleEvent.TimeStamp,NewsUpdate1:earlierNewsUpdate.Id,NewsUpdate2:simpleEvent.Id});
    }
  }
  class PriceChangedBasicStory extends Pattern {
    constructor(direction, threshold=.025) {super(direction==='plus'?'PriceChangedPositiveBasicStory':'PriceChangedNegativeBasicStory');this.direction=direction;this.Threshold=threshold;}
    Match(simpleEvent,buffer) {
      // ---> STEP 1 - Check if the incoming event is of the right type
      if(simpleEvent.Significance!=='News Story') return null;
      // ---> STEP 2 - select prices, last before the story started and last before the story ended
      const prices=buffer.EventBuffer.filter(e=>e.Significance==='Price Update').sort((a,b)=>stamp(a.TimeStamp)-stamp(b.TimeStamp));
      const earlierPriceUpdate=prices.filter(e=>stamp(e.TimeStamp)<stamp(simpleEvent.StoryStartTimeStamp)).at(-1);
      const laterPriceUpdate=prices.filter(e=>stamp(e.TimeStamp)>=stamp(simpleEvent.StoryStartTimeStamp)).at(-1);
      if(!earlierPriceUpdate || !laterPriceUpdate) return null;
      const p1=earlierPriceUpdate.LIST_PRICE,p2=laterPriceUpdate.LIST_PRICE;
      // Match original source's asymmetric negative threshold expression.
      const match=this.direction==='plus'?p2>=p1*(1+this.Threshold):p2<=p1-p2*this.Threshold;
      if(!match) return null;
      return this.create(this.direction==='plus'?'News Story Plus':'News Story Minus',laterPriceUpdate.TimeStamp,[earlierPriceUpdate,laterPriceUpdate,simpleEvent],{PNAC:simpleEvent.PNAC,NewsStory:simpleEvent.Id,PriceUpdate1:earlierPriceUpdate.Id,PriceUpdate2:laterPriceUpdate.Id});
    }
  }
  class Buffer {
    constructor(size=100000) {this.EventBuffer=[];this.BufferSize=size;this.ActivePatterns=[];}
    AddToEventBuffer(newEvent) {
      // Check matches before enqueueing this event, as in Buffer.cs.
      // Matches can themselves be fed to other pattern definitions.
      while(this.EventBuffer.length>=this.BufferSize)this.EventBuffer.shift();
      this.CheckMatches(newEvent);
      this.EventBuffer.push(newEvent);
    }
    CheckMatches(newEvent) {
      for(const p of this.ActivePatterns){const complexEvent=p.Match(newEvent,this);if(complexEvent)this.AddToEventBuffer(complexEvent);}
    }
    GetEvent(Id){return this.EventBuffer.find(e=>e.Id===Id);}
    get MinDate(){return new Date(Math.min(...this.EventBuffer.map(e=>stamp(e.TimeStamp))));}
    get MaxDate(){return new Date(Math.max(...this.EventBuffer.map(e=>stamp(e.TimeStamp))));}
  }
  class Engine {
    constructor(options={}){this.options={priceThreshold:.0005,storyThreshold:.025,newsWindow:30,bufferSize:100000,...options};this.Buffer=new Buffer(this.options.bufferSize);}
    Initialise(sourceEvents){
      // Add Complex event pattern definitions. The order follows Engine.Initialise.
      const o=this.options,b=this.Buffer;b.EventBuffer=[];
      b.ActivePatterns=[new PriceChangedWithNewsUpdate('plus',o.newsWindow),new PriceChangedPositive(o.priceThreshold),new PriceChangedWithNewsUpdate('minus',o.newsWindow),new PriceChangedNegative(o.priceThreshold),new BasicStory(),new PriceChangedBasicStory('plus',o.storyThreshold),new PriceChangedBasicStory('minus',o.storyThreshold)];
      const events=sourceEvents.map(e=>({...e,Id:e.Id||'event-'+(++serial),TimeStamp:new Date(e.TimeStamp)})).sort((a,b)=>stamp(a.TimeStamp)-stamp(b.TimeStamp));
      // Add Simple Event Feeds
      for(const e of events){if(!Number.isFinite(stamp(e.TimeStamp)))throw Error('Invalid timestamp in '+e.Significance);b.AddToEventBuffer(e);}
      return b.EventBuffer;
    }
    ShowAllEvents(){const counts={};for(const e of this.Buffer.EventBuffer)counts[e.Significance]=(counts[e.Significance]||0)+1;return counts;}
    GetEventsPerPriceUpdate(){
      const prices=this.Buffer.EventBuffer.filter(e=>e.Significance==='Price Update');
      return prices.map((p,i)=>{const from=stamp(p.TimeStamp),to=i+1<prices.length?stamp(prices[i+1].TimeStamp):Infinity;const counts={};for(const e of this.Buffer.EventBuffer){const t=stamp(e.TimeStamp);if(t>=from&&t<to)counts[e.Significance]=(counts[e.Significance]||0)+1;}return {TimeStamp:p.TimeStamp,LIST_PRICE:p.LIST_PRICE,...counts};});
    }
  }
  function parseCSV(text){
    // CSVReader replacement: supports quoted commas, double quotes and CRLF.
    const lines=[];let row=[],value='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))lines.push(row);row=[];value='';}else value+=c;}
    row.push(value);if(row.some(v=>v.trim()))lines.push(row);return lines;
  }
  function parseDate(value,time=''){
    const s=String(value||'').trim(),t=String(time||'').trim();
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(m){const d=Number(m[1]),mo=Number(m[2])-1,y=Number(m[3]),parts=t.split(':');return new Date(y,mo,d,Number(parts[0])||0,Number(parts[1])||0,Number(parts[2])||0);}
    return new Date(t?s+' '+t:s);
  }
  function parsePricesFile(csv){
    // Parser.ParsePricesFile: SECURITY, DATE_OF_TRADE, START_PERIOD, END_PERIOD,
    // NUM_TRADE, LIST_PRICE, AVERAGE_PRICE, TOTAL_VOLUME.
    return parseCSV(csv).slice(1).map((d,i)=>makeEvent('Price Update',parseDate(d[1],d[3]),{
      SECURITY:d[0],DATE_OF_TRADE:d[1],START_PERIOD:parseDate(d[1],d[2]),END_PERIOD:parseDate(d[1],d[3]),
      NUM_TRADE:Number(d[4]),LIST_PRICE:Number(d[5]),AVERAGE_PRICE:Number(d[6]),TOTAL_VOLUME:Number(d[7])
    })).filter(e=>Number.isFinite(stamp(e.TimeStamp))&&Number.isFinite(e.LIST_PRICE));
  }
  function parseNewsFile(csv){
    // Parser.ParseNewsFile: preserves PNAC, EVENT_TYPE, headline and related RICs.
    return parseCSV(csv).slice(1).map(d=>{
      const t=String(d[1]||'0:0:0').split(':');const dt=parseDate(d[5],`${t[0]||0}:${t[1]||0}:${(t[2]||'0').split('.')[0]}`);
      return makeEvent('News Update',dt,{UNIQUE_STORY_INDEX:d[2],EVENT_TYPE:d[3],PNAC:d[4],MSG_DATE:d[0],HEADLINE_ALERT_TEXT:d[7]||'',ACCUMULATED_STORY_TEXT:d[8]||'',TAKE_TEXT:d[9]||'',PRODUCTS:(d[10]||'').split(' '),TOPICS:(d[11]||'').split(' '),RELATED_RICS:(d[12]||'').split(' '),NAMED_ITEMS:(d[13]||'').split(' '),STORY_TYPE:d[15],ATTRIBUTION:d[17],LANGUAGE:d[18]});
    }).filter(e=>Number.isFinite(stamp(e.TimeStamp)));
  }
  function demoEvents(){
    // Demonstration records are synthetic, not extracted from the original database.
    const start=new Date(2026,0,12,9,0);const at=m=>new Date(start.getTime()+m*60000);
    const ps=[100,100.1,100.4,100.45,97.5,97.6,101,101.2,98.4,99.2,104,103.1];
    const prices=ps.map((p,i)=>makeEvent('Price Update',at(i*10),{SECURITY:'GER',LIST_PRICE:p,NUM_TRADE:10+i,AVERAGE_PRICE:p,TOTAL_VOLUME:1000+i*50}));
    const news=[{m:5,p:'PNAC-101',t:'HEADLINE',h:'Example: company announces product update'},{m:18,p:'PNAC-101',t:'STORY_TAKE_OVERWRITE',h:'Example: full product announcement'},{m:37,p:'PNAC-102',t:'ALERT',h:'Example: market announcement'},{m:52,p:'PNAC-102',t:'STORY_TAKE_OVERWRITE',h:'Example: market update finalised'},{m:87,p:'PNAC-103',t:'HEADLINE',h:'Example: trading statement'},{m:98,p:'PNAC-103',t:'STORY_TAKE_OVERWRITE',h:'Example: final trading statement'}].map(n=>makeEvent('News Update',at(n.m),{PNAC:n.p,EVENT_TYPE:n.t,HEADLINE_ALERT_TEXT:n.h,RELATED_RICS:['GER']}));
    return [...prices,...news];
  }
  global.CEP={Engine,Buffer,Pattern,DAG,EVENT_TYPES,parseCSV,parsePricesFile,parseNewsFile,demoEvents,makeEvent};
})(window);
