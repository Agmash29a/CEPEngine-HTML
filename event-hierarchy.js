/*
 * Interactive event hierarchy for CEPEngine.
 * No external libraries. Event links come from CausalVector in cep-engine.js.
 * A link means "used to detect", NOT that a news item caused a market move.
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const BASIC = new Set(['Price Update', 'News Update', 'Sentiment']);
  const PALETTE = {
    'Price Update': '#2563a6', 'News Update': '#bc811b', Sentiment: '#64748b',
    'Price Jump': '#137e63', 'Price Fall': '#c04b58',
    'News Update Plus': '#137e63', 'News Update Minus': '#c04b58',
    'News Story': '#754ab7', 'News Story Plus': '#754ab7', 'News Story Minus': '#754ab7'
  };
  const names = {
    'Price Update': 'Price recorded', 'News Update': 'News message received',
    'Price Jump': 'Price rose', 'Price Fall': 'Price fell',
    'News Update Plus': 'News near a price rise', 'News Update Minus': 'News near a price fall',
    'News Story': 'News story recognised', 'News Story Plus': 'Story near a price rise',
    'News Story Minus': 'Story near a price fall', 'Sentiment': 'News tone recorded'
  };
  function element(tag, attrs = {}, text) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function prettyDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : 'Unknown time';
  }
  function explanation(e, causes) {
    const typed = type => causes.filter(c => c.Significance === type);
    if (e.Significance === 'Price Jump' || e.Significance === 'Price Fall') {
      const prices = typed('Price Update');
      if (prices.length >= 2) {
        const start=Number(prices[0].LIST_PRICE), end=Number(prices[1].LIST_PRICE);
        return 'Price changed from '+start.toFixed(3)+' to '+end.toFixed(3)+' ('+((end-start)/start*100).toFixed(2)+'%). The programmed price-change rule identified this move.';
      }
    }
    if (e.Significance === 'News Story') return 'Two news messages share a story identifier, and the later message is marked as a story overwrite. The program treats that as one completed story.';
    if (e.Significance === 'News Update Plus' || e.Significance === 'News Update Minus') return 'A news message was received shortly before the price move. The time-based rule linked them; this does NOT establish that the news caused the move.';
    if (e.Significance === 'News Story Plus' || e.Significance === 'News Story Minus') return 'The price-change and story rules matched the source records shown here. This is an observed relationship, not evidence of causation.';
    if (e.Significance === 'Price Update') return 'A recorded market price. Value: '+(e.LIST_PRICE ?? 'not provided')+'.';
    if (e.Significance === 'News Update') return (e.HEADLINE_ALERT_TEXT || 'A news item was received.') + (e.PNAC?' Story ID: '+e.PNAC+'.':'');
    return 'This event was recorded or detected using the linked source records.';
  }
  class EventHierarchy {
    constructor(svg, details, status) {
      this.svg=svg;this.details=details;this.status=status;
      this.events=[];this.byId=new Map();this.selectedId=null;
      this.collapsed=new Set();this.zoom=1;this.panX=0;this.panY=0;this.drag=null;
      this.canvas=element('g');svg.append(this.canvas);
      this.svg.addEventListener('wheel',e=>{e.preventDefault();const b=this.svg.getBoundingClientRect();this.zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-b.left,e.clientY-b.top);},{passive:false});
      this.svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-event-id]'))return;this.drag={x:e.clientX,y:e.clientY,px:this.panX,py:this.panY};this.svg.setPointerCapture(e.pointerId);});
      this.svg.addEventListener('pointermove',e=>{if(!this.drag)return;this.panX=this.drag.px+e.clientX-this.drag.x;this.panY=this.drag.py+e.clientY-this.drag.y;this.transform();});
      const end=()=>{this.drag=null;};this.svg.addEventListener('pointerup',end);this.svg.addEventListener('pointercancel',end);
      this.svg.addEventListener('keydown',e=>{if(e.key==='Escape')this.fit();});
    }
    setEvents(events) {
      this.events=events||[];this.byId=new Map(this.events.map(e=>[e.Id,e]));
      this.collapsed.clear();
      this.select(this.events.find(e=>e.CausalVector?.length)?.Id || this.events[0]?.Id || null);
    }
    select(id) {
      if(!id || !this.byId.has(id)) {this.selectedId=null;this.canvas.replaceChildren();this.details.textContent='No matching event was found.';this.status.textContent='No event selected';return;}
      this.selectedId=id;this.render();this.fit();
    }
    dependencies(event) {
      return (event.CausalVector||[]).map(id=>this.byId.get(id)).filter(Boolean);
    }
    buildTree(id, ancestry=new Set(),depth=0) {
      const event=this.byId.get(id);
      if(!event) return null;
      const circular=ancestry.has(id);
      const next=new Set(ancestry);next.add(id);
      const children = (depth>=12 || circular || this.collapsed.has(id)) ? [] :
        this.dependencies(event).map(e=>this.buildTree(e.Id,next,depth+1)).filter(Boolean);
      return {event,children,circular,depth,collapsed:this.collapsed.has(id),x:0,y:0,width:0};
    }
    render() {
      const root=this.buildTree(this.selectedId);
      if(!root)return;
      // A nested tree is used for readability. Shared events may be drawn twice
      // when they contribute to more than one detected event; IDs remain stable.
      const NODE_W=220, NODE_H=70, H_GAP=28, V_GAP=100;
      let leaf=0, count=0;
      const place=node=>{
        node.children.forEach(place);
        node.y=node.depth*(NODE_H+V_GAP);
        node.x=node.children.length
          ? (node.children[0].x+node.children.at(-1).x)/2
          : leaf++*(NODE_W+H_GAP);
        count++;
      };
      place(root);
      // Put source observations at the top and the final detected event at bottom.
      const maxDepth=Math.max(0,...(function walk(n){return [n.depth,...n.children.flatMap(walk)];})(root));
      const reverse=node=>{node.y=(maxDepth-node.depth)*(NODE_H+V_GAP);node.children.forEach(reverse);};
      reverse(root);
      const nodes=[], links=[];
      const visit=node=>{
        nodes.push(node);
        for(const child of node.children){links.push({from:child,to:node});visit(child);}
      };
      visit(root);this.canvas.replaceChildren();
      this.canvas.append(element('rect',{x:-250,y:-250,width:Math.max(1000,leaf*(NODE_W+H_GAP)+500),height:(maxDepth+1)*(NODE_H+V_GAP)+500,fill:'transparent','pointer-events':'none'}));
      for(const {from,to} of links) {
        const startX=from.x+NODE_W/2,startY=from.y+NODE_H,endX=to.x+NODE_W/2,endY=to.y;
        const midY=(startY+endY)/2;
        this.canvas.append(element('path',{d:`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`,stroke:'#9daec5','stroke-width':2,fill:'none','marker-end':'url(#hierarchyArrow)'}));
      }
      for(const node of nodes) {
        const e=node.event, color=PALETTE[e.Significance]||'#52657d';
        const g=element('g',{transform:`translate(${node.x},${node.y})`,'data-event-id':e.Id,tabindex:'0',role:'button','aria-label':'View '+(names[e.Significance]||e.Significance)+' at '+prettyDate(e.TimeStamp)});
        g.append(element('rect',{width:NODE_W,height:NODE_H,rx:11,fill:'#ffffff',stroke:color,'stroke-width':node.depth===0?3:1.5}));
        g.append(element('rect',{width:6,height:NODE_H,rx:3,fill:color}));
        g.append(element('text',{x:18,y:24,fill:'#202f44','font-size':14,'font-weight':700},names[e.Significance]||e.Significance));
        g.append(element('text',{x:18,y:44,fill:'#64748b','font-size':11},prettyDate(e.TimeStamp)));
        const caption=e.PNAC||e.SECURITY||(e.LIST_PRICE!=null?String(e.LIST_PRICE):'');
        g.append(element('text',{x:18,y:60,fill:'#64748b','font-size':10},String(caption).slice(0,30)));
        const choose=()=>{this.showDetails(e);g.focus();};
        g.addEventListener('click',choose);
        g.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();choose();}});
        if(node.children.length||node.collapsed) {
          const toggle=element('g',{transform:`translate(${NODE_W-17},15)`,role:'button',tabindex:'0','aria-label':node.collapsed?'Expand sources':'Hide sources'});
          toggle.append(element('circle',{r:11,fill:'#ecf2f9',stroke:'#b9c6d6'}));
          toggle.append(element('text',{'text-anchor':'middle',y:4,fill:'#3f526d','font-size':16},node.collapsed?'+':'−'));
          const act=ev=>{ev.stopPropagation();if(this.collapsed.has(e.Id))this.collapsed.delete(e.Id);else this.collapsed.add(e.Id);this.render();this.fit();};
          toggle.addEventListener('click',act);toggle.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();act(ev);}});
          g.append(toggle);
        }
        this.canvas.append(g);
      }
      this.width=Math.max(NODE_W,(leaf-1)*(NODE_W+H_GAP)+NODE_W);
      this.height=(maxDepth+1)*(NODE_H+V_GAP)-V_GAP;
      this.status.textContent=count+' visible boxes · '+(this.dependencies(root.event).length)+' direct source records';
      this.showDetails(root.event);
      // Marker in a persistent defs node, outside the replaced canvas.
      if(!this.svg.querySelector('#hierarchyArrow')){
        const defs=element('defs'),marker=element('marker',{id:'hierarchyArrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});
        marker.append(element('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#9daec5'}));defs.append(marker);this.svg.prepend(defs);
      }
    }
    showDetails(event) {
      const causes=this.dependencies(event), title=names[event.Significance]||event.Significance;
      this.details.replaceChildren();
      const heading=document.createElement('h3');heading.textContent=title;this.details.append(heading);
      const time=document.createElement('p');time.textContent='Time: '+prettyDate(event.TimeStamp);this.details.append(time);
      const description=document.createElement('p');description.textContent=explanation(event,causes);this.details.append(description);
      if(causes.length){
        const intro=document.createElement('p');intro.textContent='The program used these records:';this.details.append(intro);
        const list=document.createElement('ol');
        for(const item of causes){const li=document.createElement('li');li.textContent=(names[item.Significance]||item.Significance)+' — '+prettyDate(item.TimeStamp);list.append(li);}
        this.details.append(list);
      }
      const note=document.createElement('p');note.className='muted';note.textContent='Connections show how a rule combined records. They do not establish that one real-world event caused another.';this.details.append(note);
    }
    transform(){this.canvas.setAttribute('transform',`translate(${this.panX},${this.panY}) scale(${this.zoom})`);}
    zoomAt(factor,x,y){const prev=this.zoom;this.zoom=Math.max(.2,Math.min(3,this.zoom*factor));const ratio=this.zoom/prev;this.panX=x-(x-this.panX)*ratio;this.panY=y-(y-this.panY)*ratio;this.transform();}
    zoomBy(factor){const bounds=this.svg.getBoundingClientRect();this.zoomAt(factor,bounds.width/2,bounds.height/2);}
    fit(){const b=this.svg.getBoundingClientRect();const w=b.width||800,h=b.height||460;this.zoom=Math.min(1.2,Math.max(.2,Math.min((w-65)/this.width,(h-60)/this.height)));this.panX=(w-this.width*this.zoom)/2;this.panY=(h-this.height*this.zoom)/2;this.transform();}
    downloadSVG(){
      const clone=this.svg.cloneNode(true);
      clone.setAttribute('xmlns',NS);clone.setAttribute('width',String(Math.ceil(this.width+80)));clone.setAttribute('height',String(Math.ceil(this.height+80)));
      const canvas=clone.querySelector('g');canvas.setAttribute('transform','translate(40,40)');
      const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cep-event-hierarchy.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  global.EventHierarchy=EventHierarchy;
})(window);
