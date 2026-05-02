# Pipeline Stage Reference

WebroBot pipelines are defined in YAML and executed by the distributed ETL engine. Each stage transforms, filters, sources, or sinks the row stream as it passes through the pipeline. This reference covers all built-in stages, connector stages, and extension points.

## Pipeline YAML Structure

A pipeline is a list of stages under the top-level `stages` key. Each stage has a `stage` name and an `args` list. Args can be positional (plain strings) or named (maps with key/value pairs).

```yaml
stages:
  - stage: load_csv
    args:
      - path: "${INPUT_CSV_PATH}"
        header: "true"
  - stage: visit
    args:
      - "$product_url"
  - stage: extract
    args:
      - field: price
        selector: ".price"
        attribute: text
  - stage: save_csv
    args:
      - path: "${OUTPUT_CSV_PATH}"
```

Environment variables are referenced with `${VAR_NAME}` syntax. Field references use `$field_name` syntax to forward a row field as the argument value at runtime.

---

## Native Stages

Native stages run inside the WebroBot crawler engine and handle web interaction, file I/O, and content extraction.

### `load_csv`

Loads a CSV file as the row source, replacing the default seed rows.

**Args (map):**

| Key           | Type    | Required | Description                                              |
|---------------|---------|----------|----------------------------------------------------------|
| `path`        | string  | yes      | Path to the CSV file. Supports `${ENV_VAR}` substitution |
| `header`      | string  | no       | `"true"` (default) or `"false"` — whether first row is header |
| `inferSchema` | string  | no       | `"true"` or `"false"` — attempt to infer column types    |

**Examples:**

```yaml
# Minimal — just a path
- stage: load_csv
  args:
    - path: "/data/products.csv"

# With options
- stage: load_csv
  args:
    - path: "${INPUT_CSV_PATH}"
      header: "true"
      inferSchema: "false"
```

---

### `visit`

Navigates the browser to a URL. The URL can be a literal string or a field reference that resolves to a URL from the current row.

**Args (positional):**

| Position | Type             | Description                                        |
|----------|------------------|----------------------------------------------------|
| 0        | string or `$ref` | Target URL, or a field reference like `$product_url` |

**Examples:**

```yaml
# Literal URL
- stage: visit
  args:
    - "https://example.com/products"

# From a row field
- stage: visit
  args:
    - "$product_url"
```

---

### `extract`

Extracts content from the currently visited page using CSS selectors, XPath, or attribute access. Each arg in the list defines one field extraction.

**Args (list of maps):**

| Key         | Type   | Required | Description                                                   |
|-------------|--------|----------|---------------------------------------------------------------|
| `field`     | string | yes      | Name of the output field to populate                          |
| `selector`  | string | yes      | CSS selector or XPath expression targeting the element        |
| `attribute` | string | no       | `text` (default), `html`, or any HTML attribute name like `href`, `src` |

**Example:**

```yaml
- stage: extract
  args:
    - field: price
      selector: ".price-value"
      attribute: text
    - field: title
      selector: "h1.product-title"
      attribute: text
    - field: image_url
      selector: "img.product-image"
      attribute: src
    - field: ean_barcode
      selector: "[data-ean]"
      attribute: data-ean
```

---

### `iextract`

Like `extract`, but uses a field prefix mapping instead of explicit field names. Useful for extracting a repeating set of fields from multiple selectors in bulk.

**Args (list of maps with prefix key):**

The `prefix` key is prepended to each extracted field name. This stage is typically used when the field names are computed dynamically or when building generalised extraction pipelines.

```yaml
- stage: iextract
  args:
    - prefix: "competitor_"
      selector: ".product-info"
      fields:
        - name: price
          selector: ".price"
          attribute: text
        - name: title
          selector: ".title"
          attribute: text
```

---

### `save_csv`

Writes the current row stream to a CSV file.

**Args (positional or map):**

| Key / Position | Type   | Description                       |
|----------------|--------|-----------------------------------|
| `path` / 0     | string | Output file path                  |
| `header`       | string | `"true"` (default) or `"false"`   |

```yaml
- stage: save_csv
  args:
    - path: "${OUTPUT_CSV_PATH}"
```

---

