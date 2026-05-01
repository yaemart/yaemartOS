# W12 Homtone Path A Migration Runbook

## 1. Preconditions

- `DATABASE_URL` points to target environment.
- `GEMINI_API_KEY` configured (for extraction phase in later units).
- Input file is generated as PathA extraction input JSON array.

## 2. Execute Import

```bash
./scripts/migration/run-path-a-homtone.sh <input-json-file>
```

Runner output returns JSON summary:

- `total`
- `deduplicated`
- `imported`
- `failed`
- `failures[]`

## 3. Generate Validation Metrics

```bash
node scripts/migration/export-homtone-validation-report.ts <validation-rows.json> [output.json]
```

## 4. Rollback Strategy

- Scope rollback by `run_id` from audit metadata.
- For affected SKUs:
  - restore previous `ProductContent` payload from DB backup/snapshot
  - archive or remove generated `ListingVersion` entries created by the run
- Re-run import only for corrected subset.

## 5. Post-Run Checklist

- Accuracy >= 95% (M-07)
- Ops sampled and signed report
- Manual review queue created for failed SKUs
