# Price Comparison Plugin

The Price Comparison plugin provides automated competitive price monitoring. It handles the full lifecycle from discovering competitor product URLs to continuously tracking live prices and storing historical data.

---

## Architecture Overview

The system operates in two phases that run as separate scheduled pipelines.

**Phase 1 — Discovery**

Discovery finds and validates competitor product pages for each product in your catalog. For each (product, competitor) pair, it:

1. Searches Google for `{product_name} {brand} site:{competitor_domain}`
2. Visits the top search results
3. Extracts the EAN, title, price, and product image from each result page
4. Scores match confidence using a three-tier algorithm (EAN → title → image)
5. Saves confirmed matches to the `pc_matches` table

Discovery is typically run once when a new product or competitor is added, and then periodically (weekly or monthly) to catch URL changes.

**Phase 2 — Monitoring**

Monitoring re-fetches the saved competitor URLs and extracts current prices. It runs frequently (daily or multiple times per day) and appends each price observation to the `pc_price_history` table. No matching logic is re-run; monitoring trusts the URLs validated during discovery.

---

## Plugin Setup (One-Time)

Bootstrap the plugin for an organization. This creates the required ETL project, discovery agent, and monitoring agent, and runs the initial Flyway migrations.

```http
POST /webrobot/api/price-comparison/bootstrap
```

This endpoint is idempotent. Running it again on an already-bootstrapped organization is safe.

---

## Product Catalog

Manage the products you want to monitor.

**Add a product:**

```http
POST /webrobot/api/price-comparison/products
Content-Type: application/json

{
  "ean": "1234567890123",
  "product_name": "My Product Name",
  "brand": "Brand Name",
  "image_url": "https://cdn.example.com/products/my-product.jpg"
}
```

| Field          | Required | Description                                                                |
|----------------|----------|----------------------------------------------------------------------------|
| `ean`          | yes      | EAN-13 barcode. Used as the primary product identifier                     |
| `product_name` | yes      | Full product name as it appears in search results                          |
| `brand`        | no       | Brand name. Combined with `product_name` for Google search queries         |
| `image_url`    | no       | Reference image URL. Used by the image matching stage for visual comparison |

**List products:**

```http
GET /webrobot/api/price-comparison/products
```

**Delete a product:**

```http
DELETE /webrobot/api/price-comparison/products/{ean}
```

Deleting a product removes it from future discovery and monitoring runs. Existing match and price history records are retained.

---

## Competitor Domains

Manage the competitor websites you want to monitor.

**Add a competitor:**

```http
POST /webrobot/api/price-comparison/competitors
Content-Type: application/json

{
  "site_domain": "amazon.it",
  "site_name": "Amazon Italy",
  "country_code": "IT"
}
```

| Field          | Required | Description                                                      |
|----------------|----------|------------------------------------------------------------------|
| `site_domain`  | yes      | Domain without protocol, e.g. `amazon.it`, `mediaworld.it`      |
| `site_name`    | yes      | Human-readable name for the competitor                           |
| `country_code` | no       | ISO 3166-1 alpha-2 country code. Used for filtering and reporting |

**List competitors:**

```http
GET /webrobot/api/price-comparison/competitors
```

**Delete a competitor:**

```http
DELETE /webrobot/api/price-comparison/competitors/{id}
```

---

## Running Jobs

### Discovery Job

Triggers a discovery run for all active products and competitors. Requires a Google Search credential and (if using image matching) a Groq vision credential.

```http
POST /webrobot/api/price-comparison/jobs/discovery
Content-Type: application/json

{
  "cloudCredentialIds": ["uuid-groq-credential", "uuid-google-search-credential"]
}
```

The `cloudCredentialIds` array should contain the UUIDs of the credentials registered under **Settings → Cloud Credentials**. Discovery uses:

- **Google Search credential** — for the `site:` search queries
- **Groq credential** — for the image matching stage (Tier 3, optional but recommended)

### Monitoring Job

Triggers a monitoring run that re-fetches all active match URLs and records current prices.

```http
POST /webrobot/api/price-comparison/jobs/monitoring
```

No credentials are required for monitoring (it visits URLs directly without search).

---

## Querying Results

### Current Prices

Retrieve the most recent price observations for a product across all matched competitor URLs.

```http
GET /webrobot/api/price-comparison/prices?ean=1234567890123&limit=200
```

**Query parameters:**

| Parameter | Description                                                   |
|-----------|---------------------------------------------------------------|
| `ean`     | Filter by product EAN                                         |
| `limit`   | Maximum number of records to return. Default `100`, max `500` |
| `from`    | ISO 8601 date — return prices observed on or after this date  |
| `to`      | ISO 8601 date — return prices observed on or before this date |

### Match Records

Retrieve the validated competitor matches for a product, including confidence scores and match metadata.

```http
GET /webrobot/api/price-comparison/matches?ean=1234567890123
```

Each match record includes:

