# CEPEngine — HTML / JavaScript edition

A zero-dependency browser implementation based on https://github.com/Agmash29a/CEPEngine (original `master` branch).

## Run
Open `index.html` directly in a modern browser. No npm, ASP.NET, database or web server is necessary.

## Files
- `index.html`: interface and data controls.
- `cep-engine.js`: standalone CEP engine, original event model terminology, original seven pattern definitions, event buffer, causal DAG, CSV readers.
- `app.js`: UI, chart, event-table, JSON export.
- `style.css`: visual style.

## Importing original data
The repository contains the ASP.NET project and SQL data-access code, **not the historical price/news database or CSV extracts**. Export the data from the original environment to CSV, then use the two file selectors.

Expected price CSV columns (as per `Parser.ParsePricesFile`): `SECURITY,DATE_OF_TRADE,START_PERIOD,END_PERIOD,NUM_TRADE,LIST_PRICE,AVERAGE_PRICE,TOTAL_VOLUME`.

Expected news CSV has at least 19 columns in the positional order of the original `Parser.ParseNewsFile`, including `[1]` message time, `[2]` story index, `[3]` EVENT_TYPE, `[4]` PNAC, `[5]` date, `[7]` headline, `[8]` accumulated text, `[9]` take text, `[10..13]` product/topic/RIC/named-item strings. Supports quoted CSV values.

Dates are parsed as day/month/year for slash-formatted values, which is appropriate for the original C# implementation under Australian locale settings; ISO timestamps are also supported where possible.

The included demo data is **synthetic**; it is not asserted to be original stock-market data.

## Porting notes
Patterns retained: `PriceChangedPositive`, `PriceChangedNegative`, `PriceChangedPositiveWithNewsUpdate`, `PriceChangedNegativeWithNewsUpdate`, `BasicStory`, `PriceChangedPositiveBasicStory`, `PriceChangedNegativeBasicStory`.

Events retained: `Price Update`, `News Update`, `Price Jump`, `Price Fall`, `News Update Plus`, `News Update Minus`, `News Story`, `News Story Plus`, `News Story Minus`.

Pattern evaluation is performed before enqueuing the incoming event, including recursive evaluation of newly detected complex events, matching the original `Buffer.CheckMatches` / `AddToEventBuffer` behaviour. The original negative-story threshold expression was kept rather than silently changed to a symmetric one.

The original system also contains SQL Server DAL, ASP.NET sessions, ontology XML, overlay and charting code. These server integrations are **not** part of this browser-only port. A full fidelity regression comparison against production SQL records requires those exports.

## Research laboratory

Open `index.html` and use the Research laboratory at the top of the main panel:

- **Run regression suite**: exercises thresholds, news/price correlation, story completion, PNAC isolation, buffer limits, pattern reset, DAG construction and quoted CSV parsing.
- **Benchmark**: measures median elapsed time for 100, 1,000 and 5,000 synthetic price events (three repetitions) using `performance.now()`.
- **Export research report**: saves a JSON record with test results, benchmarks, generation time and browser user-agent.
- `research-tests.js` can also be invoked from the browser console: `CEPResearch.runRegression()`, `CEPResearch.benchmark()`, `CEPResearch.compareExpected(events, expectedCounts)`.

These are newly constructed regression tests; they are **not** derived from the private Academia Co-scientist account. Original experimental datasets, hypotheses, and expected results need to be imported before claims of research replication can be made.

## Research-informed interface (plain-English guide)

The uploaded research archive was examined, including event-inference-validity, event-sensitivity, event-hierarchy and StockNet restricted-timing-null reports. The interface now provides **Compare detection methods**, **Check whether message order matters**, and **Try different price thresholds**. They are implemented in a separate `research-insights.js` file, leaving `cep-engine.js` as the original-rule port.

The alternative approach groups news by company and PNAC (story identifier), counts a price rise greater than a chosen **absolute number of points** across adjacent price observations, and identifies when a story fits inside the price-observation interval. It reports **single-message** stories distinctly. For research reproducibility, these choices must not be confused with the original C# rules, which use a percentage threshold and an overwrite-based story completion.

### Everyday-language glossary

