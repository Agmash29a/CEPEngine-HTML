/*
 * Price chart hover details. This is a UI helper, not part of the CEP engine.
 *
 * Receives the actual pixel positions used by drawChart() so tooltips describe
 * the event under the cursor rather than a guessed timestamp or price.
 * Events drawn at the same location are grouped; the marker can represent
 * more than one event (e.g., a price jump and its linked news event).
 */
(function(global) {
  'use strict';

  const LABELS = {
    'Price Update': 'Price update',
    'News Update': 'News message',
    'Price Jump': 'Price rise detected',
    'Price Fall': 'Price fall detected',
    'News Update Plus': 'News near price rise',
    'News Update Minus': 'News near price fall',
    'News Story': 'Completed news story',
    'News Story Plus': 'Story near price rise',
    'News Story Minus': 'Story near price fall'
  };
  const formatDate = value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit',
      minute: '2-digit', second: '2-digit'
    }) : 'Unknown time';
  };
  function addRow(parent, label, value) {
    if (value === undefined || value === null || value === '') return;
    const line = document.createElement('div');
    line.className = 'price-tooltip-row';
    const key = document.createElement('span');
    key.className = 'price-tooltip-key';
    key.textContent = label;
    const val = document.createElement('span');
    val.className = 'price-tooltip-value';
    val.textContent = String(value);
    line.append(key, val);
    parent.append(line);
  }
  class ChartHover {
    constructor(canvas, tooltip) {
      this.canvas = canvas;
      this.tooltip = tooltip;
      // The shimmer surface creates an isolated stacking context. Keep the
      // fixed-position tooltip at document level so sticky table headings
      // and panel overflow cannot cover or clip it.
      document.body.appendChild(tooltip);
      this.points = [];
      this.current = null;
      canvas.addEventListener('pointermove', e => this.move(e));
      canvas.addEventListener('pointerleave', () => this.hide());
      canvas.addEventListener('pointercancel', () => this.hide());
      window.addEventListener('scroll', () => this.hide(), {capture:true,passive:true});
      window.addEventListener('resize', () => this.hide());
      canvas.addEventListener('click', e => {
        const matches = this.find(e);
        if (!matches.length) return;
        const complex = matches.find(p => p.event.CausalVector?.length);
        if (complex && this.onSelect) this.onSelect(complex.event);
      });
    }
    setPoints(points) {
      this.points = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
      this.hide();
    }
    find(e) {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      // Coordinates are CSS pixels. The canvas rendering DPR is not used here.
      const x = (e.clientX - rect.left) * (this.canvas.clientWidth / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.clientHeight / rect.height);
      let best = null;
      let minDistance = Infinity;
      // Prioritise drawn event markers over the underlying price line.
      for (const p of this.points) {
        const dx = p.x - x, dy = p.y - y, dist = Math.hypot(dx, dy);
        const radius = p.kind === 'event' ? 13 : 9;
        if (dist <= radius && (dist < minDistance || (Math.abs(dist-minDistance)<0.1 && p.kind==='event'))) {
          minDistance = dist;
          best = p;
        }
      }
      if (!best) return [];
      // Multiple events can be rendered on the same plot coordinates.
      return this.points.filter(p => Math.hypot(p.x-best.x,p.y-best.y)<2)
        .sort((a,b) => (a.kind==='event'?0:1)-(b.kind==='event'?0:1));
    }
    move(e) {
      const matches = this.find(e);
      if (!matches.length) { this.hide(); return; }
      const key = matches.map(p=>p.event.Id).join('|');
      if (this.current !== key) {
        this.current = key;
        this.render(matches);
      }
      this.position(e);
    }
    render(matches) {
      const root = this.tooltip;
      root.replaceChildren();
      const first = matches[0].event;
      const header = document.createElement('div');
      header.className = 'price-tooltip-heading';
      header.textContent = matches.length === 1 ?
        (LABELS[first.Significance] || first.Significance) :
        matches.length + ' events at this point';
      root.append(header);
      addRow(root,'Time',formatDate(first.TimeStamp));
      const entries = matches.slice(0,6);
      for (const item of entries) {
        const e = item.event;
        const block = document.createElement('div');
        block.className = 'price-tooltip-entry';
        if (matches.length > 1) {
          const name = document.createElement('strong');
          name.textContent = LABELS[e.Significance] || e.Significance;
          block.append(name);
        }
        addRow(block,'Security',e.SECURITY || e.STOCK_RIC);
        addRow(block,'Story ID',e.PNAC);
        if (e.LIST_PRICE !== undefined) addRow(block,'Price',Number(e.LIST_PRICE).toFixed(3));
        if (e.NUM_TRADE !== undefined) addRow(block,'Trades',e.NUM_TRADE);
        if (e.TOTAL_VOLUME !== undefined) addRow(block,'Volume',e.TOTAL_VOLUME);
        if (e.HEADLINE_ALERT_TEXT) addRow(block,'Headline',e.HEADLINE_ALERT_TEXT);
        if (e.EVENT_TYPE) addRow(block,'Message type',String(e.EVENT_TYPE).replaceAll('_',' ').toLowerCase());
        if (e.MatchDescription) addRow(block,'Why detected',e.MatchDescription);
        if (e.CausalVector?.length) addRow(block,'Source records',e.CausalVector.length);
        root.append(block);
      }
      if(matches.length > 6) addRow(root,'Also here',matches.length - 6 + ' more events');
      if(matches.some(p=>p.event.CausalVector?.length)) {
        const hint=document.createElement('div');
        hint.className='price-tooltip-hint';
        hint.textContent='Click marker to show its PDAG and event hierarchy';
        root.append(hint);
      }
      root.hidden = false;
    }
    position(e) {
      const tooltip = this.tooltip;
      const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
      const edge = 8, gap = 16;
      // The box can grow taller than the chart. Position it relative to the
      // viewport rather than constraining it to the chart's 290px canvas.
      // Unlike a scrollable popup, the user can read the details while
      // keeping the pointer over the event marker.
      const roomRight = window.innerWidth - e.clientX;
      const left = roomRight >= w + gap + edge
        ? e.clientX + gap : e.clientX - w - gap;
      const top = e.clientY + gap + h <= window.innerHeight - edge
        ? e.clientY + gap : e.clientY - h - gap;
      tooltip.style.left = Math.round(Math.max(edge, Math.min(window.innerWidth-w-edge,left)))+'px';
      tooltip.style.top = Math.round(Math.max(edge, Math.min(window.innerHeight-h-edge,top)))+'px';
    }
    hide(){this.current=null;this.tooltip.hidden=true;this.canvas.style.cursor='default';}
  }
  global.ChartHover=ChartHover;
})(window);