| Field              | Description                                            |
|--------------------|--------------------------------------------------------|
| `ean`              | Product EAN                                            |
| `competitor_url`   | URL of the matched product page on the competitor site |
| `competitor_id`    | ID of the competitor domain record                     |
| `confidence`       | Match confidence score (0.0 – 1.0)                     |
| `match_method`     | `ean_exact`, `title_similarity`, or `image_match`      |
| `matched_title`    | Product title as found on the competitor page          |
| `matched_ean`      | EAN as found on the competitor page (if available)     |
| `active`           | Whether this URL is included in monitoring runs        |
| `last_checked_at`  | Timestamp of the most recent monitoring visit          |

---

## ETL Stages

The following stages are registered by the plugin and available in custom pipelines. They can be combined with any native or connector stage.

### `pc_load_matches`

**Type:** Source stage (`WSourceStage`)

Loads active match records from the `pc_matches` table and produces one row per match. Replaces seed rows — use this as the first stage in a custom monitoring pipeline.

```yaml
- stage: pc_load_matches
  args: []
```

Each output row contains: `ean`, `competitor_url`, `competitor_id`, `confidence`, `match_method`, `org_id`.

---

### `pc_match_scorer`

**Type:** Transform stage (`WTransformStage`)

Scores how well a candidate competitor page matches a reference product. Uses a progressive two-tier algorithm:

- **Tier 1 — EAN exact match:** If both the reference EAN and the extracted EAN from the page are present and equal, confidence is set to `0.95` and scoring stops.
- **Tier 2 — Jaccard title similarity:** Computes token-level Jaccard similarity between the reference product name and the extracted page title. Confidence ranges from `0.50` to `0.85` depending on similarity score.

Output fields added to the row: `confidence`, `match_method` (`ean_exact` or `title_similarity`).

```yaml
- stage: pc_match_scorer
  args: []
```

---

### `pc_image_match_stage`

**Type:** Transform stage (`WTransformStage`)

**Tier 3 — Visual image comparison** using Groq's vision LLM. This stage is invoked when the confidence from `pc_match_scorer` is below the `min_uncertainty` threshold (default `0.75`), meaning EAN and title matching were inconclusive.

The stage downloads the reference product image and the competitor product image, sends both to the Groq vision model, and receives a structured match verdict. Confidence is updated based on the LLM's assessment.

Requires a Groq cloud credential attached to the job.

```yaml
- stage: pc_image_match_stage
  args:
    - min_uncertainty: "0.75"
```

| Arg               | Default | Description                                                      |
|-------------------|---------|------------------------------------------------------------------|
| `min_uncertainty` | `0.75`  | Run image matching only when current confidence is below this    |

---

### `pc_save_match`

**Type:** Sink stage (`WSinkStage`)

UPSERTs a match record into `pc_matches`. Keyed on `(org_id, ean, competitor_url)`. Updates confidence, match method, and matched metadata if the record already exists.

```yaml
- stage: pc_save_match
  args: []
```

Required input fields: `ean`, `competitor_url`, `competitor_id`, `confidence`, `match_method`.

---

### `pc_save_price`

**Type:** Sink stage (`WSinkStage`)

INSERTs a price observation into `pc_price_history`. Each call always appends a new record — it does not deduplicate.

```yaml
- stage: pc_save_price
  args: []
```

Required input fields: `ean`, `competitor_url`, `price`. Optional: `currency`, `in_stock`, `observed_at`.

---

## How the Discovery Matching Pipeline Works

The full discovery process for a single (product, competitor) pair:

```
1. Google Search
   Query: "{product_name} {brand} site:{competitor_domain}"
   
2. Visit Results
   Navigate to each result URL (top N, configurable)
   
3. Extract Candidate Data
   - extracted_ean     (from structured data, barcode element, or meta tags)
   - extracted_title   (page <h1> or product title element)
   - extracted_price   (price element)
   - extracted_image   (main product image)
   
4. Score Match (pc_match_scorer)
   - If extracted_ean == reference EAN → confidence 0.95 (ean_exact) → STOP
   - Else compute Jaccard(reference_title, extracted_title)
     → confidence 0.50–0.85 (title_similarity)
   
5. Image Match if needed (pc_image_match_stage)
   - If confidence < 0.75 → send both images to Groq vision LLM
   - LLM returns match verdict → update confidence
   
6. Save Match (pc_save_match)
   - If confidence >= threshold (default 0.70) → UPSERT into pc_matches
   - Lower confidence matches are saved with active=false for manual review
```

---

## Custom Pipeline Example

You can build custom pipelines that combine price comparison stages with other WebroBot stages. For example, a monitoring pipeline that also enriches prices with currency conversion:

```yaml
stages:
  # Load all active match URLs for the org
  - stage: pc_load_matches
    args: []

  # Visit each URL
  - stage: visit
    args:
      - "$competitor_url"

  # Extract the current price
  - stage: extract
    args:
      - field: raw_price
        selector: ".price, [data-price], .product-price"
        attribute: text

  # Normalize the price with a Python extension
  - stage: python_row_transform:parse_price
    args: []

  # Save to price history
  - stage: pc_save_price
    args: []

  # Also save the full row to a CSV for reporting
  - stage: save_csv
    args:
      - path: "${OUTPUT_PATH}"
```
