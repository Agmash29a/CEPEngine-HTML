/*
 * Pattern Directed Acyclic Graph (PDAG) for the selected CEP event.
 * Unlike the hierarchy tree, a shared ancestor is drawn only once.
 * Edges follow CausalVector's recorded parent IDs, not inferred causation.
 */
(function(global){'use strict';
 const NS='http://www.w3.org/2000/svg';
 const colours={'Price Update':'#2364a6','News Update':'#be861b','Price Jump':'#168665','Price Fall':'#c45361','News Story':'#7650b2','News Update Plus':'#168665','News Update Minus':'#c45361','News Story Plus':'#7650b2','News Story Minus':'#7650b2'};
 const elem=(tag,attr={},value)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attr))n.setAttribute(k,String(v));if(value!=null)n.textContent=value;return n;};
 class EventPDAG{
  constructor(svg,details,status){this.svg=svg;this.details=details;this.status=status;this.events=new Map();this.selectedId=null;}
  setEvents(events){this.events=new Map((events||[]).map(e=>[String(e.Id),e]));if(this.selectedId&&this.events.has(this.selectedId))this.select(this.selectedId);else this.select(null);}
  select(id){
   const event=this.events.get(String(id));
   this.selectedId=event?String(event.Id):null;
   this.svg.replaceChildren();
   if(!event){this.status.textContent='Select an event in the table to inspect its PDAG';this.details.textContent='The PDAG shows the original source observations, intermediate pattern matches and the selected event.';return;}
   const nodes=new Map(),edges=new Map();
   const visit=(e,stack=new Set())=>{
    const id=String(e.Id);
    if(nodes.has(id)||stack.has(id))return;
    nodes.set(id,e);
    const next=new Set(stack);next.add(id);
    for(const parentId of (e.CausalVector||[])){
     const parent=this.events.get(String(parentId));
     if(!parent)continue;
     edges.set(String(parent.Id)+'|'+id,{from:String(parent.Id),to:id});
     visit(parent,next);
    }
   };
   visit(event);
   // The longest path to the selected event defines each node's layer.
   const depths=new Map(),depth=(id,seen=new Set())=>{
    if(depths.has(id))return depths.get(id);
    if(seen.has(id))return 0;
    const e=nodes.get(id),next=new Set(seen);next.add(id);
    const parents=(e.CausalVector||[]).filter(p=>nodes.has(String(p)));
    const value=parents.length?Math.max(...parents.map(p=>depth(String(p),next)))+1:0;
    depths.set(id,value);return value;
   };
   for(const id of nodes.keys())depth(id);
   const layers=new Map();
   for(const [id,level] of depths){if(!layers.has(level))layers.set(level,[]);layers.get(level).push(id);}
   const nodeWidth=208,nodeHeight=64,hGap=34,vGap=94;
   const maxLayer=Math.max(0,...layers.keys());
   const columns=Math.max(1,...[...layers.values()].map(a=>a.length));
   const width=columns*(nodeWidth+hGap)+70,height=(maxLayer+1)*(nodeHeight+vGap)+65;
   this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
   this.svg.setAttribute('preserveAspectRatio','xMidYMid meet');
   const positions=new Map();
   for(const [level,ids] of [...layers].sort((a,b)=>a[0]-b[0])){
    ids.sort((a,b)=>Number(new Date(nodes.get(a).TimeStamp))-Number(new Date(nodes.get(b).TimeStamp))||a.localeCompare(b));
    const offset=(width-ids.length*(nodeWidth+hGap)+hGap)/2;
    ids.forEach((id,i)=>positions.set(id,{x:offset+i*(nodeWidth+hGap),y:24+level*(nodeHeight+vGap)}));
   }
   const defs=elem('defs'),arrow=elem('marker',{id:'pdag-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto'});
   arrow.append(elem('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#9cadbf'}));defs.append(arrow);this.svg.append(defs);
   for(const {from,to} of edges.values()){
    const a=positions.get(from),b=positions.get(to);
    if(!a||!b)continue;
    const x1=a.x+nodeWidth/2,y1=a.y+nodeHeight,x2=b.x+nodeWidth/2,y2=b.y,m=(y1+y2)/2;
    this.svg.append(elem('path',{d:`M ${x1} ${y1} C ${x1} ${m}, ${x2} ${m}, ${x2} ${y2}`,stroke:'#9cadbf','stroke-width':2,fill:'none','marker-end':'url(#pdag-arrow)'}));
   }
   for(const [id,e] of nodes){
    const p=positions.get(id),colour=colours[e.Significance]||'#59677b';
    const group=elem('g',{transform:`translate(${p.x} ${p.y})`,tabindex:0,role:'button','aria-label':'Inspect '+e.Significance});
    group.append(elem('rect',{width:nodeWidth,height:nodeHeight,rx:8,fill:'#fff',stroke:colour,'stroke-width':id===this.selectedId?3:1.7}));
    group.append(elem('rect',{width:5,height:nodeHeight,rx:2,fill:colour}));
    group.append(elem('text',{x:13,y:21,fill:'#213149','font-size':13,'font-weight':700},String(e.Significance).slice(0,27)));
    const time=new Date(e.TimeStamp);
    group.append(elem('text',{x:13,y:39,fill:'#62718a','font-size':10},Number.isFinite(+time)?time.toLocaleString():'Unknown time'));
    group.append(elem('text',{x:13,y:56,fill:'#62718a','font-size':10},String(e.SECURITY||e.PNAC||(e.LIST_PRICE!=null?'Price '+e.LIST_PRICE:'')).slice(0,33)));
    group.addEventListener('click',()=>this.describe(e));group.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();this.describe(e);}});
    this.svg.append(group);
   }
   this.status.textContent=nodes.size+' unique event nodes · '+edges.size+' source-to-result links · '+(maxLayer+1)+' layers';
   this.describe(event);
  }
  describe(e){
    const parents=(e.CausalVector||[]).map(id=>this.events.get(String(id))).filter(Boolean);
    this.details.replaceChildren();
    const title=document.createElement('strong');title.textContent=e.Significance+' · '+e.Id;this.details.append(title);
    const p=document.createElement('p');p.textContent='Pattern: '+(e.PatternInstance||'Original observation')+' · Time: '+new Date(e.TimeStamp).toLocaleString();this.details.append(p);
    if(e.MatchDescription){const explanation=document.createElement('p');explanation.textContent=e.MatchDescription;this.details.append(explanation);}
    const source=document.createElement('p');source.textContent=parents.length?'Direct parent events: '+parents.map(item=>item.Significance+' ('+item.Id+')').join(', '):'This is an original source event with no recorded parents.';this.details.append(source);
  }
 }
 global.EventPDAG=EventPDAG;
})(window);