| Research term | On-screen meaning |
| --- | --- |
| Complex event | An event detected by combining other observations |
| CEP | Rules that search a stream of events for patterns |
| PNAC | The identifier that links messages belonging to a story |
| Causal vector / DAG | A list of records and links showing **how the program derived** a result; not evidence of economic causation |
| Threshold | How large a price move must be to count |
| Sensitivity analysis | What changes when you vary the rules |
| Order invariance | Whether a result changes when records are supplied in a different order |
| Matched null | A comparison that holds relevant background factors more similar; avoids mistaking ordinary market patterns for a special signal |
| Statistical significance | Strength of evidence against a specified comparison model; not proof of causation |

### Important research qualifications

The StockNet earnings-anchor matched comparisons showed that several apparent associations became much weaker after controlling for market volatility, data coverage, and weekday. This interface **does not claim** to reproduce those controls or their reported p-values. In the future, reproducing that experiment requires the proper session calendars, earnings anchors, matched sampling protocol and data provenance. Also, repeated message order and timestamp ties can affect results even where aggregate totals appear unchanged. A matched event is an **association under a chosen rule**, not an actionable stock forecast.

## Interactive event hierarchy

Use **How was this event detected?** below the events table, or click any event in the table. The diagram reads the original `CausalVector` event IDs from `cep-engine.js` and recursively follows those links to the input prices and news messages.

- Select an event from the dropdown or table.
- Click a box to see a plain-English description, time, and direct source records.
- Use **+**, **−**, mouse wheel, **Fit to view**, or drag the empty diagram background.
- Hide/show a branch using the small +/− circle on its box.
- **Save diagram** exports a self-contained SVG figure suitable for inserting in reports.

`event-hierarchy.js` is dependency-free. It does not change pattern-detection results. Shared source records may be shown in multiple branches to keep each detected event readable. The diagram represents how the software produced a match — it **does not** prove that news caused a price move. The research-based matching alternatives remain separate from the original engine hierarchy.

## SCEP — semantic knowledge-aware event detection (thesis, Chapter 6)

This addition is motivated by Riley T Perry, *Combining a complex event style model with analysis to find unique patterns in data*, UNSW PhD thesis (2018), especially Chapter 6 §§6.1–6.2.2 and §6.2.6.

**SCEP** means **Semantic Complex Event Processing**. This mode runs beside the original CEP program; it **does not** replace or silently change the original price and news patterns.

Files:
- `scep-engine.js` — dependency-free knowledge-base triples, `rdf:type` and transitive `rdfs:subClassOf` checking, company enrichment, and semantic-aware event matching.
- `scep-ui.js` — filters, explanations, JSON import/export, knowledge inspection.
- `examples/scep-company-knowledge.json` — synthetic company facts (including a subclass hierarchy).
- `examples/scep-market-events.json` — synthetic price and news observations.
- `examples/scep-guide.md` — worked examples and limitations.

### What can the new mode do?

1. Understand that a **car manufacturer** is also a **manufacturer** and **company**, through the supplied company-type hierarchy.
2. Link instrument codes to known company profiles.
3. Filter data by company type, industry, employee count and net profit in USD.
4. Identify sufficiently large price changes and nearby preceding news, with company knowledge attached.
5. Explain each matched event using the original event IDs and the relevant company facts.
6. Change the rules and run the same data again to compare outcomes.

The SCEP mode reads **JSON files directly**. Use its file inputs to load company facts and event records. Original CEP still uses its independent CSV inputs. The demonstration is purely illustrative: **employee counts, company profit, historical times, prices and headlines are deliberately invented**, even when familiar company names are used.

### What is NOT yet implemented?

This is a useful subset, **not** a fully standards-compliant RDF/RDFS/OWL engine. It does not run arbitrary SPARQL, import complete FIBO ontologies, automatically generate a visualisation ontology, perform supervised machine learning, run multiple buffers in parallel, or reproduce the thesis's financial experiments. Semantic relationships are currently configured through simple, explicit facts; ontology and knowledge-base relationships are not complete reasoning systems.

### Browser usage

