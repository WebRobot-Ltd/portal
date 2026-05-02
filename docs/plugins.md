# Plugin SDK

WebroBot supports two layers of extensibility. You can extend the ETL engine with custom Spark stages (Scala JARs) and extend the REST API with domain-specific endpoints and orchestration logic (Java/Jersey). Both types are packaged as plugins and managed through the plugin registry.

---

## Plugin Types

### ETL Plugin (Scala)

A Scala JAR that registers one or more custom pipeline stages. These stages run inside the Spark execution context. Use this when you need:

- Access to Spark DataFrames or RDDs directly
- JDBC operations with transactional semantics
- MinIO/S3 storage access from within the pipeline
- Custom aggregation, filtering, or source logic

### REST API Plugin (Java/Jersey)

A JAR that registers Jersey resource classes (REST endpoints) and orchestration logic. Use this when you need:

- New HTTP endpoints on the WebroBot API
- Domain models with Flyway-managed DB migrations
- Business logic that ties together multiple pipeline runs

Both types can coexist in the same JAR. The `pluginType` field in the manifest controls registration behaviour.

---

## Plugin Manifest

Every plugin ships a `manifest.json` at the root of its JAR (or in the plugin directory). The platform reads this on startup and on plugin reload.

```json
{
  "pluginId": "my-plugin",
  "version": "1.0.0",
  "pluginType": "api",
  "displayName": "My Plugin",
  "mainClass": "com.example.MyPlugin",
  "bootstrapMethod": "bootstrap",
  "dbMigrations": {
    "enabled": true,
    "location": "db/migration/my_plugin"
  },
  "stages": [
    {
      "stage_name": "my_stage",
      "description": "Short description of what this stage does",
      "arg_schema": [
        { "name": "param1", "type": "string", "default": "" },
        { "name": "param2", "type": "integer", "default": "0" }
      ]
    }
  ],
  "organizationIds": [],
  "enabled": true
}
```

**Manifest fields:**

| Field             | Type    | Description                                                                    |
|-------------------|---------|--------------------------------------------------------------------------------|
| `pluginId`        | string  | Unique identifier. Used in stage names and DB migration paths                  |
| `version`         | string  | Semver. Used for display and upgrade tracking                                  |
| `pluginType`      | string  | `"api"`, `"etl"`, or `"both"`                                                  |
| `displayName`     | string  | Human-readable name shown in the admin UI                                      |
| `mainClass`       | string  | Fully qualified class that implements the plugin entry point                   |
| `bootstrapMethod` | string  | Static method on `mainClass` called once on plugin enable                      |
| `dbMigrations`    | object  | `enabled` flag and `location` path inside the JAR's resources directory        |
| `stages`          | array   | Stage descriptors. Synced to the stage catalog on plugin enable/reload         |
| `organizationIds` | array   | Restricts plugin visibility to listed org IDs. Empty = available to all orgs   |
| `enabled`         | boolean | Whether the plugin is active. Can be toggled via the admin API                 |

The `stages[]` array is the authoritative source for the CLI stage catalog. When a plugin is enabled or reloaded, the platform upserts these descriptors into Strapi (or the internal catalog store) so that the CLI, IDE plugins, and AI skills are aware of the new stages.

---

## ETL Plugin SDK Traits

Implement one of the following traits for each stage type. Each class is discovered via Java ServiceLoader (see registration below).

### `WTransformStage`

Transforms a single row. Returns a modified copy of the row. The most common stage type.

```scala
import eu.webrobot.plugin.sdk._

class MyTransformStage extends WTransformStage {
  override val stageName: String = "my_transform"

  override def transform(row: WRow, args: WArgs, ctx: WebroStageContext): WRow = {
    val rawPrice = row.str("raw_price").getOrElse("0")
    val price = rawPrice.replaceAll("[^\\d.]", "").toDoubleOption.getOrElse(0.0)
    row.set("price_normalized", price.toString)
  }
}
```

---

### `WFilterStage`

Filters rows. Return `true` to keep the row, `false` to drop it.

```scala
class ActiveProductFilter extends WFilterStage {
  override val stageName: String = "filter_active"

  override def filter(row: WRow, args: WArgs, ctx: WebroStageContext): Boolean = {
    row.str("status").exists(_ == "active")
  }
}
```

---

### `WSinkStage`

Consumes rows without passing them downstream. Use for writes to external systems.

```scala
class MySinkStage extends WSinkStage {
  override val stageName: String = "my_sink"

  override def sink(row: WRow, args: WArgs, ctx: WebroStageContext): Unit = {
    val ean = row.str("ean").getOrElse("")
    val price = row.double("price").map(java.lang.Double.valueOf).orNull
    ctx.execute(
      "INSERT INTO my_table (ean, price) VALUES (?, ?) ON CONFLICT (ean) DO UPDATE SET price = EXCLUDED.price",
      Seq(ean, price)
    )
  }
}
```

