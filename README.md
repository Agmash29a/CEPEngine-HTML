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