Open `index.html`; scroll to **Understand events using company information (SCEP)**. Start with **Load demonstration**, then select **CarManufacturer** in **Kind of company**. Change **At most this many employees** to 10000 to exclude the larger example automaker. Try **Minimum net profit** = 2 to retain only illustrative companies with profit at least two billion USD, or use the **Save example data** button.

## Price chart hover details

In **Prices and detected events**, hover over a price observation (the blue line) or a coloured event marker. The tooltip shows the timestamp, event type, price/security where available, news headline or story identifier, and the rule that detected a complex event. Multiple events at the exact same plot location are listed together. Clicking a complex-event marker opens its existing event hierarchy. The tooltip disappears when you leave the chart.

The feature is implemented in the independent `chart-hover.js` UI helper; no changes have been made to pattern matching. Test data can be imported via the two CSV selectors.

## Navigating large price and news files

The **Prices and detected events** chart now supports interactive time-range navigation. CEP matching is performed on the full imported dataset; changing the view **only changes the chart**.

- **Mouse wheel over the chart**: zoom in or out, centred around the pointer.
- **Click and drag horizontally**: select a time window to zoom into.
- **+ Zoom in / − Zoom out**: zoom around the current window's midpoint.
- **← Earlier / Later →**: move horizontally through the timeline.
- **Show all** or **double-click**: reset to the full period.
- Hover markers to inspect events; click detected-event markers to view their event hierarchy.

The chart displays the number of records in the visible window and the time range. The rendering path uses binary search to locate visible records and a min/max envelope for dense price lines, so spikes remain visible when many observations fall within one horizontal pixel. Its event-marker lookup no longer scans the full price array for each event.

**Limitations:** The event table and CEP engine still process the complete dataset. The chart does not yet provide separate tracks for each security or virtual scrolling of the event table. Very large datasets may still take time to process before zooming is available.

## Look Ahead (2019 thesis §7.3, Figure 7.1)

An experimental **Look Ahead** panel appears directly under **Prices and detected events**.

The March 2019 thesis introduces *Look Ahead with two predictions* as potential **future work**. It shows a historical price trace, a **Current Time** boundary, and two possible future trajectories, but does **not** provide a specific trained ML model or objective performance result. This web implementation therefore uses explicit, reproducible **historical analogues**, rather than claiming to reproduce a model trained in the thesis.

### Behaviour

1. Import a Price CSV and News CSV; run the existing CEP engine.
2. Drag **Historical cut-off** to choose the point in history at which predictions are made.
3. Specify the number of price records to look back, future records to predict, and historical analogues used per scenario.
4. The algorithm compares recent percentage changes and the count/types of nearby **observed** higher-level CEP events with earlier windows for the **same security**. A historical candidate is eligible **only when its entire subsequent outcome predates the cut-off**.
5. Alternative **A** uses similar historical outcomes ending non-negative; **B** uses those ending negative. Each is a similarity-weighted average of its candidate paths. A path is omitted when there is insufficient historical evidence.
6. Optionally display **later actual prices** for an out-of-sample retrospective comparison. The code never uses these later observations when selecting the historical neighbours.
7. Export the scenarios, cut-off, matched historical source IDs and evaluation statistics as JSON.

These are **illustrative conditional scenarios, not calibrated probabilities**. In particular the degree of visual similarity is **not** a probability of a future move. The later-actual MAE is an exploratory single-window comparison, not demonstrated model accuracy or market forecasting performance.

### Testing data

A separate downloadable **CEPEngine-LookAhead-Test-Data.zip** contains four overlapping paired CSV samples comprising 2–4 complete fictional trading days, with one-minute prices, repeated alternating price movement patterns, three-message completed news stories with shared PNACs, and unfinished news messages. The full four-day pair contains **1,560 prices, 232 news messages, and 72 completed story sequences**. This is carefully designed **synthetic** research test data, not actual financial history.

Existing original CEP rules and SCEP rules remain unchanged.

## Selected-event PDAG and table placement

**Detected events** now appears immediately below **Prices and detected events**. Select any event row to draw its **Pattern Directed Acyclic Graph (PDAG)** within the same panel. The PDAG shows each ancestor event **once**, even when shared by multiple complex patterns, and connects original price/news inputs through intermediate pattern matches to the chosen result. Nodes are clickable for event-level pattern and source information. Chart marker clicks also select the corresponding event and scroll to this panel; the existing interactive hierarchy visualization remains available lower on the page.

