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
