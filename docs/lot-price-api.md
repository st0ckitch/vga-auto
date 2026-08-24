# Transport price by auction lot number — backend contract

The front end for this feature is finished and live on the site:

- menu → **კალკულაცია → ლოტის ნომრით დათვლა** (dialog `#dlg-lot`, on every page)
- calculator page → section **„დათვალეთ ლოტის ნომრით"** (`/calculator/#lot`)

Both forms call a single endpoint. Until that endpoint answers, the UI tells the
visitor the automatic check is unavailable and offers the manual calculator and
the phone number — it never shows an invented price.

## Request

```
GET  index.php?class=Action&method=lot_price
       &auction=Copart        // Copart | IAAI | Manheim | Adesa
       &lot=58412345          // lot number as typed by the visitor
       &port=poti             // poti | batumi
       &type=1                // 1 = CAR, 2 = MOTO, 3 = VAN
```

Same origin as the rest of the site, so no CORS headers are needed. The request
is a plain `fetch` with no credentials.

## Response

`Content-Type: application/json`

```json
{
  "error": 0,
  "lot": "58412345",
  "location": "CA - Los Angeles South",
  "city": "Los Angeles",
  "state": "CA",
  "us_transport": 450,
  "ocean": 1150,
  "total": 1600,
  "currency": "USD"
}
```

| field | required | notes |
|---|---|---|
| `error` | yes | `0` = success. Anything else is treated as "unavailable". |
| `lot` | no | Echoed back; falls back to what the visitor typed. |
| `location`, `city`, `state` | no | Any that are present are joined and shown under the lot number. |
| `us_transport` | no | Land leg, auction yard → US port. Hidden if missing or `0`. |
| `ocean` | no | Sea leg to the selected Georgian port. Hidden if missing or `0`. |
| `total` | yes | The figure shown in the highlighted total row. |
| `currency` | no | `USD` (default) or `GEL` — only switches the symbol. |

Anything else — HTTP error, non-JSON body, `error != 0`, or an unreachable
endpoint — makes the UI fall back to the "not available" message. No further
error format is needed.

## What the endpoint has to do

1. **Resolve the lot to a yard.** This is the part that needs a data source:
   a Copart/IAAI dealer API, or a third-party auction API. Cache aggressively —
   a lot's location does not change during a sale.
2. **Look the yard up in the existing tariff table.** The site already has
   land tariffs per city (they drive `method=calc_city` in the current
   calculator), so this can reuse the same table.
3. **Add the ocean tariff** for the chosen destination port and vehicle type.
4. **Return the JSON above.**

## Notes

- Validate `lot` server-side; the front end only trims whitespace.
- If the lot is not found, return `{"error": 1}` — the visitor then sees the
  fallback message rather than a wrong number.
- If you would rather use a different URL, only one line in
  `public/js/vg-modern.js` needs changing (search for `lot_price`).