Edges are the event IDs recorded by `CausalVector` in the CEP engine; this represents rule provenance and should not be interpreted as evidence that a news story caused a market price move.

## Automatic CSV loading at startup

On opening `index.html`, CEPEngine-HTML requests `./prices.csv` and `./news.csv` from the **same folder as index.html** using browser `fetch` requests. Both files are parsed using the normal price and news CSV parsers; the CEP engine is then run and all visualisations are updated. The on-page status message shows the number of imported records. This is a **read-only** operation on the files, and no server-side code is needed.

Put both files in the deployed site's root alongside `index.html` (names are case-sensitive on some servers). If either file is missing, blocked or invalid, the browser continues with the synthetic demonstration and shows an explanation; manual uploads and the **Load demonstration** button remain available. Manual file selection while the initial downloads are in flight takes priority over the auto-loader.

**Local development:** A plain `file://` opening may block `fetch` due to browser security. Run a local HTTP server in the repository folder, e.g. `python -m http.server 8000`, and open `http://localhost:8000/`. On GitHub Pages, `./prices.csv` and `./news.csv` resolve relative to the deployed app folder. Commit/deploy the CSVs separately if you want them available on the live site; this change does not add data files.

## Collapsible Research section

The three tools **Check the results**, **What does the research say?**, and **Pattern Directed Acyclic Graph (PDAG)** now live within a single **Research** panel, placed below the Look Ahead panel. It uses the browser's native `<details>`/`<summary>` disclosure control and is **collapsed by default**. Select the Research heading to expand it. The original detected-events table remains immediately below the price timeline and outside the collapsible panel. Selecting an event still updates the PDAG while the panel is closed; open Research to inspect the graph.

## Research panel at the bottom; SCEP and import shimmer

The **Research** panel is now the final section of the app, after the standalone **How was this event detected?** hierarchy. It remains collapsed on first load, and groups **Check the results**, **What does the research say?**, **Pattern Directed Acyclic Graph (PDAG)** and **Understand events using company information (SCEP)**. The original SCEP controls, company facts and semantic hierarchy are unchanged.

A brief blue-white sweep animates the graph surface after a successful price/news CSV import (either automatically from the site root or via file selection) and after SCEP knowledge/events JSON imports. If Research is closed during an import, the shimmer is queued and plays once when Research is opened. Animation is disabled when the user's device requests reduced motion. Imported data and CEP/SCEP detection rules are not modified by the effect.

## Event details directly below the Detected events list

Selecting a row in **Detected events** now updates three visible sections within that same panel: **Selected event details** (all available original event attributes, including headline and pricing fields), **Pattern Directed Acyclic Graph (PDAG)** (unique source and intermediate events), and **How was this event detected?** (the existing interactive hierarchy and rule explanation). Click or use keyboard Enter/Space on an event row. The selected row is highlighted and the page scrolls to the details. A chart marker also selects and reveals these details.

These event inspection views are **not** inside Research, which continues to contain separate software checks, alternative analysis and SCEP. The PDAG shimmer is immediate on CSV import now that its graph is always visible; SCEP's shimmer remains deferred until Research is expanded.

## Selected event details presentation

The event inspector directly below **Detected events** now presents a clear event-type header, event timestamp, security/story badge, and any applicable price metrics. News headlines, message metadata, story content and CEP pattern provenance are grouped into separate sections, with an **All event attributes · raw record** disclosure for every underlying value. Source and complex events use the same inspector, but only fields present on the selected event are shown. The layout is responsive and all imported strings are added as text, not HTML.

## Collapsible control sidebar

The left-hand Event stream/control sidebar is collapsed by default on every page load, leaving a narrow 52-pixel control rail on desktop and a compact Controls button on narrower screens. Press the Controls button to expand or collapse the existing CSV upload, thresholds, filters and export controls. The toggle uses `aria-expanded` and removes hidden controls from keyboard focus; chart resize handling is invoked after changing layout. The side panel's state is intentionally not persisted, so it starts collapsed again on each page entry.
