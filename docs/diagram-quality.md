# Diagram investigation and acceptance

The generation engine must complete this sequence:

1. `plan_request`: retain the original question and define investigation targets.
2. Source discovery and `read_source`: inspect implementations and issue citations.
3. `record_investigation`: record system ownership, boundary interactions, target answers, mechanisms and explicit gaps.
4. Stream and `preview_diagram`: validate the candidate's schema and rendering.
5. `review_diagram`: map the investigation to the exact candidate and assess request fit, ownership, ordering and grounding.
6. `submit_diagram`: accept only the unchanged reviewed candidate, evidence, gaps and revision flags.

`diagram_quality.rs` enforces coverage and references for all five representations. Every planned target must be resolved or explicitly unresolved. Each target must account for trigger, processing, conditions/timing, concurrency, outcomes and failures; genuinely inapplicable aspects require a reason. Unresolved findings must reach the draft's visible gaps. Every node and relationship requires issued, current source citations.

`list_sources.code_owners` derives canonical owners from imported package manifests. A cited code package must be represented as an internal owner with that canonical package name. This prevents processing stages from replacing service identity. Owners remain visible in element labels, sublabels or context, even in dataflow views. Packages without a discovered manifest require source-supported concepts and an explicit ownership gap; package discovery is not a deployment-topology oracle.

A deep expansion requires a source-backed mechanism whose explanation changes and connects to the flow. Title changes, repositioning, unrelated additions and isolated API boxes are insufficient. Existing element preservation remains enforced. Source discovery exposes file totals, folder counts and pagination.

Each run retains private `plan.json`, `investigation.json`, `review.json` and `tool-state.json` artifacts. Replanning invalidates the report, preview and review; a new report invalidates preview and review; a new preview invalidates review. Evidence changes require another review. Submission rechecks citation freshness. If the managed CLI ends without submission, the app resumes the same isolated session up to twice, retaining tool state and the original twenty-minute deadline. It never saves a fenced-JSON-only response as a completed draft.

These are structural/evidence checks and model self-review, **not independent proof of semantic correctness**. A model can still misinterpret a source or omit an investigation target. Actual generation evaluation remains necessary.

## Verification

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib projects::
node --experimental-strip-types --test tests/diagram-stream-protocol.test.ts tests/diagram-render-queue.test.ts tests/project-diagrams.test.ts
```

For a real generation run, build the desktop debug binary and pass an existing local investigation manifest to:

```sh
python3 scripts/evaluate-diagram-generation.py /absolute/path/to/manifest.json
python3 scripts/evaluate-diagram-generation.py /absolute/path/to/manifest.json --new --question 'Explain how a voice call reaches a spoken answer end to end, including interruption and failure paths.'
```

The runner uses the signed-in account's existing project gateway, managed Gemini CLI, current prompt, MCP binary and renderer. Use `--api-url` when the application uses a nondefault API. It copies the manifest into a new private evaluation directory and never writes a project diagram through the API. The model still uses the approved imported sources and normal gateway quota. Credentials stay in memory; private run artifacts may contain source excerpts and are not repository fixtures.

Evaluate the artifacts for real owners, correct cross-system interactions, conditions and concurrent work, meaningful omissions, complete evidence and accepted submission. An accepted tool response alone does not establish explanation quality or visual readability.