### `save_parquet`

Writes the current row stream to a Parquet file. Preferred for large datasets or downstream Spark consumption.

**Args (positional or map):**

| Key / Position | Type   | Description                            |
|----------------|--------|----------------------------------------|
| `path` / 0     | string | Output file path (HDFS, S3, or local)  |
| `mode`         | string | `overwrite` (default) or `append`      |

```yaml
- stage: save_parquet
  args:
    - path: "s3a://my-bucket/output/products"
      mode: "overwrite"
```

---

## Connector Stages (Spark-native)

Connector stages run in the Spark execution context and are used for bulk data loading from external systems. They source data into the Spark DataFrame layer, replacing or augmenting the row stream.

### `load_db`

Loads data from a JDBC-compatible relational database. When no `url` is provided, the stage connects to the internal PostgreSQL instance using the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` environment variables automatically.

**Args (map):**

| Key               | Type    | Required | Description                                                                 |
|-------------------|---------|----------|-----------------------------------------------------------------------------|
| `dbtable`         | string  | yes      | Table name or a subquery wrapped in parentheses, e.g. `"(SELECT * FROM t) AS t"` |
| `url`             | string  | no       | JDBC URL. Omit to use the internal PostgreSQL instance                      |
| `user`            | string  | no       | DB username. Defaults to `DB_USER` env var                                  |
| `password`        | string  | no       | DB password. Defaults to `DB_PASSWORD` env var                              |
| `driver`          | string  | no       | JDBC driver class. Auto-detected from URL when omitted                      |
| `fetchsize`       | string  | no       | Number of rows to fetch per round-trip. Default `1000`                      |
| `partitionColumn` | string  | no       | Numeric column to use for parallel partition reads                          |
| `lowerBound`      | string  | no       | Minimum value of `partitionColumn` for partitioning                         |
| `upperBound`      | string  | no       | Maximum value of `partitionColumn` for partitioning                         |
| `numPartitions`   | string  | no       | Number of parallel Spark partitions for the read                            |

**Example — read from internal PostgreSQL (no URL needed):**

```yaml
- stage: load_db
  args:
    - dbtable: "products"
```

**Example — read with a filtered subquery:**

```yaml
- stage: load_db
  args:
    - dbtable: "(SELECT id, ean, product_name FROM products WHERE active = true) AS p"
```

**Example — parallel partitioned read for large tables:**

```yaml
- stage: load_db
  args:
    - dbtable: "price_history"
      partitionColumn: "id"
      lowerBound: "1"
      upperBound: "10000000"
      numPartitions: "16"
      fetchsize: "5000"
```

**Example — external database with explicit JDBC URL:**

```yaml
- stage: load_db
  args:
    - dbtable: "orders"
      url: "jdbc:postgresql://external-db.example.com:5432/warehouse"
      user: "${EXT_DB_USER}"
      password: "${EXT_DB_PASSWORD}"
      driver: "org.postgresql.Driver"
```

---

### `load_avro`

Loads an Avro file into the Spark row stream.

```yaml
- stage: load_avro
  args:
    - path: "s3a://my-bucket/data/events.avro"
```

---

### `load_delta`

Loads a Delta Lake table.

```yaml
- stage: load_delta
  args:
    - path: "s3a://my-bucket/delta/products"
```

---

### `load_bigquery`

Loads a BigQuery table using the Spark BigQuery connector. Requires a GCP cloud credential to be attached to the job.

```yaml
- stage: load_bigquery
  args:
    - table: "my-project.my_dataset.my_table"
```

---

### `load_athena`

Loads data from AWS Athena via the JDBC connector. Requires an AWS cloud credential.

```yaml
- stage: load_athena
  args:
    - query: "SELECT * FROM my_database.my_table WHERE dt = '2024-01-01'"
      s3OutputLocation: "s3://my-bucket/athena-results/"
```

---

### `load_xml`

Loads an XML file into the row stream. The `rowTag` option defines which XML element maps to a single row.

**Args (map):**

| Key      | Type   | Required | Description                                    |
|----------|--------|----------|------------------------------------------------|
| `path`   | string | yes      | Path to the XML file                           |
| `rowTag` | string | yes      | XML element name that represents a single row  |

```yaml
- stage: load_xml
  args:
    - path: "/data/catalog.xml"
      rowTag: "product"
