# SCEP worked examples (synthetic)

These files demonstrate the **SCEP additions** in Chapter 6 of Riley T Perry's UNSW thesis. All price observations, timestamps, employee counts, net profit figures and headlines in this example are **invented**. They are **not real company financial records**.

## Plain-English glossary

- **CEP**: detecting combinations of events, for example a news message followed by a price rise.
- **SCEP**: doing the same thing while also using background knowledge about companies.
- **Ontology**: a catalogue of types of things and how they are related.
- **Knowledge base**: the known facts (for this example, a list of three-part statements).
- **Triple**: a statement such as `ex:ExampleMotors rdf:type ex:CarManufacturer`.
- **Subclass**: a type belongs to a broader type. Here a `CarManufacturer` is also a `Manufacturer`, and a `Company`.
- **Derived event**: a new result produced by applying a rule to source observations.

## Try these settings

1. **All company types**, minimum profit $1 billion: EXM, BMW.DE, and BHP qualify; UNMAPPED is excluded.
2. **CarManufacturer**, minimum profit $1 billion: EXM and BMW.DE qualify, while BHP is excluded.
3. **CarManufacturer**, maximum employees 10,000: only EXM qualifies because the invented sample sets EXM employees to 7,000 and BMW to 12,000.
4. **MiningCompany**, minimum net profit $2 billion: the illustrative BHP facts qualify.
5. Raise **Minimum price change (%)** to 5: fewer price movements should qualify. Reduce it to 0.05 to see more.

## Schema

`scep-company-knowledge.json` is an array of `[subject, predicate, object]` facts. Supported predicates are `rdf:type`, `rdfs:subClassOf`, and the small `ex:` property vocabulary documented in `scep-engine.js`.

`scep-market-events.json` is an array of simple event objects. Each event needs `Id`, `Significance`, `TimeStamp`, and `SECURITY` or `RELATED_RICS` to connect to a known company.

This is an educational subset. It is NOT a SPARQL endpoint, FIBO import, OWL reasoner, profit predictor, or evidence of financial causation. The derived event's source IDs and facts explain how it matched the rule.