---

### `WSourceStage`

Produces rows from scratch, replacing the default seed rows. Use for custom data sources.

```scala
class MySourceStage extends WSourceStage {
  override val stageName: String = "my_source"

  override def produce(args: WArgs, ctx: WebroStageContext): Iterator[WRow] = {
    val table = args.str(0).getOrElse("products")
    ctx.query(s"SELECT ean, product_name FROM $table WHERE active = true", Seq.empty)
  }
}
```

---

### `WAggregateStage`

Receives the full iterator of rows and returns a new iterator. Use for grouping, deduplication, or bulk operations that require seeing all rows at once.

```scala
class DeduplicateByEan extends WAggregateStage {
  override val stageName: String = "deduplicate_ean"

  override def aggregate(
    rows: Iterator[WRow],
    args: WArgs,
    ctx: WebroStageContext
  ): Iterator[WRow] = {
    rows.toList.groupBy(_.str("ean")).values.map(_.head).iterator
  }
}
```

---

## WebroStageContext

The `ctx` object is injected into every stage call. It provides access to the JDBC data source, configuration, logging, and object storage.

### Database Access

```scala
// Query — returns Iterator[WRow]
val rows = ctx.query(
  "SELECT id, ean, price FROM products WHERE org_id = ?",
  Seq(orgId)
)
// Eagerly materialize before crossing Spark partition boundaries
val list = rows.toList

// Execute — for INSERT / UPDATE / DELETE
ctx.execute(
  "UPDATE products SET price = ? WHERE ean = ?",
  Seq(java.lang.Double.valueOf(price), ean)
)

// Transactional block
ctx.transaction { conn =>
  conn.prepareStatement("DELETE FROM staging WHERE org_id = ?")
    .tap(_.setString(1, orgId))
    .execute()
  conn.prepareStatement("INSERT INTO products SELECT * FROM staging WHERE org_id = ?")
    .tap(_.setString(1, orgId))
    .execute()
}
```

### Configuration

```scala
// Read Spark conf values (set by the WebroBot platform at job start)
val orgId = ctx.config("webrobot.org.id")
val jobId = ctx.config("webrobot.job.id")
```

### Logging

```scala
ctx.log("Processing EAN: " + ean)
ctx.warn("Price value missing for row: " + row.str("id"))
ctx.error("Failed to parse price: " + ex.getMessage)
```

### Object Storage (MinIO / S3)

```scala
// Download a file from object storage to a local temp path
val localPath = ctx.storageGet("bucket-name", "path/to/file.csv")

// Upload a local file to object storage
ctx.storagePut("bucket-name", "path/to/output.csv", "/tmp/local-output.csv")
```

---

## WRow and WArgs

### WRow — Row Access

`WRow` is an immutable map-like structure representing a single data row.

```scala
// Read fields (all return Option)
val ean: Option[String]  = row.str("ean")
val price: Option[Double] = row.double("price")
val qty: Option[Int]     = row.int("quantity")

// Set a field — returns a new WRow (immutable)
val updated = row.set("price_eur", "12.99")

// Remove a field
val cleaned = row.remove("temp_field")

// Check field existence
val hasEan = row.has("ean")
```

### WArgs — Stage Argument Access

`WArgs` provides access to the args list from the pipeline YAML. Args can be positional (a list of values) or named (a map).

```scala
// Positional args — args.str(index)
val targetTable = args.str(0).getOrElse("default_table")
val maxRows     = args.double(1, 1000.0).toInt

// Named (map) args — args.str("key")
val dbtable  = args.str("dbtable").getOrElse("")
val fetchSize = args.str("fetchsize").map(_.toInt).getOrElse(1000)
```

---

## ServiceLoader Registration

Plugins are discovered via the standard Java `ServiceLoader` mechanism. For each trait you implement, add a registration file under `META-INF/services/` in your JAR resources.

**File locations and contents:**

```
# src/main/resources/META-INF/services/eu.webrobot.plugin.sdk.WTransformStage
com.example.MyTransformStage

# src/main/resources/META-INF/services/eu.webrobot.plugin.sdk.WFilterStage
com.example.ActiveProductFilter

# src/main/resources/META-INF/services/eu.webrobot.plugin.sdk.WSinkStage
com.example.MySinkStage

# src/main/resources/META-INF/services/eu.webrobot.plugin.sdk.WSourceStage
com.example.MySourceStage

# src/main/resources/META-INF/services/eu.webrobot.plugin.sdk.WAggregateStage
com.example.DeduplicateByEan
```

Multiple implementations can be listed in the same file, one per line.

---

## Native PipelineStage (Spark-level Operations)

