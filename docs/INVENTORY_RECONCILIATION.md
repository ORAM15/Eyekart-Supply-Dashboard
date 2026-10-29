# EyeKart inventory reconciliation — SSD Frame List

Date: 2026-10-30 (prepared from owner's screenshot shared 2026-10-29)

## Result

The existing `src/data/initialBranches.ts` seed matches the row values read from the screenshot and reconciles exactly to the sheet's printed total:

| Measure | Screenshot/seed baseline |
|---|---:|
| Listed branch rows | 35 |
| Male frames | 1,500 |
| Female frames | 1,830 |
| Kids frames | 410 |
| **Total frames** | **3,740** |

Every transcribed row has a row total equal to Male + Female + Kids. SRNs 3 and 35 are absent from the source and are not fabricated. SRN 1 is kept as displayed (`Bliss BusiaB3:D27`); `Bliss Busia` remains only a proposed canonical name until confirmed.

## Exact difference from current JSON

The branch records in `data/eyekart_db.json` currently sum to 3,719. The 21-frame net gap is explained by **two branch rows**, not an unknown balancing adjustment:

| SRN | Branch | Screenshot baseline M/F/K | Current JSON M/F/K | Total delta (source − JSON) |
|---:|---|---|---|---:|
| 8 | Bliss Githurai | 40 / 50 / 10 = 100 | 20 / 20 / 9 = 49 | +51 |
| 10 | Bliss Iten | 0 / 0 / 0 = 0 | 10 / 10 / 10 = 30 | −30 |
| | **Net** | | | **+21** |

Category delta (source minus JSON): Male +10, Female +20, Kids −9. Applying only those two branch corrections would make the branch balances match the screenshot: Male 1,500; Female 1,830; Kids 410; total 3,740.

## Safety decision

- This is a **reconciliation report**, not an applied import.
- `data/eyekart_db.json` remains unchanged as the existing audit snapshot.
- Owner confirmed the Oct 29 orders and stock movements in that JSON are demo/test transactions; keep them out of a production import.
- The screenshot baseline does not establish warehouse stock, so warehouse quantities remain unverified.
- Authentication and persistent storage are still required before allowing production writes.
- No stock counts were adjusted in the current JSON in this commit.
