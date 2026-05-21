# Python Extensions

Python Extensions let you inject custom transformation logic into a WebroBot pipeline without writing or compiling a Scala plugin. Functions are registered at runtime, referenced by name in pipeline YAML, and executed row-by-row during the `python_row_transform` stage.

This is the primary extensibility mechanism for AI-generated code and rapid iteration.

---

## Overview

The `python_row_transform:function_name` pipeline stage applies a named Python function to every row in the stream. The function receives a row as a Python `dict` and must return a new `dict`. All fields you want to keep in downstream stages must be present in the returned dict.

There are three ways to register a function:

| Mode | How | Best for |
|------|-----|----------|
| A — Inline YAML | Top-level `python_extensions:` block in the YAML | One-off transforms, self-contained pipelines, demo sandbox |
| B — DB-registered | `POST /api/python-extensions` | Shared/reusable functions across pipelines in the same org |
| C — Hybrid | AI agent generates + registers via API + references by name | AI-assisted development |

---

## Mode A — Inline YAML

Declare the function inside a top-level **`python_extensions:`** block, then reference it by name from a `python_row_transform:<name>` stage in the pipeline. The runtime template (`PySparkCodeGenerator` → `pyspark_pipeline.mustache`) reads this block and wraps `def NAME(row): ...` around the supplied `functionBody`, so what you write in YAML is just the body of the function — not a full `def`.

```yaml
# Top-level extension declarations — NOT a stage of the pipeline.
python_extensions:
  stages:
    - name: extract_price
      type: row_transform
      functionBody: |
        import re
        price_str = row.get('raw_price', '')
        match = re.search(r'[\d.,]+', price_str)
        if match:
            price = float(match.group().replace(',', '.'))
        else:
            price = None
        return {**row, 'price': price}

# Pipeline references the named function via the python_row_transform stage.
pipeline:
  - stage: load_csv
    args:
      - path: "${INPUT_CSV_PATH}"
        header: "true"

  - stage: python_row_transform:extract_price
    args: []

  - stage: save_csv
    args:
      - path: "${OUTPUT_CSV_PATH}"

output:
  format: csv
  path: "${OUTPUT_CSV_PATH}"
```

Notes:

- `functionBody` is **just the body** of the function — no `def` signature line. The template adds `def {{name}}(row): ...` and indents each line of the body by 4 spaces.
- `type: row_transform` is required. The runtime supports `resolvers:` and `actions:` alongside `stages:` as well — see the [Python plugin source](https://github.com/WebRobot-Ltd/webrobot-etl-api) for those shapes.
- The block is parsed once at code-generation time and the functions are registered for the lifetime of the run. They are not persisted between runs — that's what Mode B is for.

---

## Mode B — DB-registered

Register a function via the REST API. It is persisted in the database and available by name to any pipeline run in the same organization, without needing to re-define it in YAML.

**Register a function:**

```http
POST /api/python-extensions
Content-Type: application/json

{
  "name": "extract_price",
  "organization_id": "123",
  "code": "def extract_price(row):\n    raw = row.get('raw_price', '0')\n    try:\n        price = float(raw.replace(',', '.').strip('€$ '))\n    except (ValueError, AttributeError):\n        price = None\n    return {**row, 'price': price}"
}
```

**Reference in pipeline YAML:**

```yaml
stages:
  - stage: load_csv
    args:
      - path: "${INPUT_CSV_PATH}"
        header: "true"
  - stage: python_row_transform:extract_price
    args: []
  - stage: save_csv
    args:
      - path: "${OUTPUT_CSV_PATH}"
```

**List registered functions:**

```http
GET /api/python-extensions?organization_id=123
```

**Delete a function:**

```http
DELETE /api/python-extensions/{name}?organization_id=123
```

---

## Mode C — Hybrid (Recommended for AI Agents)

The hybrid approach is the recommended pattern when using AI agents (Claude Code, Cursor, etc.) to build pipelines:

1. The AI agent generates the Python transform code
2. The agent registers it via `POST /api/python-extensions`
3. The agent references it by name in the pipeline YAML it writes
4. The pipeline is executed via the admin API or CLI

This keeps the pipeline YAML clean and the transform logic versioned and inspectable independently.

```python
# Step 1 — AI agent generates and registers the function
import requests

code = """
def normalize_product_url(row):
    import urllib.parse
    url = row.get('product_url', '')
    if url and not url.startswith('http'):
        url = 'https://' + url
    parsed = urllib.parse.urlparse(url)
    clean = parsed._replace(query='', fragment='').geturl()
    return {**row, 'product_url': clean, 'product_domain': parsed.netloc}
"""

requests.post('https://webrobot.example.com/api/python-extensions', json={
    'name': 'normalize_product_url',
    'organization_id': '123',
    'code': code
})
```

```yaml
# Step 2 — reference in pipeline YAML
stages:
  - stage: load_csv
    args:
      - path: "${INPUT_CSV_PATH}"
        header: "true"
  - stage: python_row_transform:normalize_product_url
    args: []
  - stage: save_csv
    args:
      - path: "${OUTPUT_PATH}"
```

---

## Function Contract

Every Python extension function must follow this contract:

```python
def my_function(row: dict) -> dict:
    # row contains all current pipeline fields as strings or None
    # return a new dict — include ALL fields you want to keep downstream
    return {
        **row,                          # preserve all existing fields
        'new_field': computed_value,    # add new fields
        'existing_field': new_value,    # overwrite existing fields
    }
```

**Rules:**

- The function name in the `def` statement must exactly match the name used in `python_row_transform:name`
- The function must accept exactly one argument (the row dict)
- The function must return a dict
- Fields not included in the return dict are dropped from downstream stages
- Use `{**row, ...}` to preserve fields you are not modifying
- All imports must be inside the function body (the function runs in a sandboxed context)

---

## Field Types in the Row Dict

All field values arriving in the row dict are either strings or `None`. The pipeline engine does not automatically coerce types. You must parse numeric, date, or boolean values explicitly.

```python
def my_function(row):
    # Safe string access with default
    name = row.get('product_name', '')

    # Safe numeric parsing
    try:
        price = float(row.get('raw_price', '0').replace(',', '.'))
    except (ValueError, TypeError):
        price = None

    # Safe integer parsing
    try:
        quantity = int(row.get('quantity', '0'))
    except (ValueError, TypeError):
        quantity = 0

    # None check before string operations
    url = row.get('product_url')
    domain = url.split('/')[2] if url else None

    return {**row, 'price': price, 'quantity': quantity, 'domain': domain}
```

---

## Common Patterns

### Price Parsing

```python
def parse_price(row):
    import re
    raw = row.get('raw_price', '')
    # Handle formats: "€12,99", "12.99 EUR", "1.234,56"
    digits = re.sub(r'[^\d,.]', '', raw)
    if ',' in digits and '.' in digits:
        # European format: 1.234,56 -> 1234.56
        digits = digits.replace('.', '').replace(',', '.')
    elif ',' in digits:
        digits = digits.replace(',', '.')
    try:
        price = float(digits)
    except (ValueError, AttributeError):
        price = None
    return {**row, 'price': price}
```

### URL Normalization

```python
def normalize_url(row):
    import urllib.parse
    url = row.get('product_url', '').strip()
    if not url:
        return {**row, 'product_url': None}
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urllib.parse.urlparse(url)
    # Strip tracking params
    clean = parsed._replace(query='', fragment='').geturl()
    return {**row, 'product_url': clean, 'product_domain': parsed.netloc}
```

### Field Concatenation

```python
def build_full_name(row):
    first = row.get('first_name', '').strip()
    last = row.get('last_name', '').strip()
    full = f"{first} {last}".strip()
    return {**row, 'full_name': full}
```

### JSON Field Parsing

```python
def parse_attributes(row):
    import json
    raw_json = row.get('attributes_json', '{}')
    try:
        attrs = json.loads(raw_json)
    except (json.JSONDecodeError, TypeError):
        attrs = {}
    # Flatten top-level keys into separate fields
    extra = {f"attr_{k}": str(v) for k, v in attrs.items()}
    return {**row, **extra}
```

### Date/Time Formatting

```python
def normalize_date(row):
    from datetime import datetime
    raw = row.get('raw_date', '')
    formats = ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y']
    parsed = None
    for fmt in formats:
        try:
            parsed = datetime.strptime(raw.strip(), fmt)
            break
        except ValueError:
            continue
    iso_date = parsed.strftime('%Y-%m-%d') if parsed else None
    return {**row, 'date': iso_date}
```

### Conditional Logic

```python
def classify_price(row):
    try:
        price = float(row.get('price', '0'))
    except (ValueError, TypeError):
        price = 0.0

    if price == 0:
        tier = 'unknown'
    elif price < 10:
        tier = 'budget'
    elif price < 100:
        tier = 'mid'
    else:
        tier = 'premium'

    return {**row, 'price_tier': tier}
```

---

## Chaining Multiple Functions

You can apply multiple Python transforms in sequence. Each `python_row_transform` stage receives the output of the previous stage.

```yaml
stages:
  - stage: load_csv
    args:
      - path: "${INPUT_PATH}"
        header: "true"
  - stage: python_row_transform:parse_price
    args: []
  - stage: python_row_transform:normalize_url
    args: []
  - stage: python_row_transform:classify_price
    args: []
  - stage: save_parquet
    args:
      - path: "${OUTPUT_PATH}"
```

---

## Error Handling

If your function raises an exception for a given row, the platform logs the error and drops the row. To preserve rows with bad data instead of dropping them, catch exceptions inside your function:

```python
def safe_parse_price(row):
    try:
        price = float(row.get('raw_price', '0').replace(',', '.'))
    except Exception as e:
        price = None
        # Row is preserved with price=None instead of being dropped
    return {**row, 'price': price, 'parse_error': str(e) if price is None else None}
```