For stages that need direct Spark DataFrame access (e.g. reading via a Spark connector, writing to Delta Lake), implement `PipelineStage` instead of the SDK traits. This gives you full access to the `SpookyContext` and `SpookyPlanAPI`.

```scala
import eu.webrobot.etl.stage.PipelineStage
import eu.webrobot.etl.SpookyContext
import eu.webrobot.etl.SpookyPlanAPI

class LoadDbStage(spooky: SpookyContext) extends PipelineStage {
  override val stageName: String = "load_db"

  override def apply(plan: SpookyPlanAPI, args: Seq[Any]): SpookyPlanAPI = {
    val argsMap = args.head.asInstanceOf[Map[String, String]]
    val dbtable = argsMap("dbtable")

    val opts = Map(
      "dbtable"  -> dbtable,
      "url"      -> argsMap.getOrElse("url", sys.env.getOrElse("JDBC_URL", "")),
      "user"     -> argsMap.getOrElse("user", sys.env.getOrElse("DB_USER", "")),
      "password" -> argsMap.getOrElse("password", sys.env.getOrElse("DB_PASSWORD", ""))
    ) ++ argsMap.filterKeys(k => Set("partitionColumn","lowerBound","upperBound","numPartitions","fetchsize").contains(k))

    val df = spooky.sqlContext.read.format("jdbc").options(opts).load()
    spooky.create(df)
  }
}
```

**Register in your plugin's `registerAll()` method:**

```scala
object MyPlugin {
  def bootstrap(spooky: SpookyContext): Unit = {
    StageRegistry.register(classOf[LoadDbStage])
    StageRegistry.register(classOf[SaveDbStage])
  }
}
```

Reference the `bootstrapMethod` in `manifest.json` so the platform calls it on plugin enable.

---

## Multi-tenancy

Every plugin that handles data must correctly scope it to the requesting organization.

**In ETL stages:** Always read the org ID from Spark config, never from row data or stage args.

```scala
val orgId: String = ctx.config("webrobot.org.id")
```

**In REST API endpoints:** Read the org ID from the validated JWT, never from the request body.

```java
import eu.webrobot.api.security.OrganizationContextHelper;

@GET
@Path("/my-resource")
public Response getResource(@Context HttpServletRequest req) {
    String orgId = OrganizationContextHelper.getOrganizationId(req);
    // use orgId for all DB queries
}
```

**Common mistake:** Passing a `Long` where `setOrganizationId` expects a `String`. Always convert: `String.valueOf(orgId)`.

---

## DB Migrations (Flyway)

Plugins manage their own schema with Flyway. Migration SQL files live inside the JAR under the path declared in `manifest.json`.

**File naming:** `V{version}__{description}.sql` (two underscores before the description).

```
src/main/resources/db/migration/my_plugin/
  V1__init.sql
  V2__add_confidence_column.sql
  V3__add_indexes.sql
```

**Example `V1__init.sql`:**

```sql
CREATE TABLE IF NOT EXISTS my_plugin_results (
    id          BIGSERIAL PRIMARY KEY,
    org_id      TEXT NOT NULL,
    ean         TEXT NOT NULL,
    result_data JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX my_plugin_results_org_ean_idx ON my_plugin_results (org_id, ean);
```

Migrations are applied automatically when the plugin is enabled or when the platform starts with a new plugin version. The `location` in `manifest.json` must match the resource directory path exactly.

---

## Common Pitfalls

**1. `Option[Double].orNull` compile error**

`Double` is a primitive and cannot be null directly. Box it to the Java wrapper type:

```scala
// Wrong — won't compile
val price: java.lang.Double = row.double("price").orNull

// Correct
val price: java.lang.Double = row.double("price").map(java.lang.Double.valueOf).orNull
```

**2. ResultSet closes across Spark partition boundaries**

`ctx.query(...)` returns a lazy `Iterator[WRow]` backed by an open `ResultSet`. If you pass this iterator across a Spark partition boundary (e.g. inside a `mapPartitions` lambda), the connection will be closed before the iterator is consumed.

```scala
// Wrong — iterator will be exhausted/closed before use
val rows = ctx.query("SELECT ...", Seq.empty)
someRdd.mapPartitions(_ => rows)   // ResultSet already closed here

// Correct — materialize eagerly before leaving the JDBC call site
val rows: List[WRow] = ctx.query("SELECT ...", Seq.empty).toList
```

**3. `setOrganizationId` takes String, not Long**

```scala
// Wrong
builder.setOrganizationId(123L)

// Correct
builder.setOrganizationId("123")
```

**4. Stage name collisions**

If two plugins register the same `stageName`, the last one loaded wins. Namespace your stage names with your plugin ID to avoid conflicts: `my_plugin_transform` not just `transform`.
