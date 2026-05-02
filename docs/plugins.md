# Plugin Development

WebroBot supports two layers of extensibility. You can extend the ETL engine with custom Spark stages (Scala JARs) and extend the REST API with domain-specific endpoints and orchestration logic (Java/Jersey). Both are packaged as plugins and managed through the plugin registry.

:::tip Recommended: Claude Code for plugin development
Use [Claude Code](/docs/ai-tools) with the `/webrobot-plugin-dev` skill to scaffold and implement plugins. The skill knows the full SDK, multi-tenancy requirements, Flyway conventions, and common pitfalls — you describe the business logic and it produces ready-to-compile code.
:::

**Reference repositories:**

| Repo | Description |
|------|-------------|
| [WebRobot-Ltd/webrobot-plugin-sdk](https://github.com/WebRobot-Ltd/webrobot-plugin-sdk) | ETL plugin SDK (Scala traits, zero ETL dependencies) |
| [WebRobot-Ltd/webrobot-example-plugin](https://github.com/WebRobot-Ltd/webrobot-example-plugin) | Complete working ETL plugin example (Gradle) |
| [WebRobot-Ltd/webrobot-jersey-plugin-sdk](https://github.com/WebRobot-Ltd/webrobot-jersey-plugin-sdk) | REST API plugin SDK (Java, JAX-RS) |
| [WebRobot-Ltd/webrobot-example-jersey-plugin](https://github.com/WebRobot-Ltd/webrobot-example-jersey-plugin) | Complete working REST API plugin example (Maven) |

---

## Plugin Types

### ETL Plugin (Scala + Gradle)

A Scala JAR that registers one or more custom pipeline stages. These stages run inside the Spark execution context. Use this when you need:

- Custom row transforms, filters, aggregations, or source logic
- JDBC operations with DB access via `WebroStageContext`
- MinIO/S3 object storage access from within the pipeline
- Direct Spark DataFrame access (via `PipelineStage`)

### REST API Plugin (Java + Maven)

A JAR that registers Jersey resource classes and orchestration logic. Use this when you need:

- New HTTP endpoints on the WebroBot API
- Domain models with Flyway-managed DB migrations
- Business logic that ties together multiple pipeline runs
- LLM or object storage access from the API layer

Both types can coexist in the same JAR. The `pluginType` field in the manifest controls registration behaviour.

---

## Quickstart with the CLI

The CLI includes a `plugin` command group that scaffolds all boilerplate:

```bash
webrobot plugin new my-etl-plugin --group com.mycompany
cd my-etl-plugin

webrobot plugin add stage ExtractPrice --type transform
webrobot plugin add stage FilterEmpty  --type filter
webrobot plugin add resolver EurPrice
webrobot plugin add action  Sleep
```

Each `add` command generates the Scala source file and updates the corresponding `META-INF/services` entry automatically.

---

## ETL Plugin

### Project Structure

```
my-etl-plugin/
├── build.gradle.kts
├── settings.gradle.kts
├── manifest.json
└── src/
    └── main/
        ├── scala/
        │   └── com/mycompany/
        │       └── stages/
        │           ├── ExtractPriceStage.scala
        │           └── FilterEmptyStage.scala
        └── resources/
            └── META-INF/services/
                ├── eu.webrobot.plugin.sdk.WTransformStage
                └── eu.webrobot.plugin.sdk.WFilterStage
```

### `build.gradle.kts`

```kotlin
plugins {
    id("scala")
    id("java-library")
}

group   = "com.mycompany"
version = "0.1.0"

repositories {
    mavenCentral()
    maven {
        name = "GitHubPackages"
        url  = uri("https://maven.pkg.github.com/WebRobot-Ltd/webrobot-plugin-sdk")
        credentials {
            username = System.getenv("GITHUB_ACTOR") ?: "webroboteu"
            password = System.getenv("GITHUB_TOKEN")
                ?: throw GradleException("GITHUB_TOKEN env var required")
        }
    }
}

dependencies {
    // Only dependency — ETL engine provides both at runtime
    compileOnly("eu.webrobot:webrobot-plugin-sdk:0.2.0")
    compileOnly("org.scala-lang:scala-library:2.12.18")

    testImplementation("org.scalatest:scalatest_2.12:3.2.18")
}

tasks.withType<Jar> { duplicatesStrategy = DuplicatesStrategy.EXCLUDE }
tasks.test { useJUnitPlatform() }
```

### Build

```bash
GITHUB_TOKEN=<your-token> ./gradlew jar
# Output: build/libs/my-etl-plugin-0.1.0.jar
```

---

## ETL Stage Types

### `WTransformStage` — row-by-row transform

Most common type. Receives one row, returns one row (modified or unchanged).

```scala
import eu.webrobot.plugin.sdk.{WArgs, WRow, WTransformStage}

class UpperCaseStage extends WTransformStage {
  override def name: String = "upper_case"

  override def transform(row: WRow, args: WArgs): WRow = {
    val field = args.string(0, "text")
    row.str(field).fold(row)(v => row.set(field, v.toUpperCase))
  }
}
```

Register in `META-INF/services/eu.webrobot.plugin.sdk.WTransformStage`:
```
com.mycompany.stages.UpperCaseStage
```

Pipeline YAML:
```yaml
- stage: upper_case
  args:
    - text
```

---

### `WFilterStage` — keep or drop rows

Return `true` to keep, `false` to drop.

```scala
import eu.webrobot.plugin.sdk.{WArgs, WRow, WFilterStage}

class FilterNonEmptyStage extends WFilterStage {
  override def name: String = "filter_non_empty"

  override def include(row: WRow, args: WArgs): Boolean = {
    val field = args.string(0, "value")
    row.str(field).exists(_.trim.nonEmpty)
  }
}
```

---

### `WSourceStage` — produce rows from an external source

Called once by the engine. The result is parallelized across Spark executors. Use for DB queries, REST API calls, or any custom data source.

```scala
import eu.webrobot.plugin.sdk.{WArgs, WRow, WSourceStage, WebroStageContext}

class DbLoadStage extends WSourceStage {
  override def name: String = "db_load_example"

  override def produce(args: WArgs, ctx: WebroStageContext): Iterator[WRow] = {
    val table  = args.string(0, "items")
    val status = args.string(1, "active")
    val limit  = args.int(2, 1000)
    ctx.log(s"[$name] Loading $limit rows from $table where status=$status")
    ctx.query(s"SELECT * FROM $table WHERE status = ? LIMIT ?", Seq(status, limit))
  }
}
```

Register in `META-INF/services/eu.webrobot.plugin.sdk.WSourceStage`.

---

### `WSinkStage` — write to an external destination

Each row passes through unchanged (pipeline continues). Use for DB writes, HTTP pushes, or file exports.

```scala
import eu.webrobot.plugin.sdk.{WArgs, WRow, WSinkStage, WebroStageContext}

class DbSaveStage extends WSinkStage {
  override def name: String = "db_save_example"

  override def consume(row: WRow, args: WArgs, ctx: WebroStageContext): WRow = {
    val idField    = args.string(0, "id")
    val valueField = args.string(1, "value")
    val table      = args.string(2, "results")
    val id    = row.str(idField).getOrElse("")
    val value = row.str(valueField).getOrElse("")
    if (id.nonEmpty && value.nonEmpty)
      ctx.execute(
        s"INSERT INTO $table (id, value, saved_at) VALUES (?, ?, NOW()) ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, saved_at = NOW()",
        Seq(id, value)
      )
    else
      ctx.warn(s"[$name] Skipping row: missing $idField or $valueField")
    row.set("_saved", true)
  }
}
```

---

### `WAggregateStage` — pairwise fold (like `reduceByKey`)

Groups rows by key and combines them two at a time.

```scala
import eu.webrobot.plugin.sdk.{WArgs, WRow, WAggregateStage}

class SumByKeyStage extends WAggregateStage {
  override def name: String = "sum_by_key"

  override def groupBy(row: WRow): String =
    row.str("category").getOrElse("")

  override def combine(left: WRow, right: WRow, args: WArgs): WRow = {
    val field = args.string(0, "amount")
    val sum   = left.double(field).getOrElse(0.0) + right.double(field).getOrElse(0.0)
    left.set(field, sum)
  }
}
```

---

### `WGroupStage` — full group aggregation

Receives the complete group as an `Iterable`. Use for min/max/avg or best-match selection where pairwise folding isn't sufficient.

```scala
import eu.webrobot.plugin.sdk.{WArgs, WRow, WGroupStage, WebroStageContext}

class BestPriceStage extends WGroupStage {
  override def name: String = "best_price"
  override def groupBy(row: WRow): String = row.str("ean").getOrElse("")

  override def aggregate(rows: Iterable[WRow], args: WArgs, ctx: WebroStageContext): WRow = {
    val priceField = args.string(0, "price")
    val mode       = args.string(1, "min")
    val rowList    = rows.toList
    val withPrice  = rowList.flatMap(r => r.double(priceField).map(_ -> r))
    val best = if (mode == "max") withPrice.maxBy(_._1)._2 else withPrice.minBy(_._1)._2
    best.set("site_count", rowList.size)
  }
}
```

---

### `WPartitionStage` — whole-partition operation

Operates on an entire Spark partition at once (`mapPartitions`). Use for:
- Batch DB writes (single INSERT batch for N rows)
- ANN index lookups (load index once per partition, process all rows)
- Partition-local deduplication

```scala
import eu.webrobot.plugin.sdk.{WArgs, WRow, WPartitionStage, WebroStageContext}

class BatchSaveStage extends WPartitionStage {
  override def name: String = "batch_save"

  override def transformPartition(
    rows: Iterator[WRow], args: WArgs, ctx: WebroStageContext
  ): Iterator[WRow] = {
    val table = args.string(0, "results")
    val batch = rows.toList
    if (batch.nonEmpty) {
      val placeholders = batch.map(_ => "(?, ?, NOW())").mkString(", ")
      val params = batch.flatMap(r => Seq(
        r.str("id").getOrElse(""),
        r.str("value").getOrElse("")
      ))
      ctx.execute(s"INSERT INTO $table (id, value, created_at) VALUES $placeholders ON CONFLICT DO NOTHING", params)
    }
    batch.iterator
  }
}
```

---

### `WResolver` — attribute extractor

Extracts a value from the text content of an HTML element. Used in `extract` stage attribute resolvers.

```scala
import eu.webrobot.plugin.sdk.WResolver

class PriceResolver extends WResolver {
  override def name: String = "price_resolver"

  private val pattern = """([0-9]+(?:[.,][0-9]{1,2})?)""".r

  override def extract(text: String): Option[String] =
    pattern.findFirstIn(text).map(_.replace(',', '.'))
}
```

Register in `META-INF/services/eu.webrobot.plugin.sdk.WResolver`.

---

### `WAction` — browser automation action

Produces a browser action descriptor from named parameters.

```scala
import eu.webrobot.plugin.sdk.{ActionSpec, WAction, WActionArgs}

class SleepAction extends WAction {
  override def name: String = "sleep"

  override def build(args: WActionArgs): ActionSpec =
    ActionSpec(actionType = "sleep", params = Map("ms" -> args.int("ms", 500)))
}
```

Register in `META-INF/services/eu.webrobot.plugin.sdk.WAction`.

---

## WebroStageContext API

The `ctx` object is injected into context-aware stages (`WSourceStage`, `WSinkStage`, `WGroupStage`, `WPartitionStage`).

### Database

```scala
// Query — returns Iterator[WRow] (materialize with .toList before crossing partition boundaries)
val rows: List[WRow] = ctx.query("SELECT id, ean, price FROM products WHERE org_id = ?", Seq(orgId)).toList

// Execute — INSERT / UPDATE / DELETE
ctx.execute("UPDATE products SET price = ? WHERE ean = ?", Seq(java.lang.Double.valueOf(price), ean))

// Transaction
ctx.transaction { conn =>
  conn.prepareStatement("DELETE FROM staging WHERE org_id = ?").tap(_.setString(1, orgId)).execute()
  conn.prepareStatement("INSERT INTO products SELECT * FROM staging WHERE org_id = ?").tap(_.setString(1, orgId)).execute()
}
```

### Configuration

```scala
val orgId = ctx.config("webrobot.org.id")   // set by platform at job start
val jobId = ctx.config("webrobot.job.id")
val env   = ctx.buildType                   // "development" / "staging" / "production"
```

### Object Storage (MinIO / S3)

```scala
val bytes = ctx.storageGet("path/to/file.csv")           // Download → Array[Byte]
ctx.storagePut("path/to/output.csv", data, "text/csv")   // Upload
val exists = ctx.storageExists("path/to/file.csv")
val keys   = ctx.storageList("path/prefix/")
```

### Logging

```scala
ctx.log("Processing EAN: " + ean)
ctx.warn("Price value missing for row: " + rowId)
ctx.error("Failed to parse price: " + ex.getMessage)
```

---

## WRow and WArgs API

### WRow

```scala
val ean:   Option[String]  = row.str("ean")
val price: Option[Double]  = row.double("price")
val qty:   Option[Int]     = row.int("quantity")
val flag:  Option[Boolean] = row.bool("active")

val updated = row.set("price_eur", 12.99)     // returns new WRow
val cleaned = row.remove("temp_field")
val renamed = row.rename("old_name", "new_name")
val names   = row.fieldNames                   // Set[String]
val has     = row.hasField("ean")
```

### WArgs (positional stage arguments)

```scala
val table    = args.string(0, "products")   // positional arg at index 0
val maxRows  = args.int(1, 1000)
val minPrice = args.double(2, 0.0)
val active   = args.bool(3, true)
val count    = args.size
```

---

## Plugin Manifest

Every plugin ships a `manifest.json` at the root of its JAR. The platform reads this on startup and on plugin reload.

```json
{
  "pluginId": "my-plugin",
  "version": "1.0.0",
  "pluginType": "etl",
  "displayName": "My Plugin",
  "mainClass": "com.mycompany.MyPlugin",
  "bootstrapMethod": "bootstrap",
  "enabled": true,
  "organizationIds": [],
  "stages": [
    {
      "stage_name": "my_transform",
      "description": "Normalizes price values to EUR",
      "extensionType": "stage",
      "arg_schema": [
        { "name": "field", "type": "string", "required": true, "description": "Field containing the raw price" },
        { "name": "currency", "type": "string", "required": false, "default": "EUR" }
      ]
    }
  ],
  "dbMigrations": {
    "enabled": false,
    "location": "db/migration/my_plugin"
  }
}
```

| Field | Description |
|-------|-------------|
| `pluginId` | Unique identifier. Namespace your stage names with this to avoid conflicts |
| `pluginType` | `"etl"`, `"api"`, or `"both"` |
| `mainClass` | Entry point class — for ETL plugins, the object with `bootstrap()` |
| `bootstrapMethod` | Static method on `mainClass` called once when the plugin is enabled |
| `stages[]` | Stage descriptors synced to the stage catalog on enable/reload — used by CLI, IDE tools, and AI skills |
| `organizationIds` | Restrict plugin to specific orgs. Empty = available to all |

---

## REST API Plugin

### Project Structure

```
my-jersey-plugin/
├── pom.xml
├── manifest.json
└── src/main/
    ├── java/com/mycompany/
    │   └── MyPlugin.java
    └── resources/
        └── db/migration/my_plugin/
            └── V1__init.sql
```

### `pom.xml` dependency

```xml
<repositories>
  <repository>
    <id>jitpack.io</id>
    <url>https://jitpack.io</url>
  </repository>
</repositories>

<dependencies>
  <!-- Public REST API SDK — no internal engine classes -->
  <dependency>
    <groupId>com.github.WebRobot-Ltd</groupId>
    <artifactId>webrobot-jersey-plugin-sdk</artifactId>
    <version>v0.1.0</version>
    <scope>provided</scope>
  </dependency>
  <!-- JAX-RS and Jackson provided by the platform at runtime -->
  <dependency>
    <groupId>jakarta.ws.rs</groupId>
    <artifactId>jakarta.ws.rs-api</artifactId>
    <version>2.1.6</version>
    <scope>provided</scope>
  </dependency>
</dependencies>
```

### Plugin class

```java
import eu.webrobot.plugin.jersey.WebroPlugin;
import eu.webrobot.plugin.jersey.WebroPluginContext;
import javax.ws.rs.*;
import javax.ws.rs.core.*;

@Path("/webrobot/api/my-plugin")
@Produces(MediaType.APPLICATION_JSON)
public class MyPlugin extends WebroPlugin {

    private WebroPluginContext ctx;

    @Override
    public String pluginId() { return "my-plugin"; }

    @Override
    public void bootstrap(WebroPluginContext context) {
        this.ctx = context;
        // Flyway migrations in manifest.json dbMigrations.location run automatically
    }

    @GET
    @Path("/status")
    public Response status() {
        return Response.ok(Map.of(
            "pluginId", pluginId(),
            "buildType", ctx.buildType()
        )).build();
    }

    @POST
    @Path("/process")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response process(Map<String, Object> payload) {
        String orgId = OrganizationContextHelper.getOrganizationId(req);
        // DB, storage, and LLM available via ctx
        return Response.ok(Map.of("status", "ok")).build();
    }
}
```

### `WebroPluginContext` API (REST API plugins)

| Method | Description |
|--------|-------------|
| `ctx.db().query(sql, params)` | SELECT → `List<Map<String, Object>>` |
| `ctx.db().execute(sql, params)` | INSERT/UPDATE/DELETE |
| `ctx.storage().upload(path, bytes, contentType)` | Upload to MinIO/S3 |
| `ctx.storage().download(path)` | Download → `byte[]` |
| `ctx.storage().exists(path)` | Check object |
| `ctx.llm().isAvailable()` | Whether an LLM provider is configured |
| `ctx.llm().infer(prompt)` | Call LLM, returns response String |
| `ctx.buildType()` | `"development"` / `"staging"` / `"production"` |

### Multi-tenancy in REST API plugins

Always read the org ID from the validated JWT — never from the request body.

```java
import eu.webrobot.api.security.OrganizationContextHelper;

@GET
@Path("/items")
public Response getItems(@Context HttpServletRequest req) {
    String orgId = OrganizationContextHelper.getOrganizationId(req);
    // use orgId for all DB queries
}
```

**Common mistake:** Passing a `Long` where `setOrganizationId` expects a `String`. Always convert: `String.valueOf(orgId)`.

---

## DB Migrations (Flyway)

Plugins manage their own schema with Flyway. SQL files live inside the JAR at the path declared in `manifest.json`.

File naming: `V{version}__{description}.sql` (two underscores).

```
src/main/resources/db/migration/my_plugin/
  V1__init.sql
  V2__add_confidence_column.sql
```

```sql
-- V1__init.sql
CREATE TABLE IF NOT EXISTS my_plugin_results (
    id          BIGSERIAL PRIMARY KEY,
    org_id      TEXT NOT NULL,
    ean         TEXT NOT NULL,
    result_data JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX my_plugin_results_org_ean_idx ON my_plugin_results (org_id, ean);
```

Migrations run automatically when the plugin is enabled or when the platform starts with a new plugin version.

---

## Jenkins CI/CD

The ETL repository ships a `Jenkinsfile` that handles build, ProGuard obfuscation, MinIO upload, and plugin DB registration. For partner plugins, configure a Jenkins pipeline with:

```groovy
environment {
    GITHUB_TOKEN = credentials('github-token')
    SKIP_OBFUSCATION = "false"        // set "true" for dev builds
    PLUGIN_ID = "my-etl-plugin"
}

stages {
    stage('Build') {
        steps {
            sh 'GITHUB_TOKEN=$GITHUB_TOKEN ./gradlew jar'
        }
    }
    stage('Upload') {
        steps {
            sh '''
              mc cp build/libs/${PLUGIN_ID}-*.jar \
                minio/plugins/${PLUGIN_ID}/latest.jar --insecure
            '''
        }
    }
    stage('Register') {
        steps {
            // POST to WebroBot API to update plugin JAR path in registry
            sh '''
              curl -X PUT ${WEBROBOT_API}/api/admin/plugins/${PLUGIN_ID} \
                -H "X-API-Key: ${WEBROBOT_API_KEY}" \
                -d '{"jarPath": "plugins/${PLUGIN_ID}/latest.jar"}'
            '''
        }
    }
}
```

---

## Common Pitfalls

**1. `Option[Double].orNull` compile error**

`Double` is a primitive and cannot be null. Box it to the Java wrapper:

```scala
// Wrong
val price: java.lang.Double = row.double("price").orNull

// Correct
val price: java.lang.Double = row.double("price").map(java.lang.Double.valueOf).orNull
```

**2. ResultSet closes across Spark partition boundaries**

`ctx.query(...)` returns a lazy `Iterator[WRow]` backed by an open JDBC `ResultSet`. Materialize eagerly before leaving the call site:

```scala
// Wrong — ResultSet closed before iterator is consumed
val rows = ctx.query("SELECT ...", Seq.empty)
someRdd.mapPartitions(_ => rows)

// Correct
val rows: List[WRow] = ctx.query("SELECT ...", Seq.empty).toList
```

**3. Stage name collisions**

Namespace your stage names with your plugin ID: `my_plugin_transform` not just `transform`.

**4. Multi-tenancy — org ID from JWT not from args**

Never trust the org ID from stage args or request body. Always read from `ctx.config("webrobot.org.id")` in ETL stages and from `OrganizationContextHelper.getOrganizationId(req)` in REST API endpoints.