```

---

### `load_mongodb`

Loads a MongoDB collection into the row stream.

```yaml
- stage: load_mongodb
  args:
    - uri: "mongodb://user:password@host:27017"
      database: "mydb"
      collection: "products"
```

---

### `load_cassandra`

Loads a Cassandra table.

```yaml
- stage: load_cassandra
  args:
    - keyspace: "my_keyspace"
      table: "products"
      host: "cassandra-host"
```

---

### `load_elasticsearch`

Loads documents from an Elasticsearch index.

```yaml
- stage: load_elasticsearch
  args:
    - nodes: "http://elasticsearch:9200"
      index: "products"
      query: '{"query": {"match_all": {}}}'
```

---

### `load_kafka`

Loads messages from a Kafka topic (batch read).

```yaml
- stage: load_kafka
  args:
    - bootstrapServers: "kafka:9092"
      topic: "product-events"
      startingOffsets: "earliest"
```

---

### `load_iceberg`

Loads an Apache Iceberg table.

```yaml
- stage: load_iceberg
  args:
    - table: "my_catalog.my_database.products"
```

---

## Python Extension Stage

### `python_row_transform:function_name`

Applies a registered Python function to each row. The function receives the row as a dict and returns a new dict. The function must be registered either inline (via `python_define`) or via the Python Extensions API before the pipeline runs.

```yaml
- stage: python_row_transform:extract_price
  args: []
```

See the [Python Extensions](./python-extensions.md) guide for full documentation on all three registration modes.

---

## Complete Pipeline Examples

### Example 1 — CSV to Web Scrape to CSV

```yaml
stages:
  - stage: load_csv
    args:
      - path: "${INPUT_CSV_PATH}"
        header: "true"
  - stage: visit
    args:
      - "$product_url"
  - stage: extract
    args:
      - field: price
        selector: ".price"
        attribute: text
      - field: title
        selector: "h1"
        attribute: text
      - field: stock_status
        selector: ".availability"
        attribute: text
  - stage: save_csv
    args:
      - path: "${OUTPUT_CSV_PATH}"
```

---

### Example 2 — Database Load, Transform, Save

Reads from the internal PostgreSQL database, applies a Python transform, and saves to Parquet:

```yaml
stages:
  - stage: load_db
    args:
      - dbtable: "(SELECT id, ean, product_name, raw_price FROM products WHERE status = 'active') AS p"
  - stage: python_row_transform:normalize_price
    args: []
  - stage: save_parquet
    args:
      - path: "s3a://my-bucket/output/normalized_products"
        mode: "overwrite"
```

---

### Example 3 — Parallel Partitioned DB Read for Large Tables

When reading very large tables, use `partitionColumn` and `numPartitions` to parallelize the read across Spark workers:

```yaml
stages:
  - stage: load_db
    args:
      - dbtable: "price_history"
        partitionColumn: "id"
        lowerBound: "1"
        upperBound: "50000000"
        numPartitions: "32"
        fetchsize: "10000"
  - stage: save_parquet
    args:
      - path: "s3a://my-bucket/export/price_history"
        mode: "overwrite"
```

The `partitionColumn` must be a numeric column. The read is split into `numPartitions` range queries executed in parallel by Spark workers, significantly reducing total load time for large tables.

---

### Example 4 — Multi-source Pipeline with Python Extension

```yaml
stages:
  - stage: load_csv
    args:
      - path: "${PRODUCT_CATALOG_PATH}"
        header: "true"
  - stage: python_define
    args:
      - name: build_search_url
        code: |
          def build_search_url(row):
              import urllib.parse
              query = urllib.parse.quote(f"{row.get('product_name','')} {row.get('brand','')}")
              return {**row, 'search_url': f"https://www.google.com/search?q={query}"}
  - stage: python_row_transform:build_search_url
    args: []
  - stage: visit
    args:
      - "$search_url"
  - stage: extract
    args:
      - field: first_result_url
        selector: "a.result-link"
        attribute: href
  - stage: save_csv
    args:
      - path: "${OUTPUT_PATH}"
```
