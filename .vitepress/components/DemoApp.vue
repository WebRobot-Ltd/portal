<template>
  <div class="demo-app">

    <!-- TEMP collaudo gate — soft password while the app is in final testing.
         Removed once everything is resolved. (Client-side only: a casual gate,
         not real security.) -->
    <div v-if="!demoUnlocked" class="demo-gate">
      <div class="demo-gate-box">
        <div class="demo-gate-title">🔒 Final testing phase</div>
        <p class="demo-gate-msg">This demo is in its final testing phase. Enter the password to continue.</p>
        <input v-model="demoGatePwd" type="password" class="text-input demo-gate-input"
               placeholder="Password" @keyup.enter="unlockDemo" />
        <button class="btn btn-primary" @click="unlockDemo">Enter</button>
        <p v-if="demoGateError" class="demo-gate-error">Wrong password.</p>
      </div>
    </div>

    <!-- Captcha / HITL notification bell. Pinned top-right of the demo
         pane. Counts active captcha blocks across any open or parked
         Camoufox sessions; click opens a dropdown that lets the user
         jump back into the mirror to resolve them. -->
    <div v-if="cmfBlockNotifications.length > 0" class="cmf-notif-bell-wrap">
      <button class="cmf-notif-bell" @click="cmfNotifOpen = !cmfNotifOpen"
              :title="cmfBlockNotifications.length + ' blocco/i in attesa di risoluzione'">
        🔔 <span class="cmf-notif-badge">{{ cmfBlockNotifications.length }}</span>
      </button>
      <div v-if="cmfNotifOpen" class="cmf-notif-dropdown" @click.stop>
        <div class="cmf-notif-header">
          🚨 Blocchi in attesa di risoluzione
          <button class="cmf-notif-close" @click="cmfNotifOpen = false">✕</button>
        </div>
        <div v-for="n in cmfBlockNotifications" :key="n.sid" class="cmf-notif-item">
          <div class="cmf-notif-meta">
            <strong>{{ n.kind }}</strong> · {{ shortHost(n.url) }}
            <span class="cmf-notif-since">· {{ relTime(n.since) }}</span>
          </div>
          <div class="cmf-notif-actions">
            <button class="btn btn-primary btn-sm" @click="openMirrorForBlock(n)">Apri mirror</button>
            <button class="btn btn-ghost btn-sm" @click="dismissBlockNotif(n.sid)">Ignora</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Scope banner: this demo runs on the Spark ETL subsystem.
         The Ray agentic runtime is live as of 2026-05-22 — point users
         to the dedicated /agentic page rather than crowd this one. -->
    <div class="scope-banner">
      ⚙️ This demo runs on the <strong>Apache Spark ETL subsystem</strong>.
      The agentic <strong>Ray</strong> runtime (multi-agent crews, adaptive
      pipelines, LLM oracle cascade) is now live &mdash; try it on the
      <a href="/agentic">Agentic Studio</a> page.
    </div>

    <!-- Sovereignty banner: where the workload physically runs.
         Important for EU GDPR-conscious users / B2B procurement. -->
    <div class="sovereignty-banner">
      🇪🇺 Everything you trigger here runs on a
      <strong>European, sovereign Kubernetes cluster</strong> hosted on
      <strong>Hetzner</strong> servers in the EU. Your data stays in
      Europe; no third-country processors are in the demo execution path.
      Object storage (MinIO), Trino, Spark, Camoufox browser pool and
      the API control plane all live in the same EU region.
    </div>

    <!-- Design banner: the pipeline programming model is intentionally
         a chain of stages rather than full structured programming —
         it's been shaped to be cheap for an LLM to author end-to-end.
         The higher-order agentic flow turns intent into a YAML pipeline. -->
    <div class="design-banner">
      🤖 The pipeline programming model is intentionally a
      <strong>chain of stages</strong>, not full structured programming —
      it's designed to be <strong>easy for an LLM to author</strong>
      end-to-end. Stages compose like UNIX pipes; arguments are flat
      maps or selectors. Higher-order
      <strong>agentic orchestration</strong> (with the right skills + planner)
      handles the intent-to-pipeline translation, so this YAML doesn't
      need to be state-of-the-art programming to do non-trivial work.
    </div>

    <!-- Perf banner: HTTP-only stages skip browser automation entirely
         and run dramatically faster + lighter on the cluster — pick
         them whenever the target site renders content server-side. -->
    <div class="perf-banner">
      ⚡ Prefer the HTTP-only stages — <strong>wget</strong>,
      <strong>wgetExplore</strong>, <strong>wgetJoin</strong> — when
      the target site lets you (server-rendered content, no JS-only
      pagination): they skip the entire browser automation layer and
      are <strong>significantly faster + cheaper</strong> on cluster
      resources. Use their <strong>visit*</strong> counterparts only
      when the page genuinely needs a JS-rendered DOM (single-page
      apps, infinite scroll, anti-bot challenge). Wikipedia, arXiv,
      GitHub README pages → wget; eBay search, Amazon detail pages →
      visit.
    </div>

    <!-- Section 1: Execute Existing Pipelines -->
    <div class="demo-section">
      <h2>📋 Execute Example Pipelines</h2>
      <p>Run publicly available ETL pipelines from our documentation. Preview limited to 5-10 records.</p>
      
      <div class="pipeline-selector-card">
        <div v-if="pipelinesError" class="error-content" style="margin-bottom: 1rem;">
          <p class="error-message">{{ pipelinesError }}</p>
          <button class="btn btn-secondary btn-sm" @click="loadPipelines" style="margin-top: 0.5rem;">
            Retry
          </button>
        </div>
        <div class="form-group">
          <label for="pipeline-selector">Select a Pipeline:</label>
          <div v-if="loadingPipelines" class="loading-state">
            <span class="loading-spinner"></span>
            <span>Loading pipelines...</span>
          </div>
          <select 
            v-else
            id="pipeline-selector" 
            v-model="selectedPipeline"
            @change="onPipelineSelected"
            class="pipeline-select"
            :disabled="availablePipelines.length === 0"
          >
            <option value="">-- Choose a pipeline --</option>
            <optgroup
              v-for="group in pipelinesByCategory"
              :key="group.category"
              :label="group.category"
            >
              <option
                v-for="pipeline in group.items"
                :key="pipeline.id"
                :value="pipeline.id"
              >
                {{ pipeline.isDraft ? '✏️ ' : '' }}{{ pipeline.name }}{{ pipeline.isDraft ? '  (draft)' : '' }}
              </option>
            </optgroup>
          </select>
          <p v-if="!loadingPipelines && availablePipelines.length === 0 && !pipelinesError" class="hint">
            No pipelines available. Please check backend connection.
          </p>
        </div>

        <div v-if="selectedPipelineInfo" class="pipeline-info">
          <h3>{{ selectedPipelineInfo.name }}</h3>
          <p class="pipeline-description">{{ selectedPipelineInfo.description }}</p>
          <div class="pipeline-meta">
            <span class="badge">Source: {{ selectedPipelineInfo.source }}</span>
            <span class="badge">Stages: {{ selectedPipelineInfo.stages }}</span>
            <a :href="selectedPipelineInfo.docLink" target="_blank" class="badge badge-link">
              View Documentation →
            </a>
          </div>
        </div>

        <!-- Execution mode (Shared Spark cluster vs. BYOC ephemeral
             Spark workers). Hetzner key collection + disclaimer +
             localStorage persistence + VM preset are all delegated
             to the shared component. context="etl" namespaces the
             storage key so a token saved here doesn't auto-fill the
             agentic demo (and vice-versa) — operators that want one
             token to rule them both can paste it in both places.
             The default preset on this page is "etl" (2 executors,
             0 brain) — Spark only, no agentic involved. -->
        <div v-if="selectedPipeline" class="exec-mode-wrap">
          <ByocModeSelector
            v-model:executionMode="executionMode"
            v-model:hetznerKey="hetznerKey"
            v-model:vmPreset="vmPreset"
            @update:vmCount="vmCount = $event"
            @update:vmRoles="vmRoles = $event"
            :disabled="isExecuting"
            context="etl"
          />
          <!-- HITL pause-on-captcha — when on, Spark pauses the row on
               captcha detection and waits for an operator to resolve
               the challenge in the mirror UI (via the 🔔 bell). When
               off (default) captcha hits fail the row fast and the
               pipeline continues with other items. -->
          <div class="hitl-opt-wrap">
            <label class="hitl-opt-label">
              <input type="checkbox" v-model="hitlAwait" :disabled="isExecuting">
              🤝 <strong>Pause on captcha for human review (HITL)</strong>
              <span class="hitl-opt-hint">If a row hits a captcha / WAF block, pause it and notify via the 🔔 bell instead of failing fast. Operator resolves in mirror → row resumes.</span>
            </label>
            <div v-if="hitlAwait" class="hitl-opt-timeout">
              <label>Wait up to
                <input type="number" min="1" max="30" v-model="hitlTimeoutMin"
                       :disabled="isExecuting"
                       class="text-input hitl-opt-timeout-input">
                minutes per block
              </label>
              <span class="hitl-opt-hint-small">After timeout the row fails and the pipeline continues.</span>
            </div>
          </div>
          <!-- Pipeline-level execution runtime. Metadata only for now — the
               executor reads metadata.runtime (Phase-4 elastic Ray); the flag
               just declares Spark-job vs Ray-actor intent in the YAML. -->
          <div class="hitl-opt-wrap">
            <label class="hitl-opt-label" style="display:flex;align-items:center;gap:8px;">
              ⚙️ <strong>Execution runtime</strong>
              <select v-model="wizRuntime" :disabled="isExecuting" class="text-input" style="width:auto;">
                <option value="spark">Spark job (default)</option>
                <option value="ray_actor">Ray actor</option>
              </select>
              <span class="hitl-opt-hint">Choose how the pipeline runs. <em>Ray actor</em> is recorded as <code>metadata.runtime</code> (dispatch lands with Phase-4 elastic Ray); Spark job is the current default.</span>
            </label>
            <p v-if="wizRuntime === 'ray_actor'" class="hitl-opt-hint" style="color:#b45309;margin-top:6px;">
              🚧 Ray actor runtime is under design (Phase-4) — not available yet. The pipeline records the choice but executes on Spark for now.
            </p>
          </div>
          <!-- Preferential geo zone: pins the residential proxy (DataImpulse)
               to a country at browser-session allocation. Emitted as
               metadata.geo → DATAIMPULSE_PROXY_COUNTRY on the runtime. -->
          <div class="hitl-opt-wrap">
            <label class="hitl-opt-label" style="display:flex;align-items:center;gap:8px;">
              🌍 <strong>Geo zone (proxy)</strong>
              <input v-model="geoSearch" :disabled="isExecuting" class="text-input" style="width:120px;" placeholder="filter country…" />
              <select v-model="wizGeo" :disabled="isExecuting" class="text-input" style="width:auto;" :size="geoSearch ? 6 : 1">
                <option v-for="z in geoOptions" :key="z.code" :value="z.code">{{ z.label }}</option>
              </select>
              <span class="hitl-opt-hint">Exit through residential IPs in this country (DataImpulse). <em>Auto</em> uses the global rotating pool. Applied per browser session via <code>metadata.geo</code>.</span>
            </label>
          </div>
        </div>

        <button
          class="btn btn-primary"
          :disabled="!selectedPipeline || isExecuting || (executionMode === 'byoc' && !hetznerKey)"
          @click="handleExecutePipeline"
        >
          <span v-if="isExecuting" class="loading-spinner"></span>
          {{ isExecuting ? 'Executing...' : 'Run Selected Pipeline' }}
        </button>
        
        <!-- Upload Dataset Modal (if pipeline requires input dataset) -->
        <div v-if="showUploadModal" class="modal-overlay" @click="closeUploadModal">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h3>Upload CSV Dataset</h3>
              <button class="modal-close" @click="closeUploadModal">&times;</button>
            </div>
            <div class="modal-body">
              <p v-if="selectedPipelineInfo && selectedPipelineInfo.csvFormatDescription" class="csv-format-hint">
                {{ selectedPipelineInfo.csvFormatDescription }}
              </p>
              <p v-else class="csv-format-hint">
                This pipeline requires a CSV input dataset. Please upload a CSV file matching the pipeline requirements.
              </p>
              
              <!-- Pipeline Stages Viewer -->
              <div v-if="selectedPipelineInfo && selectedPipelineInfo.stages && selectedPipelineInfo.stages.length > 0" class="pipeline-stages-section">
                <div class="stages-section-header">
                  <h4>Pipeline Stages ({{ selectedPipelineInfo.stages.length }})</h4>
                  <button 
                    class="btn btn-secondary btn-sm"
                    @click="showPipelineStages = !showPipelineStages"
                  >
                    {{ showPipelineStages ? '▼ Hide' : '▶ Show' }} Stages
                  </button>
                </div>
                <div v-if="showPipelineStages" class="stages-content">
                  <div v-for="(stage, index) in selectedPipelineInfo.stages" :key="index" class="stage-item">
                    <div class="stage-number">{{ index + 1 }}</div>
                    <div class="stage-details">
                      <div class="stage-name">
                        <strong>Stage:</strong> <code>{{ stage.stage }}</code>
                      </div>
                      <div v-if="stage.args" class="stage-args">
                        <strong>Args:</strong>
                        <pre class="code-block stage-args-block">{{ JSON.stringify(stage.args, null, 2) }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Pipeline YAML Viewer -->
              <div v-if="selectedPipelineInfo && selectedPipelineInfo.pipelineYaml" class="pipeline-yaml-section">
                <div class="yaml-section-header">
                  <h4>Pipeline YAML Configuration</h4>
                  <div class="yaml-section-actions">
                    <button
                      class="btn btn-secondary btn-sm"
                      @click="cloneToWizard"
                      title="Load this pipeline into the wizard editor below to customize and re-save"
                    >
                      🛠️ Edit in wizard
                    </button>
                    <button
                      class="btn btn-secondary btn-sm"
                      @click="copyPipelineYamlToClipboard"
                      title="Copy YAML to clipboard"
                    >
                      📋 Copy YAML
                    </button>
                    <button
                      class="btn btn-secondary btn-sm"
                      @click="showPipelineYaml = !showPipelineYaml"
                    >
                      {{ showPipelineYaml ? '▼ Hide' : '▶ Show' }} YAML
                    </button>
                  </div>
                </div>
                <div v-if="showPipelineYaml" class="yaml-content">
                  <pre class="code-block yaml-block">{{ selectedPipelineInfo.pipelineYaml }}</pre>
                </div>
              </div>
              
              <!-- CSV Input Mode Toggle -->
              <div class="form-group">
                <div class="input-mode-toggle">
                  <button
                    type="button"
                    class="toggle-btn"
                    :class="{ active: csvInputMode === 'none' }"
                    @click="csvInputMode = 'none'"
                    title="Pipelines whose first stage is a literal wget/fetch (e.g. Wikipedia, HN) don't need a real CSV — a 1-row trigger dataset is auto-attached so PipelineParser's load_csv injection has something to consume."
                  >
                    🚀 No dataset (auto-trigger)
                  </button>
                  <button
                    type="button"
                    class="toggle-btn"
                    :class="{ active: csvInputMode === 'file' }"
                    @click="csvInputMode = 'file'"
                  >
                    📁 Upload File
                  </button>
                  <button
                    type="button"
                    class="toggle-btn"
                    :class="{ active: csvInputMode === 'manual' }"
                    @click="csvInputMode = 'manual'"
                  >
                    ✏️ Manual Entry
                  </button>
                </div>
              </div>

              <!-- No-dataset mode: explain what the auto-trigger does -->
              <div v-if="csvInputMode === 'none'" class="form-group no-dataset-info">
                <p class="input-hint">
                  Selected pipelines that seed from a literal URL (Wikipedia, HN,
                  arXiv, ECB, …) don't need user CSV input. A minimal one-row
                  trigger CSV will be auto-uploaded so the pipeline framework's
                  <code>load_csv</code> stage has a row to fan-out from.
                </p>
                <pre class="csv-preview-text">trigger
go</pre>
              </div>
              
              <!-- File Upload Input -->
              <div v-if="csvInputMode === 'file'" class="form-group">
                <label for="demo-csv-file-modal">CSV File:</label>
                <input 
                  type="file"
                  id="demo-csv-file-modal"
                  accept=".csv"
                  @change="handleDemoFileSelect"
                  class="file-input"
                />
                <p v-if="demoUploadFile" class="file-name">{{ demoUploadFile.name }}</p>
                <p class="input-hint">Select a CSV file from your computer</p>
              </div>
              
              <!-- Manual CSV Entry -->
              <div v-if="csvInputMode === 'manual'" class="form-group">
                <label for="demo-csv-text">CSV Data:</label>
                <textarea
                  id="demo-csv-text"
                  v-model="demoCsvText"
                  placeholder="Enter CSV data here, e.g.&#10;url&#10;https://example.com/page1&#10;https://example.com/page2"
                  class="csv-textarea"
                  rows="8"
                ></textarea>
                <p class="input-hint">Enter CSV data directly. First line should be headers (e.g., "url")</p>
                <div v-if="demoCsvText" class="csv-preview">
                  <strong>Preview ({{ getCsvRowCount(demoCsvText) }} rows):</strong>
                  <pre class="csv-preview-text">{{ demoCsvText.split('\n').slice(0, 5).join('\n') }}{{ demoCsvText.split('\n').length > 5 ? '\n...' : '' }}</pre>
                </div>
              </div>

              <div v-if="demoUploadError" class="error-content">
                <p class="error-message">{{ demoUploadError }}</p>
              </div>

              <div v-if="demoUploadResult" class="upload-result">
                <p class="success-message">✅ Dataset uploaded successfully!</p>
                <p><strong>Dataset ID:</strong> {{ demoUploadResult.datasetId }}</p>
                <p><strong>Dataset Name:</strong> {{ demoUploadResult.datasetName }}</p>
              </div>
            </div>
            <div class="modal-footer">
              <button 
                class="btn btn-secondary"
                @click="closeUploadModal"
              >
                Cancel
              </button>
              <button
                class="btn btn-primary"
                :disabled="(csvInputMode === 'file' && !demoUploadFile) || (csvInputMode === 'manual' && !demoCsvText.trim()) || isUploadingDemoDataset"
                @click="uploadAndExecute"
              >
                <span v-if="isUploadingDemoDataset" class="loading-spinner"></span>
                {{ isUploadingDemoDataset
                    ? (csvInputMode === 'none' ? 'Preparing trigger dataset…' : 'Uploading…')
                    : (demoUploadResult
                        ? 'Execute Pipeline'
                        : (csvInputMode === 'none' ? 'Run with auto-trigger' : 'Upload & Execute')) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Execution Results -->
      <div v-if="executionResult" class="results-card">
        <div class="results-header">
          <h3>Execution Results</h3>
          <span :class="['status-badge', executionResult.status]">
            {{ executionResult.status }}
          </span>
        </div>
        <div v-if="executionResult.status === 'success' || executionResult.status === 'SUBMITTED'" class="results-content">
          <div class="result-stats">
            <div class="stat-item">
              <span class="stat-label">Records Processed:</span>
              <span class="stat-value">{{ executionResult.recordsProcessed }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Execution Time:</span>
              <span class="stat-value">{{ executionResult.executionTime }}s</span>
            </div>
            <div v-if="executionResult.outputDatasetId" class="stat-item">
              <span class="stat-label">Output Dataset:</span>
              <span class="stat-value">#{{ executionResult.outputDatasetId }}</span>
            </div>
          </div>
          <div v-if="executionResult.polling" class="polling-banner">
            <span class="polling-spinner">⏳</span>
            {{ executionResult.pollingMessage || 'Waiting for Spark job to finish…' }}
          </div>
          <div v-else-if="executionResult.pollingMessage" class="polling-banner polling-done">
            {{ executionResult.pollingMessage }}
          </div>
          <!--
            The old `<pre>{{ formatPreview(executionResult.preview) }}</pre>`
            block lived here. Removed: the Execution-status panel below
            now renders the same data as a proper HTML table from
            `outputPreview` (polled via /demo/executions/<eid>/output).
            Showing both was redundant.
          -->
        </div>
        <div v-else-if="executionResult.status === 'error'" class="error-content">
          <p class="error-message">{{ executionResult.error }}</p>
        </div>
      </div>
    </div>

    <!-- Live execution panel — status + log tail + output preview.
         Visible whenever there is a known execution_id (fresh from submit
         OR restored from localStorage on page reload — "reattach"). -->
    <div v-if="executionState" class="demo-section exec-panel" ref="execPanelEl">
      <div class="exec-panel-header">
        <h2>⏱️ Execution status</h2>
        <div class="exec-panel-actions">
          <button class="btn btn-secondary btn-sm" @click="refreshExecutionPanel">Refresh</button>
          <button v-if="isExecutionRunning" class="btn btn-danger btn-sm" @click="cancelCurrentExecution">Cancel</button>
          <button class="btn btn-ghost btn-sm" @click="detachExecution">Forget run</button>
        </div>
      </div>

      <div class="exec-summary">
        <div><strong>Pipeline:</strong> {{ executionState.pipeline_name || '—' }}</div>
        <div v-if="statusData">
          <strong>Status:</strong>
          <span class="status-pill" :style="{ background: statusBadgeColor }">{{ statusData.status || '—' }}</span>
          <span v-if="statusData.duration_seconds != null"> · <strong>Duration:</strong> {{ statusData.duration_seconds }}s</span>
          <span v-if="statusData.records_output != null"> · <strong>Records out:</strong> {{ statusData.records_output }}</span>
          <span v-else-if="statusData.records_processed != null"> · <strong>Records processed:</strong> {{ statusData.records_processed }}</span>
        </div>

        <!-- Phased "what is happening NOW" panel. While the cluster is
             coming up (image pulls, executor scheduling) the DB-level
             status is just "SUBMITTED" for a minute — without this
             panel the user thinks nothing is happening. -->
        <div v-if="statusData && !isExecutionTerminal" class="exec-phase">
          <div class="exec-phase-row">
            <span class="exec-phase-spinner" v-if="phaseShowSpinner"></span>
            <span class="exec-phase-icon" v-else>{{ phaseIcon }}</span>
            <strong class="exec-phase-label">{{ phaseLabel }}</strong>
            <span class="exec-phase-detail">{{ phaseDetail }}</span>
          </div>
          <div v-if="statusData.driver || (statusData.executors && statusData.executors.length)" class="exec-phase-pods">
            <div v-if="statusData.driver">
              Driver:
              <span :class="['exec-phase-pill', statusData.driver.ready ? 'ready' : 'pending']">
                {{ statusData.driver.ready ? '✓ ready' : (statusData.driver.reason || statusData.driver.phase) }}
              </span>
              <span v-if="statusData.driver.node" class="exec-phase-node">on {{ statusData.driver.node }}</span>
            </div>
            <div v-if="statusData.executors && statusData.executors.length">
              Executors:
              <span class="exec-phase-pill" :class="(statusData.executors_ready === statusData.executors_total) ? 'ready' : 'pending'">
                {{ statusData.executors_ready }}/{{ statusData.executors_total }} ready
              </span>
              <span v-if="executorImagePullingNode" class="exec-phase-detail">
                · pulling image on {{ executorImagePullingNode }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="statusData && statusData.error_message" class="exec-error">
          <strong>Error:</strong> <code>{{ statusData.error_message.slice(0, 600) }}</code>
        </div>
      </div>

      <!-- Output preview table — appears when run is terminal + successful. -->
      <div v-if="outputPreview" class="exec-output">
        <h3>📊 Output preview</h3>
        <div class="exec-output-meta">
          Format: {{ outputPreview.format || 'unknown' }} ·
          {{ (outputPreview.rows || []).length }} rows{{ outputPreview.truncated ? ' (truncated to 10)' : '' }}
          <span v-if="outputPreview.note"> — {{ outputPreview.note }}</span>
        </div>
        <div v-if="outputPreview.columns && outputPreview.columns.length && outputPreview.rows && outputPreview.rows.length" class="exec-output-table-wrap">
          <table class="exec-output-table">
            <thead>
              <tr>
                <th v-for="col in outputPreview.columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in outputPreview.rows" :key="ri">
                <td v-for="(col, ci) in outputPreview.columns" :key="ci">
                  {{ (row[ci] == null ? '' : String(row[ci])).slice(0, 200) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="exec-output-empty">(no rows yet)</div>
      </div>

      <!-- Spark log viewer — driver + every allocated executor.
           Sanitized server-side (DemoLogSanitizer drops s3:// /
           *.svc.cluster.local / pod=… lines and rewrites internal
           classpaths) and re-masked client-side as defense-in-depth.
           Pod names themselves NEVER reach the browser; the executor
           dropdown is populated from numeric indices the server
           extracted from Loki labels. -->
      <div class="exec-logs-panel">
        <div class="exec-logs-controls">
          <h3 class="exec-logs-title">📜 Spark logs — sanitized</h3>
          <select v-model="logsPodType" class="text-input text-input-sm" @change="onLogsPodTypeChange">
            <option value="driver">Driver</option>
            <option value="executor">Executor</option>
          </select>
          <select
            v-if="logsPodType === 'executor'"
            v-model.number="logsExecutorIndex"
            class="text-input text-input-sm"
            :disabled="!logsExecutors.length"
            @change="pollLogsOnce"
          >
            <option :value="null">
              {{ logsExecutors.length ? 'All executors (first)' : 'Waiting for executors…' }}
            </option>
            <option v-for="idx in logsExecutors" :key="idx" :value="idx">Executor {{ idx }}</option>
          </select>
          <select v-model.number="logsTail" class="text-input text-input-sm" @change="pollLogsOnce">
            <option :value="50">Last 50</option>
            <option :value="200">Last 200</option>
            <option :value="500">Last 500</option>
            <option :value="1000">Last 1000</option>
            <option :value="5000">Last 5000</option>
            <option :value="100000">All rows</option>
          </select>
          <label class="exec-logs-checkbox" title="Re-fetch every 8s while the run is active">
            <input type="checkbox" v-model="logsAutoRefresh" @change="onLogsAutoRefreshToggle" />
            Auto-refresh
          </label>
          <button class="btn btn-secondary btn-sm" @click="pollLogsOnce">Refresh</button>
        </div>
        <div v-if="logsLines.length === 0" class="exec-logs-empty">
          (no logs yet — Spark {{ logsPodType }} hasn't emitted lines for this filter)
        </div>
        <div v-else class="exec-logs-stream">
          <div v-for="(line, i) in logsLines" :key="i" :class="['exec-logs-line', 'level-' + line.level.toLowerCase()]">
            <span v-if="line.timestamp" class="exec-logs-ts">{{ line.timestamp }}</span>
            <span class="exec-logs-level">[{{ line.level }}]</span>
            <span class="exec-logs-msg">{{ line.message }}</span>
          </div>
        </div>
        <div class="exec-logs-footer">
          Showing <strong>{{ logsPodType }}</strong>
          <span v-if="logsPodType === 'executor' && logsExecutorIndex !== null"> #{{ logsExecutorIndex }}</span>
          · {{ logsLines.length }} line(s) · server-side + client-side sanitized
        </div>
      </div>
    </div>

    <!-- Section 2: Build your pipeline — CLI-style wizard (catalog +
         editor + YAML preview). Replaces the old NL→full-YAML generator;
         no API key required, no LLM call from the UI, every stage chosen
         explicitly by the user from the live Strapi catalog. -->
    <div class="demo-section">
      <h2>🛠️ Build your pipeline</h2>
      <p>
        Pick stages from the live catalog and assemble them step by step — same shape as
        <code>webrobot pipeline add-stage</code> on the CLI. No black-box generation.
      </p>

      <div class="wizard-card">
        <div class="wizard-meta">
          <div class="form-group">
            <label for="wiz-pipeline-name">Pipeline name:</label>
            <input id="wiz-pipeline-name" v-model="wizPipelineName" type="text" class="text-input" placeholder="e.g. my-books-scraper" />
          </div>
          <div class="form-group">
            <label for="wiz-intent">Intent (optional, used by ✨ Suggest):</label>
            <div class="wizard-intent-row">
              <input
                id="wiz-intent"
                v-model="wizIntent"
                type="text"
                class="text-input"
                placeholder="e.g. scrape product cards from a static catalog"
                @keyup.enter="wizardSuggestFromIntent"
              />
              <button
                class="btn btn-secondary btn-sm wizard-suggest-btn"
                :disabled="wizSuggesterLoading || !wizIntent.trim()"
                @click="wizardSuggestFromIntent"
                title="Ask the server LLM to pick relevant stages from the live catalog"
              >
                <span v-if="wizSuggesterLoading" class="loading-spinner"></span>
                {{ wizSuggesterLoading ? 'Thinking…' : '✨ Suggest' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Suggested-pipeline panel: appears after a successful ✨ Suggest.
             Shows the LLM's ordered choice as a chain of clickable chips,
             plus an "Add all" shortcut. Adding is still per-click /
             per-batch — never auto-applied. -->
        <div v-if="wizSuggested.length || wizSuggesterError" class="wizard-suggested">
          <div v-if="wizSuggesterError" class="wizard-suggested-err">{{ wizSuggesterError }}</div>
          <template v-else>
            <div class="wizard-suggested-head">
              <strong>💡 AI suggested pipeline:</strong>
              <button class="btn btn-primary btn-sm" @click="addAllSuggested">Add all →</button>
            </div>
            <div class="wizard-suggested-chain">
              <template v-for="(name, i) in wizSuggested" :key="i">
                <button class="wizard-chip wizard-chip-ai" @click="addStageToPipeline(name)" :title="'Add ' + name">
                  ⭐ {{ name }}
                </button>
                <span v-if="i < wizSuggested.length - 1" class="wizard-suggested-arrow">→</span>
              </template>
            </div>
            <div class="wizard-suggested-hint">click a chip to add just that stage, or use Add all.</div>
          </template>
        </div>

        <!-- Mobile-only tab bar: on phones the two panes stack and get
             cramped + double-scroll. Show one full-width pane at a time. -->
        <div class="wizard-mobile-tabs">
          <button :class="['wizard-mtab', wizMobilePane === 'catalog' && 'active']"
                  @click="wizMobilePane = 'catalog'">📚 Catalogo</button>
          <button :class="['wizard-mtab', wizMobilePane === 'editor' && 'active']"
                  @click="wizMobilePane = 'editor'">🧩 Pipeline ({{ wizPipeline.length }})</button>
        </div>
        <div class="wizard-cols">
          <!-- Catalog browser -->
          <div class="wizard-pane" :class="{ 'wiz-pane-hidden-mobile': wizMobilePane !== 'catalog' }">
            <h4>📚 Stage catalog</h4>
            <div class="wizard-filters">
              <select v-model="wizPluginFilter" class="text-input">
                <option value="">All plugins</option>
                <option v-for="p in wizPluginIds" :key="p" :value="p">{{ p }}</option>
              </select>
              <input v-model="wizSearch" type="text" class="text-input" placeholder="Search…" />
            </div>
            <div class="wizard-catalog-list">
              <div v-if="wizFilteredCatalog.length === 0" class="wizard-empty">no stages match the filters</div>
              <!-- Grouped by category so the user can scan stages by
                   pipeline phase (Sources → Crawling → Extraction →
                   Transformation → Analytics → Sinks). The order
                   inside CATEGORY_ORDER matches typical pipeline flow. -->
              <template v-for="g in wizCatalogByCategory" :key="g.category">
                <div class="wizard-catalog-group-head">{{ g.label }} <span class="wizard-catalog-group-count">{{ g.items.length }}</span></div>
                <div
                  v-for="s in g.items"
                  :key="s.id"
                  class="wizard-catalog-row"
                  :title="'Click to append to your pipeline'"
                  @click="addStageToPipeline(s.stage_name)"
                >
                  <div class="wizard-catalog-row-top">
                    <strong>{{ s.stage_name }}</strong>
                    <span class="wizard-catalog-row-tag">{{ s.plugin_id || '' }} · {{ s.plugin_type || '' }}</span>
                  </div>
                  <div class="wizard-catalog-row-desc">{{ (s.description || '').slice(0, 120) }}</div>
                </div>
              </template>
            </div>
          </div>

          <!-- Pipeline editor -->
          <div class="wizard-pane" :class="{ 'wiz-pane-hidden-mobile': wizMobilePane !== 'editor' }">
            <h4>🧩 Pipeline</h4>
            <div class="wizard-editor">
              <div v-if="wizPipeline.length === 0" class="wizard-empty-state">
                <div>empty — click a stage in the catalog to add it.</div>
                <div v-if="starterSuggestions().length" class="wizard-chips">
                  <span class="wizard-chips-label">Try a starting stage:</span>
                  <button
                    v-for="n in starterSuggestions()"
                    :key="n"
                    class="wizard-chip"
                    @click="addStageToPipeline(n)"
                  >{{ n }}</button>
                </div>
              </div>
              <div v-for="(row, idx) in wizPipeline" :key="idx" class="wizard-editor-row">
                <div class="wizard-editor-row-head">
                  <strong>
                    {{ idx + 1 }}. {{ row.stage }}
                    <span v-if="row._trace && row._trace.length" class="wizard-trace-badge" :title="row._trace.length + ' actions in trace'">
                      🎬 {{ row._trace.length }}
                    </span>
                  </strong>
                  <div class="wizard-editor-row-actions">
                    <button class="btn btn-ghost btn-xs" :disabled="idx === 0" @click="moveStage(idx, -1)">↑</button>
                    <button class="btn btn-ghost btn-xs" :disabled="idx === wizPipeline.length - 1" @click="moveStage(idx, 1)">↓</button>
                    <!-- ⏺ trace recorder doesn't make sense on extract /
                         flatSelect: those stages don't emit a trace:
                         block, the user only ever interacts with them
                         through the structured fields editor below
                         (🎯 Pick fields / 🪄 AI suggest fields). Hide
                         it there to keep the row uncluttered. -->
                    <button v-if="!isStructuredFieldsStage(row.stage) && !(row.stage === 'oddsSelect' || row.stage === 'odds_select')"
                            class="btn btn-secondary btn-xs"
                            @click="openTraceRecorder(idx)"
                            title="Record a sequence of click/type/scroll actions to run as this stage's trace">⏺</button>
                    <button class="btn btn-danger btn-xs" @click="removeStage(idx)">✕</button>
                  </div>
                </div>

                <!-- Structured editor for extract / flatSelect — both
                     consume a list of {selector, as, method} field maps.
                     For flatSelect the `selector` arg above (the segment
                     container) is filled via the normal arg path. -->
                <div v-if="isStructuredFieldsStage(row.stage)" class="wizard-fields-block">
                  <div class="wizard-fields-head">
                    <strong>📋 Fields ({{ (row._fields || []).length }})</strong>
                    <div class="wizard-fields-actions">
                      <button class="btn btn-secondary btn-xs"
                              :disabled="!flatSelectSegmentReady(row)"
                              :title="flatSelectSegmentReady(row)
                                ? (row.stage === 'flatSelect'
                                    ? 'Open the picker. Click each field INSIDE one row — selectors are computed relative to the segment so they apply to every matched row. All rows highlight in real time.'
                                    : 'Open the picker. Click each field on the page — each click adds a new row to the fields table. Keep clicking until you have every field you want.')
                                : 'flatSelect: set the row selector (segmentSelector/selector) below first, then come back here for the fields'"
                              @click="openMultiFieldPicker(idx)">🎯 Pick fields</button>
                      <button class="btn btn-primary btn-xs"
                              :disabled="!flatSelectSegmentReady(row)"
                              :title="flatSelectSegmentReady(row)
                                ? 'Open the picker and describe the fields you want — LLM fills the table'
                                : 'flatSelect: set the row selector first'"
                              @click="openAiSuggestFields(idx)">🪄 AI suggest fields</button>
                      <button class="btn btn-secondary btn-xs"
                              :disabled="suggestNamesLoading || !(row._fields && row._fields.length)"
                              :title="(row._fields && row._fields.length) ? 'Ask the LLM to propose snake_case column names from the samples you picked' : 'Pick some fields first'"
                              @click="suggestFieldNames(idx)">
                        <span v-if="suggestNamesLoading" class="loading-spinner"></span>
                        🪄 Suggest names
                      </button>
                      <button class="btn btn-ghost btn-xs"
                              :disabled="!flatSelectSegmentReady(row)"
                              :title="flatSelectSegmentReady(row) ? 'Add an empty field row' : 'flatSelect: set the row selector first'"
                              @click="addField(idx)">+ Add empty</button>
                    </div>
                  </div>
                  <!-- flatSelect 2-step flow guard: the field selectors below
                       are RELATIVE to the row segment, so picking fields
                       before the segment selector is set produces selectors
                       that don't resolve at runtime. Surface this loudly. -->
                  <div v-if="row.stage === 'flatSelect' && !flatSelectSegmentReady(row)"
                       class="wizard-fields-warn">
                    ⚠️ <strong>Set the row selector first</strong>
                    ({{ flatSelectSegmentArgName(row) }}) below — the field selectors
                    in this table will be relative to each matched row. Without a
                    valid segment selector, "Pick fields" and "AI suggest" are disabled.
                  </div>
                  <table v-if="(row._fields || []).length" class="wizard-fields-table">
                    <thead>
                      <tr><th></th><th>as (column)</th><th>method</th><th>selector</th><th>sample</th><th></th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="(f, fIdx) in row._fields" :key="fIdx">
                        <td><span class="wizard-field-dot" :style="{background: f._color || '#bbb'}"></span></td>
                        <td><input type="text" class="text-input" :value="f.as" @input="updateFieldProp(idx, fIdx, 'as', $event.target.value)" placeholder="column"></td>
                        <td>
                          <select class="text-input" :value="f.method" @change="updateFieldProp(idx, fIdx, 'method', $event.target.value)"
                                  :title="f._attrs && f._attrs.length ? 'Attributes available on the picked element' : 'Pick the field to load its real attributes'">
                            <option v-for="m in fieldMethodOptions(f)" :key="m.value" :value="m.value">{{ m.label }}</option>
                          </select>
                          <!-- Discoverable one-click chips for the picked element's
                               attributes + key resolvers — so the user sees what's
                               extractable without digging into the dropdown. -->
                          <div v-if="f._attrs && f._attrs.length" class="wizard-attr-chips">
                            <button :class="['wizard-attr-chip', f.method === 'text' && 'active']"
                                    @click="updateFieldProp(idx, fIdx, 'method', 'text')" title="visible text">text</button>
                            <button :class="['wizard-attr-chip', f.method === 'boilerPipe' && 'active']"
                                    @click="updateFieldProp(idx, fIdx, 'method', 'boilerPipe')" title="main article text (boilerplate removed)">article</button>
                            <button v-for="a in f._attrs" :key="a"
                                    :class="['wizard-attr-chip', f.method === ('attr(' + a + ')') && 'active']"
                                    @click="updateFieldProp(idx, fIdx, 'method', 'attr(' + a + ')')"
                                    :title="'attr(' + a + ')'">{{ a }}</button>
                          </div>
                        </td>
                        <td>
                          <div class="wizard-arg-input-row">
                            <input type="text" class="text-input" :value="f.selector" @input="updateFieldProp(idx, fIdx, 'selector', $event.target.value)" placeholder="CSS selector">
                            <button class="btn btn-secondary btn-xs" @click="openFieldPicker(idx, fIdx)">🎯</button>
                          </div>
                        </td>
                        <td class="wizard-field-sample" :title="f._sample">{{ (f._sample || '').slice(0, 40) }}</td>
                        <td><button class="btn btn-danger btn-xs" @click="removeField(idx, fIdx)">✕</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- oddsSelect: deterministic multi-market odds extractor.
                     One box per market (lazy-loaded markets each have their
                     own structure), AI magic infers selection/odds/line, the
                     operator ticks the subset to extract. -->
                <div v-if="row.stage === 'oddsSelect' || row.stage === 'odds_select'" class="wizard-fields-block">
                  <div class="wizard-fields-head">
                    <strong>🎰 Markets ({{ (row._markets || []).filter(m => m.enabled !== false).length }}/{{ (row._markets || []).length }} enabled)</strong>
                    <div class="wizard-fields-actions">
                      <button class="btn btn-secondary btn-xs"
                              :disabled="!pickerLoadedUrl"
                              :title="pickerLoadedUrl ? 'Click ONE market block on the page (scroll/expand first to lazy-load the markets you want)' : 'Load the bookmaker page in the picker first'"
                              @click="addMarketBoxPick(idx)">📦 Add market (pick box)</button>
                    </div>
                  </div>
                  <div v-if="!pickerLoadedUrl" class="wizard-fields-warn">
                    ⚠️ Load the bookmaker page in the picker, scroll/expand to lazy-load the markets, then pick one box per market.
                  </div>
                  <div v-if="!(row._markets || []).length" class="wizard-empty">
                    No markets yet — pick one box per market; AI infers the selection/odds structure for each, you confirm and tick the subset.
                  </div>
                  <div v-for="(m, mi) in (row._markets || [])" :key="mi"
                       class="wizard-market-card" :class="{ 'wizard-market-off': m.enabled === false }">
                    <div class="wizard-market-head">
                      <label class="wizard-market-enable" title="Include this market in the extraction (the tick IS the subset selector)">
                        <input type="checkbox" :checked="m.enabled !== false" @change="toggleMarketEnabled(idx, mi, $event.target.checked)"> include
                      </label>
                      <input type="text" class="text-input wizard-market-label" :value="m.label"
                             placeholder="market label (→ market_type)"
                             @input="updateMarketProp(idx, mi, 'label', $event.target.value)">
                      <button class="btn btn-primary btn-xs"
                              :disabled="oddsInferKey === (idx + ':' + mi)"
                              title="Re-run AI structure inference for this market"
                              @click="inferMarketStructure(idx, mi)">
                        <span v-if="oddsInferKey === (idx + ':' + mi)" class="loading-spinner"></span> 🪄 Infer
                      </button>
                      <button class="btn btn-danger btn-xs" title="Remove market" @click="removeMarket(idx, mi)">✕</button>
                    </div>
                    <div class="wizard-arg-input-row" style="gap:8px;flex-wrap:wrap;margin:4px 0;">
                      <input type="text" class="text-input" style="flex:1;min-width:160px;" :value="m.sectionSelector"
                             placeholder="section selector (market block)"
                             @input="updateMarketProp(idx, mi, 'sectionSelector', $event.target.value)">
                      <input type="text" class="text-input" style="flex:1;min-width:160px;" :value="m.rowSelector"
                             placeholder="row selector (outcome, relative to section)"
                             @input="updateMarketProp(idx, mi, 'rowSelector', $event.target.value)">
                    </div>
                    <table v-if="(m.fields || []).length" class="wizard-fields-table">
                      <thead><tr><th>role (as)</th><th>method</th><th>selector (relative to row)</th><th></th></tr></thead>
                      <tbody>
                        <tr v-for="(f, fi) in m.fields" :key="fi">
                          <td><input type="text" class="text-input" :value="f.as" :list="'odds-roles-' + idx"
                                     :title="f._why || ''"
                                     @input="updateMarketField(idx, mi, fi, 'as', $event.target.value)"></td>
                          <td><input type="text" class="text-input" :value="f.method" placeholder="text"
                                     @input="updateMarketField(idx, mi, fi, 'method', $event.target.value)"></td>
                          <td><input type="text" class="text-input" :value="f.selector" placeholder="relative selector"
                                     @input="updateMarketField(idx, mi, fi, 'selector', $event.target.value)"></td>
                          <td><button class="btn btn-danger btn-xs" @click="removeMarketField(idx, mi, fi)">✕</button></td>
                        </tr>
                      </tbody>
                    </table>
                    <button class="btn btn-ghost btn-xs" @click="addMarketField(idx, mi)">+ Add field</button>
                    <datalist :id="'odds-roles-' + idx">
                      <option v-for="r in ODDS_FIELD_ROLES" :key="r" :value="r"></option>
                    </datalist>
                  </div>
                </div>

                <div v-if="!(row.stage === 'oddsSelect' || row.stage === 'odds_select') && (findStageSpec(row.stage) && findStageSpec(row.stage).arg_schema || []).length === 0" class="wizard-empty">
                  no args defined for this stage
                </div>
                <div
                  v-for="a in ((row.stage === 'oddsSelect' || row.stage === 'odds_select') ? [] : (findStageSpec(row.stage) && findStageSpec(row.stage).arg_schema || []))"
                  :key="a.name"
                  v-show="!isFieldsListArg(a)"
                  class="wizard-editor-arg"
                >
                  <label :title="a.description || ''">
                    <strong>{{ a.name }}</strong><span v-if="a.required" class="wizard-arg-required" title="required">*</span>
                    <span class="wizard-arg-type">({{ a.type || 'any' }})</span>
                    <span v-if="a.description" class="wizard-arg-desc">— {{ a.description }}</span>
                  </label>
                  <div class="wizard-arg-input-row">
                    <input
                      type="text"
                      :value="row.args[a.name] != null ? row.args[a.name] : ''"
                      :placeholder="argPlaceholder(a)"
                      :list="isFieldNameArg(a) && upstreamFieldNames(idx).length ? ('wizfielddl-' + idx + '-' + a.name) : null"
                      :class="['text-input', 'wizard-arg-input', wizShowFieldErrors && a.required && (row.args[a.name] == null || String(row.args[a.name]).trim() === '') ? 'wizard-arg-missing' : '']"
                      @input="updateStageArg(idx, a.name, $event.target.value)"
                    />
                    <!-- Suggest the columns produced by upstream extract/
                         flatSelect so the user can pick an existing field
                         (e.g. sentiment.textField) instead of retyping it.
                         datalist keeps free-text for defaults like "message". -->
                    <datalist
                      v-if="isFieldNameArg(a) && upstreamFieldNames(idx).length"
                      :id="'wizfielddl-' + idx + '-' + a.name"
                    >
                      <option v-for="fn in upstreamFieldNames(idx)" :key="fn" :value="fn"></option>
                    </datalist>
                    <button
                      v-if="isSelectorArg(a)"
                      class="btn btn-secondary btn-xs wizard-pick-btn"
                      :title="pickModeFor(row.stage) === 'multi-sample'
                        ? 'Click 2+ examples of the repeating link/card you want to follow (different product cards, pagination items, …). The picker intersects them and produces a CSS selector that matches every sibling.'
                        : 'Open the page in the picker and click an element to get a CSS selector'"
                      @click="openPicker(idx, a.name, pickModeFor(row.stage))"
                    >🎯 {{ pickModeFor(row.stage) === 'multi-sample' ? 'Pick (multi)' : 'Pick' }}</button>
                  </div>
                  <!-- One-click selection of a column already produced by an
                       upstream extract/flatSelect. Facilitates field-name args
                       (sentiment.textField, aggregatesentiment.groupField) so
                       the user doesn't retype a field they already defined. -->
                  <div v-if="isFieldNameArg(a) && upstreamFieldNames(idx).length" class="wizard-field-chips">
                    <span class="wizard-field-chips-label">fields:</span>
                    <button
                      v-for="fn in upstreamFieldNames(idx)"
                      :key="fn"
                      type="button"
                      :class="['wizard-field-chip', String(row.args[a.name] || '') === fn ? 'active' : '']"
                      :title="'Use the upstream field &quot;' + fn + '&quot;'"
                      @click="updateStageArg(idx, a.name, fn)"
                    >{{ fn }}</button>
                  </div>
                </div>
                <!-- Recorded trace inline preview. Shows every action the
                     user saved into this stage's trace, so they can sanity-
                     check the sequence without scrolling to the YAML pane
                     at the bottom. Each row has an X to delete the action
                     individually — full re-recording goes through the ⏺
                     button as before. Hidden on extract / flatSelect since
                     those don't emit a trace: block in the YAML anyway. -->
                <div v-if="row._trace && row._trace.length && !isStructuredFieldsStage(row.stage)" class="wizard-trace-block">
                  <div class="wizard-trace-head">
                    <strong>🎬 trace ({{ row._trace.length }})</strong>
                    <button class="btn btn-ghost btn-xs" title="Drop all recorded actions from this stage" @click="clearStageTrace(idx)">Clear all</button>
                  </div>
                  <ul class="wizard-trace-list">
                    <li v-for="(a, ai) in row._trace" :key="ai" class="wizard-trace-action">
                      <code>{{ formatTraceAction(a) }}</code>
                      <button class="btn btn-ghost btn-xs wizard-trace-del" title="Remove just this action" @click="removeTraceAction(idx, ai)">✕</button>
                    </li>
                  </ul>
                </div>
                <div v-if="suggestionsFor(row.stage).length" class="wizard-chips">
                  <span class="wizard-chips-label">Try next:</span>
                  <button
                    v-for="n in suggestionsFor(row.stage)"
                    :key="n"
                    class="wizard-chip"
                    @click="addStageToPipeline(n)"
                  >{{ n }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Python post-processing block. Visually segregated FROM the
             stage list above: these are DataFrame-level transformations
             that always run AFTER all RDD-based stages — the runtime
             expects them in the top-level `python_extensions.stages:`
             YAML key, NOT as pipeline entries. The wizard auto-appends
             a `python_<type>:<name>` reference at the end of the
             pipeline[] array when emitting YAML. -->
        <div class="wizard-python-block">
          <div class="wizard-python-head">
            <strong>🐍 Python post-processing</strong>
            <span class="wizard-python-hint">
              DataFrame transformations applied AFTER the pipeline. Always last — they consume the assembled DF, not the row stream.
            </span>
            <button class="btn btn-secondary btn-xs" @click="addPythonExtension('row_transform')">+ row_transform</button>
            <button class="btn btn-secondary btn-xs" @click="addPythonExtension('dataframe_transform')">+ dataframe_transform</button>
            <button class="btn btn-secondary btn-xs" @click="addPythonExtension('sql_query')">+ sql_query</button>
          </div>
          <div v-if="!wizPythonExtensions.length" class="picker-empty-small">
            No Python post-processing yet. Click <strong>+ row_transform</strong> (per-row UDF), <strong>+ dataframe_transform</strong> (whole-DF driver-side), or <strong>+ sql_query</strong> (SQL on the current DF) to add one.
          </div>
          <div v-for="(ext, eIdx) in wizPythonExtensions" :key="eIdx" class="wizard-python-entry">
            <div class="wizard-python-entry-head">
              <span class="wizard-python-type" :class="'wizard-python-type-' + ext.type">{{ ext.type }}</span>
              <input type="text"
                     class="text-input wizard-python-name"
                     placeholder="extension_name (snake_case)"
                     :value="ext.name"
                     @input="ext.name = $event.target.value">
              <button class="btn btn-danger btn-xs" @click="removePythonExtension(eIdx)" title="Remove this extension">✕</button>
            </div>
            <div class="wizard-python-aimagic">
              <input type="text"
                     class="text-input"
                     placeholder="🪄 Describe what this snippet should do (e.g. 'normalise price column, drop rows with missing url')"
                     :value="ext.intent || ''"
                     @input="ext.intent = $event.target.value"
                     @keyup.enter="aiMagicForPythonExt(eIdx)">
              <button class="btn btn-primary btn-xs"
                      :disabled="ext._aiBusy || !(ext.intent && ext.intent.trim())"
                      @click="aiMagicForPythonExt(eIdx)">
                <span v-if="ext._aiBusy" class="loading-spinner"></span>
                🪄 Generate
              </button>
            </div>
            <textarea class="text-input wizard-python-body"
                      :placeholder="pythonBodyPlaceholder(ext.type)"
                      rows="8"
                      :value="ext.functionBody || ''"
                      @input="ext.functionBody = $event.target.value"></textarea>
            <div v-if="ext._valError" class="wizard-python-err">{{ ext._valError }}</div>
          </div>
        </div>

        <!-- Pipeline-level settings, available DURING design (not just in the
             execute panel): geo zone + execution runtime. They're metadata of
             the pipeline, so they belong here and show up in the YAML below. -->
        <h4>⚙️ Pipeline settings</h4>
        <div class="wizard-pipeline-settings">
          <label class="wizard-setting">
            <span>🌍 Geo zone (proxy)</span>
            <input v-model="geoSearch" class="text-input" style="width:120px;margin-bottom:4px;" placeholder="filter country…" />
            <select v-model="wizGeo" class="text-input" :size="geoSearch ? 6 : 1">
              <option v-for="z in geoOptions" :key="z.code" :value="z.code">{{ z.label }}</option>
            </select>
          </label>
          <label class="wizard-setting">
            <span>🖥 Execution runtime</span>
            <select v-model="wizRuntime" class="text-input">
              <option value="spark">Spark job (default)</option>
              <option value="ray_actor">Ray actor</option>
            </select>
          </label>
          <p v-if="wizRuntime === 'ray_actor'" class="wizard-setting-warn">
            🚧 <strong>Ray actor runtime is under design (Phase-4)</strong> — not available yet.
            The pipeline records <code>metadata.runtime: ray_actor</code>, but execution runs on Spark for now.
          </p>
          <p class="wizard-setting-hint">
            Geo routes the residential proxy through that country (DataImpulse) at browser-session
            allocation; emitted as <code>metadata.geo</code>. Runtime emitted as <code>metadata.runtime</code>.
          </p>
        </div>

        <h4>📄 YAML preview</h4>
        <pre class="wizard-yaml">{{ wizYamlPreview }}</pre>

        <!-- Required-arg / shape validation.
             Two render layers:
             • If the user has tried to save → loud red banner with the
               full error list (drives the eye to what's missing).
             • Otherwise, when errors exist but the user hasn't tried
               to save yet → soft yellow hint panel listing the same
               errors so they can see WHY the action buttons are
               disabled without clicking and getting an "errors!" toast.
               (Previously the only signal was a greyed-out button —
               confusing if you're staring at a clearly-filled form
               but one alias slipped through.) -->
        <div v-if="wizShowFieldErrors && wizValidationErrors.length" class="wizard-validation">
          <strong>Fix before saving:</strong>
          <ul>
            <li v-for="(err, i) in wizValidationErrors" :key="i">{{ err }}</li>
          </ul>
        </div>
        <div v-else-if="!wizValid && wizValidationErrors.length" class="wizard-validation-hint">
          <strong>⚠️ Save / Validate disabled — pending:</strong>
          <ul>
            <li v-for="(err, i) in wizValidationErrors" :key="i">{{ err }}</li>
          </ul>
        </div>

        <div class="wizard-actions">
          <button class="btn btn-primary"
                  :disabled="!wizValid"
                  :title="wizValid ? '' : wizValidationErrors[0]"
                  @click="wizardSaveAndRun">Save &amp; Run</button>
          <button class="btn btn-secondary"
                  :disabled="!wizValid"
                  :title="wizValid ? 'Save without running — appears in the selector above' : wizValidationErrors[0]"
                  @click="wizardSaveAsDraft">Save (draft)</button>
          <button class="btn btn-secondary"
                  :disabled="!wizValid || validateOpen"
                  :title="wizValid
                    ? 'Run the pipeline on a real Camoufox session and preview up to 5 records before launching the Spark job'
                    : wizValidationErrors[0]"
                  @click="openValidate">🔬 Validate selectors</button>
          <button class="btn btn-secondary"
                  :disabled="!wizValid || varDetectLoading"
                  :title="wizValid
                    ? 'Detect values (search keywords, urls) you can turn into pipeline variables bound to an input-dataset column — run the pipeline once per row (parameter sweep)'
                    : wizValidationErrors[0]"
                  @click="openVariableDetect">
            <span v-if="varDetectLoading" class="loading-spinner"></span>
            🔗 Variables
          </button>
          <!--
            Standalone "Record actions" button removed: action-record
            is reachable via the 🎯 button on any fetch/visit/wget
            stage's trace arg, which is the natural entry point. A
            bottom-bar version without a target stage was confusing —
            users would record actions with nowhere to apply them.
          -->
          <button class="btn btn-ghost" @click="wizardReset">Reset</button>
          <div v-if="wizStatus.kind" :class="['wizard-status', 'wizard-status-' + wizStatus.kind]">
            {{ wizStatus.text }}
          </div>

          <!-- ✨ Auto body-selector suggestion (after picking a long-text field).
               Human-in-the-loop: suggests a cleaner article-body selector +
               method, and warns if the picked block is actually a paywall. -->
          <div v-if="bodySuggestion" class="body-suggestion">
            <div class="body-suggestion-head">
              ✨ Suggerimento per il body articolo
              <span v-if="bodySuggestion.confidence != null" class="body-suggestion-conf">
                ({{ Math.round(bodySuggestion.confidence * 100) }}%)
              </span>
            </div>
            <div v-if="bodySuggestion.paywalled" class="body-suggestion-paywall">
              ⚠️ Questo blocco sembra un <strong>paywall</strong>, non l'articolo.
              {{ bodySuggestion.paywallReason }}
              Su questa fonte il corpo articolo potrebbe non essere estraibile.
            </div>
            <div v-if="bodySuggestion.selector" class="body-suggestion-sel">
              Selettore più pulito:
              <code>{{ bodySuggestion.selector }}</code>
              <span class="body-suggestion-method">method: {{ bodySuggestion.method }}</span>
            </div>
            <div v-if="bodySuggestion.why" class="body-suggestion-why">{{ bodySuggestion.why }}</div>
            <div class="body-suggestion-actions">
              <button v-if="bodySuggestion.selector" class="btn btn-sm" @click="applyBodySuggestion">Applica</button>
              <button class="btn btn-ghost btn-sm" @click="dismissBodySuggestion">Ignora</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ───────── Variables modal (parameterize → bind to dataset column) ─── -->
    <div v-if="varDetectOpen" class="picker-modal-backdrop" @click.self="closeVariableDetect">
      <div class="picker-modal vardetect-modal">
        <div class="picker-modal-header">
          <strong>🔗 Pipeline variables</strong>
          <button class="btn btn-secondary btn-sm" @click="closeVariableDetect">✕ Close</button>
        </div>
        <div class="vardetect-body">
          <p class="vardetect-intro">
            Turn fixed values (search keywords, urls) into <strong>variables</strong> bound to a
            column of the input dataset: the pipeline runs <strong>once per row</strong>, with that
            row's value substituted in (parameter sweep, via <code>$column</code>).
          </p>

          <div class="vardetect-cols">
            <label>Input dataset columns (comma-separated, optional):</label>
            <input type="text" class="text-input" v-model="varDetectColumns"
                   placeholder="e.g. search_term, city, brand"
                   @keyup.enter="runVariableDetect" />
            <button class="btn btn-primary btn-sm"
                    :disabled="varDetectLoading"
                    @click="runVariableDetect">
              <span v-if="varDetectLoading" class="loading-spinner"></span>
              🔍 Detect variables (AI)
            </button>
          </div>

          <div v-if="varDetectError" class="wizard-validation">{{ varDetectError }}</div>

          <div v-if="varDetectRan && !varDetectResults.length && !varDetectLoading" class="vardetect-empty">
            No parameterizable value detected (search keyword / url). Nothing to do here.
          </div>

          <div v-for="(v, vi) in varDetectResults" :key="vi" class="vardetect-card">
            <div class="vardetect-q">{{ varQuestion(v) }}</div>
            <div class="vardetect-meta">
              <code>{{ v.stage }}</code> · <code>{{ v.path }}</code> · current value:
              <strong>{{ v.current }}</strong>
            </div>
            <div class="vardetect-choice">
              <label><input type="radio" :name="'var'+vi" value="column"
                            v-model="varBindings[vi].mode"> Bind to column</label>
              <select v-if="varBindings[vi].mode === 'column'" v-model="varBindings[vi].column" class="text-input">
                <option v-for="c in varColumnList" :key="c" :value="c">{{ c }}</option>
              </select>
              <input v-if="varBindings[vi].mode === 'column' && !varColumnList.length"
                     type="text" class="text-input" v-model="varBindings[vi].column"
                     :placeholder="v.suggested_column || 'column_name'" />
              <label><input type="radio" :name="'var'+vi" value="literal"
                            v-model="varBindings[vi].mode"> Keep fixed</label>
            </div>
          </div>

          <div v-if="varDetectResults.length" class="vardetect-actions">
            <button class="btn btn-primary" @click="applyVariableBindings">
              {{ varGateActive ? '✅ Apply &amp; launch' : '✅ Apply' }} ({{ varBoundCount }} → variable)
            </button>
            <button v-if="varGateActive" class="btn btn-secondary" @click="skipVariableGate">
              Skip &amp; launch
            </button>
            <button class="btn btn-ghost" @click="closeVariableDetect">
              {{ varGateActive ? 'Cancel launch' : 'Cancel' }}
            </button>
          </div>
          <p class="vardetect-note">
            "Bind to column" variables become <code>$column</code> in the YAML and are resolved
            per-row at runtime. Save (or Save &amp; Run with an associated dataset) to apply the sweep.
          </p>
        </div>
      </div>
    </div>

    <!-- ───────── Validate modal (browser-automation preview) ─────── -->
    <div v-if="validateOpen" class="picker-modal-backdrop" @click.self="closeValidate">
      <div class="picker-modal validate-modal">
        <div class="picker-modal-header validate-modal-header">
          <strong>🔬 Validate selectors (real browser automation)</strong>
          <button class="btn btn-secondary btn-sm validate-close-btn" @click="closeValidate">✕ Close</button>
        </div>

        <div class="validate-body">
          <div class="validate-left">
            <div class="validate-status" :class="'validate-status-' + (validateState.kind || 'idle')">
              {{ validateState.text || 'Click "Run validation" to walk the pipeline on a Camoufox session.' }}
            </div>

            <div class="validate-controls">
              <button class="btn btn-primary"
                      :disabled="validateState.kind === 'running'"
                      @click="runValidation">
                {{ validateState.kind === 'running' ? '⏳ Running…' : '▶ Run validation' }}
              </button>
              <span v-if="validateResult && validateResult.took_ms != null" class="validate-took">
                Took {{ (validateResult.took_ms / 1000).toFixed(1) }}s
              </span>
            </div>

            <div v-if="validateResult && validateResult.steps && validateResult.steps.length" class="validate-steps">
              <h5>Pipeline walk</h5>
              <ol>
                <li v-for="(s, i) in validateResult.steps" :key="i" :class="'validate-step-' + s.status">
                  <strong>{{ s.stage }}</strong>
                  <span class="validate-step-status">[{{ s.status }}]</span>
                  <span class="validate-step-msg">{{ s.message }}</span>
                </li>
              </ol>
            </div>

            <div v-if="validateResult && Array.isArray(validateResult.records) && validateResult.records.length" class="validate-records">
              <h5>Records preview ({{ validateResult.record_count }} of max 5)</h5>
              <div class="validate-records-scroll">
                <table class="validate-records-table">
                  <thead>
                    <tr>
                      <th v-for="col in validateColumns" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ri) in validateResult.records" :key="ri">
                      <td v-for="col in validateColumns" :key="col" :title="String(row[col] == null ? '' : row[col])">
                        {{ truncate(row[col]) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="validateResult && validateResult.valid === false" class="validate-error">
              <strong>Validation failed:</strong> {{ validateResult.error || 'see steps above' }}
            </div>
          </div>

          <div class="validate-right">
            <h5>Final page (after trace)</h5>
            <div v-if="!validateResult || !validateResult.html_snapshot" class="validate-iframe-placeholder">
              Run the validation to capture a snapshot of what Camoufox saw.
            </div>
            <iframe
              v-else
              class="validate-iframe"
              sandbox="allow-same-origin"
              :srcdoc="validateResult.html_snapshot"
            ></iframe>
            <div v-if="validateResult && validateResult.final_url" class="validate-final-url">
              <strong>URL:</strong> {{ validateResult.final_url }}
            </div>
          </div>
        </div>

        <div class="validate-footer">
          <span v-if="validateResult" class="validate-footer-summary">
            <strong v-if="validateResult.valid"  class="validate-footer-ok">✓ Valid</strong>
            <strong v-else                       class="validate-footer-ko">✗ Invalid</strong>
            <span v-if="validateResult.record_count != null"> · {{ validateResult.record_count }} record(s)</span>
            <span v-if="validateResult.took_ms != null"> · {{ (validateResult.took_ms / 1000).toFixed(1) }}s</span>
          </span>
          <button class="btn btn-secondary" @click="closeValidate">Close</button>
        </div>
      </div>
    </div>

    <!-- ───────── Picker modal (selector + action recorder) ───────── -->
    <div v-if="pickerOpen" class="picker-modal-backdrop" @click.self="closePicker">
      <div class="picker-modal">
        <div class="picker-modal-header">
          <strong>🎯 Page picker</strong>
          <div class="picker-mode-tabs">
            <!-- Tabs filtered per-stage so the toolbar shows only the
                 modes that make sense for the origin stage:
                   extract           → ⏺ Record · 🎯 Select fields · 🪄 Ask AI
                                       (Record lets you navigate to the
                                        right page first; Select fields
                                        explicitly arms field clicking —
                                        the current mirror page may not be
                                        the one you want yet)
                   iextract          → 🪄 Ask AI (prompt-only stage —
                                       no CSS selectors to click)
                   flatSelect        → 📋 List · 📍 Pick samples · ⏺ Record ·
                                       🎯 Select fields · 🪄 Ask AI
                                       (Record to navigate/paginate first,
                                        then pick the row + Select fields)
                   explore family    → 📋 List · 📍 Pick samples · ⏺ Record · 🪄 Ask AI
                   join family       → 📋 List · 📍 Pick samples · ⏺ Record · 🪄 Ask AI
                                       (same as explore — link selector
                                        primary, optional trace actions)
                   fetch             → ⏺ Record actions (pure navigation)
                 "🎯 One element" was removed from the toolbar; it lives
                 on as the internal selector-single mode when opened
                 from a per-arg 🎯 icon next to a single arg input. -->
            <button v-if="(pickerOriginIsFlatSelect || pickerOriginIsExplore || pickerOriginIsJoin) && !pickerIsFieldSelection && !pickerIntendedMode"
                    :class="['picker-tab', pickerMode === 'selector-list' && 'active']"
                    title="Click ONE row / item / link. The picker writes a selector matching all similar elements via the class/tag pattern they share. Quick (1 click) — fall back to Pick samples if too narrow / too broad."
                    @click="setPickerMode('selector-list')">📋 List like this</button>
            <button v-if="(pickerOriginIsFlatSelect || pickerOriginIsExplore || pickerOriginIsJoin) && !pickerIsFieldSelection && !pickerIntendedMode"
                    :class="['picker-tab', pickerMode === 'multi-sample' && 'active']"
                    title="Click 2+ examples of the repeating thing you want (rows, links, items). The picker computes the broadest CSS selector that matches ALL of them via path-piece intersection. Best when 1-click List is too narrow / too broad / irregular markup."
                    @click="setPickerMode('multi-sample')">📍 Pick samples</button>
            <button v-if="(pickerOriginIsFlatSelect || pickerOriginIsExplore || pickerOriginIsJoin) && !pickerIsFieldSelection && !pickerIntendedMode"
                    :class="['picker-tab', pickerMode === 'row-lca' && 'active']"
                    title="Row spans two separate parts with no single wrapping box (e.g. an avatar/author block on the left + the comment body)? Click ONE part, then the OTHER part of the SAME row — the picker uses their common container as the repeating row."
                    @click="setPickerMode('row-lca')">🧩 Row (2 clicks)</button>
            <!-- Record actions: navigation. Available for the trace
                 stages AND for flatSelect/extract — the mirror page the
                 picker opened on may not be the one to extract from
                 (needs search / pagination / a tab click first). Kept
                 reachable even mid field-selection so the user can
                 paginate and keep picking. Camoufox strategy required. -->
            <button v-if="(pickerOriginIsFetch || pickerOriginIsExplore || pickerOriginIsJoin || pickerOriginIsFlatSelect || pickerOriginIsExtract) && !pickerOriginIsVisitDrill && !pickerIntendedMode"
                    :class="['picker-tab', pickerMode === 'action-record' && 'active']"
                    title="Record a REPLAYABLE trace into this stage — every click / form input / navigation is saved. Use when the stage itself needs to drive the page at run time (login, filters). Distinct from the navigate-first phase (which only positions the mirror and is NOT recorded). Camoufox strategy required."
                    @click="setPickerMode('action-record')">⏺ Record actions</button>
            <!-- Select fields: explicit gate into field clicking for
                 flatSelect (relative to the segment) and extract (page-
                 rooted). The user navigates first (Record), lands on the
                 right page, THEN arms field selection — instead of the
                 picker jumping straight into clicking on a possibly-wrong
                 page. -->
            <button v-if="(pickerOriginIsFlatSelect || pickerOriginIsExtract) && pickerMode !== 'multi-field' && !pickerIntendedMode"
                    :class="['picker-tab', pickerMode === 'multi-field' && 'active']"
                    :disabled="!fieldSelectionReady"
                    :title="fieldSelectionReady
                      ? 'Arm field selection on the CURRENT page. Click the fields you want — for flatSelect they\'re captured relative to the row/segment selector, for extract they\'re page-rooted. Navigate with ⏺ Record actions first if the page isn\'t the one you want yet.'
                      : 'flatSelect: set the row selector (📍 Pick samples) first — field selectors are relative to it.'"
                    @click="enterFieldSelection()">🎯 Select fields</button>
            <button v-if="!pickerOriginIsFetch && !pickerIntendedMode"
                    :class="['picker-tab', pickerMode === 'ai-magic' && 'active']"
                    title="Describe what you want in plain language — the LLM finds the right selector or builds the field set for you. Works for extract, iextract, flatSelect, explore, and join families."
                    @click="setPickerMode('ai-magic')">🪄 Ask AI</button>
          </div>
          <!-- wget strategy removed from the designer (almost never worked:
               plain HTTP, no JS/anti-bot). Camoufox is the only path now. -->
          <button class="btn btn-ghost btn-sm" @click="closePicker">✕ Close</button>
        </div>

        <div class="picker-modal-url">
          <input
            v-model="pickerUrl"
            type="text"
            class="text-input"
            placeholder="https://target-site.example/page"
            @keyup.enter="loadPickerUrl"
          />
          <!-- Pipeline-level geo zone: choose BEFORE loading so the live mirror
               session exits through that country (DataImpulse). Same wizGeo used
               in the YAML metadata.geo — one pipeline-wide setting. -->
          <input v-model="geoSearch" class="text-input" style="width:110px;" placeholder="filter country…" />
          <select v-model="wizGeo" class="text-input" style="width:auto;" :size="geoSearch ? 6 : 1" title="Proxy geo zone for this pipeline (applies to the live mirror session too)">
            <option v-for="z in geoOptions" :key="z.code" :value="z.code">{{ z.label }}</option>
          </select>
          <button class="btn btn-primary btn-sm" @click="loadPickerUrl">Load page</button>
          <button v-if="pickerLoadedUrl"
                  class="btn btn-secondary btn-sm"
                  title="Re-fetch the current page from the live session — picks up server-side changes (e.g. a cookie banner that was just auto-dismissed) without re-navigating."
                  @click="refreshPickerMirror">↻ Refresh</button>
        </div>

        <!-- Resume banner — safety net for when auto-resume in
             openPicker didn't fire (e.g. modal opened via a path that
             skipped openPicker, or pausedCmfSession appeared while the
             modal was already open). One-shot: "Resume here" rebinds
             the iframe; "Start fresh" drops the parked session (DELETE)
             and lets the user type a new URL. -->
        <div v-if="pausedCmfSession && !pickerLoadedUrl" class="picker-resume-banner">
          <span>
            🔁 <strong>Paused session</strong> on
            <code>{{ pausedCmfSession.url }}</code>
            <span class="picker-resume-age">({{ pausedCmfAgeLabel }})</span>
          </span>
          <div class="picker-resume-actions">
            <button class="btn btn-primary btn-sm" @click="resumePausedSession">Resume here</button>
            <button class="btn btn-ghost btn-sm" @click="discardPausedSession">Start fresh</button>
          </div>
        </div>

        <!-- Make the "mirror, not a real browser" model explicit so users
             read a ~10s post-click delay as expected, not as a hang. -->
        <div v-if="pickerStrategy === 'cmf' && pickerLoadedUrl" class="picker-mirror-hint">
          ℹ️ This is a <strong>live mirror</strong> of a server-side browser, not the browser itself.
          <span v-if="pickerMode === 'action-record'">
            Clicks and typing are <strong>staged locally</strong>; press <strong>▶ Send</strong> below to replay the whole sequence on Camoufox and refresh the iframe in one go (3–10 s on heavy sites).
          </span>
          <span v-else>
            Each click / keystroke is replayed on a remote Camoufox instance and the rendered page is sent back — expect a short delay (typically 3–10 s on heavy ecommerce sites) before the iframe updates.
          </span>
        </div>

        <!-- "Address bar" showing the URL the live Camoufox tab is on
             after the most recent navigation step, plus a back button
             that drives page.goBack() on the server-side browser. Hidden
             when no page has been loaded yet. -->
        <div v-if="pickerLoadedUrl" class="picker-address-bar">
          <button class="picker-back-btn" :disabled="pickerLoading || pickerStrategy !== 'cmf'"
                  title="Go back in the server-side browser history"
                  @click="goBackInCamoufox">← Back</button>
          <span class="picker-address-label">URL:</span>
          <code class="picker-address-url" :title="pickerLoadedUrl">{{ pickerLoadedUrl }}</code>
        </div>

        <div class="picker-modal-body">
          <div v-if="!pickerLoadedUrl" class="picker-empty">
            Enter a URL above and click Load. The page renders inside a sandboxed iframe — via wget for fast static sites, via Camoufox for JS-heavy ones.
          </div>
          <!-- Inline red banner kept ONLY for the initial-load case (no
               iframe ever rendered yet — there's nothing to preserve, so
               showing the error inline is fine).  Step / replay errors
               go through the stepWarnings modal instead so the previous
               iframe state stays mounted underneath. -->
          <div v-else-if="pickerLoadError && !cmfSessionId" class="picker-empty" style="color:#b00020;">
            Load failed: {{ pickerLoadError }} — try switching strategy to Camoufox (top-right toggle).
          </div>
          <!-- Camoufox path: iframe SRC points at /wizard/iframe/<sessionId>/
               proxy endpoint. Every asset roundtrips through the live
               Camoufox session (cookies, headers, Cloudflare clearance
               preserved) and the iframe has a real origin so JS dynamic
               fetch/XHR resolve against the proxy (not against the parent
               portal origin). Side effect: nested captcha iframes can now
               post back via window.top.postMessage and finalize the
               challenge. The cmfReloadKey query param is bumped on every
               /cmf/step success to force a refresh after committed
               actions. -->
          <iframe
            v-else-if="pickerStrategy === 'cmf' && cmfSessionId"
            id="wr-picker-iframe"
            :src="cmfIframeSrc"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            class="picker-iframe"
            @load="onPickerIframeLoad"
          ></iframe>
          <!-- wget path (legacy): direct GET on /wizard/proxy via src. -->
          <iframe
            v-else-if="pickerStrategy === 'wget'"
            id="wr-picker-iframe"
            :src="pickerProxySrc"
            sandbox="allow-same-origin allow-scripts allow-forms"
            class="picker-iframe"
          ></iframe>
          <div v-else class="picker-empty">
            <span class="loading-spinner" style="margin-right:8px;"></span> Loading via {{ pickerStrategy === 'cmf' ? 'Camoufox' : 'wget' }}…
          </div>
        </div>
        <!-- Loading overlay at MODAL level (not inside the scrolling
             body): a 1440px iframe with overflow:auto would otherwise
             pin the overlay to the scroll content rather than the
             viewport, hiding it whenever the user scrolled horizontally
             to see the right side of the page. -->
        <div v-if="pickerLoading && pickerLoadedUrl && !pickerLoadError" class="picker-overlay">
          <div class="picker-overlay-card">
            <span class="loading-spinner" style="margin-right:10px;"></span>
            <div class="picker-overlay-text">
              <strong>{{ pickerLoadingLabel }}</strong>
              <span v-if="pickerLoadingElapsedS >= 1" class="picker-overlay-elapsed">{{ pickerLoadingElapsedS }}s</span>
            </div>
          </div>
        </div>

        <!-- Selector result panel -->
        <div v-if="pickerSelected && pickerMode !== 'action-record'" class="picker-result">
          <div class="picker-result-row">
            <code class="picker-selector">{{ pickerSelected.selector }}</code>
            <span class="picker-matches">{{ pickerSelected.matches }} match{{ pickerSelected.matches === 1 ? '' : 'es' }}</span>
          </div>
          <div v-if="pickerSelected.sampleText" class="picker-sample">{{ pickerSelected.sampleText }}</div>
          <div class="picker-actions">
            <button class="btn btn-primary btn-sm" :disabled="!pickerTargetArgName" @click="applyPickedSelector">
              {{ pickerTargetArgName ? `Use this selector for "${pickerTargetArgName}"` : 'Open this from an arg to apply' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="pickerSelected = null">Clear</button>
          </div>
        </div>

        <!-- Multi-link sample panel — visible when picker is in
             'multi-sample' mode. Shows the running generalised selector
             plus a "match count" so the user can decide when enough
             examples have been clicked. Apply to explore-stage args. -->
        <div v-if="pickerMode === 'multi-sample'" class="picker-result picker-multi">
          <div class="picker-multi-head">
            <strong>📍 Repeating-link sampler</strong>
            <span v-if="pickerTargetArgName" class="picker-multi-target">
              → target: {{ pickerTargetArgName }}
            </span>
          </div>
          <div class="picker-empty-small picker-stage-hint">
            Click 2+ examples of the same repeating element (e.g. product link, "next page" link, list item). The picker grows a selector that matches all clicked samples — apply it to your explore stage when the count looks right.
          </div>
          <div v-if="multiSampleStatus.samples > 0" class="picker-result-row">
            <code class="picker-selector">{{ multiSampleStatus.selector || '— no common selector yet —' }}</code>
            <span class="picker-matches">
              {{ multiSampleStatus.samples }} sample{{ multiSampleStatus.samples === 1 ? '' : 's' }}
              · {{ multiSampleStatus.matches }} match{{ multiSampleStatus.matches === 1 ? '' : 'es' }}
            </span>
          </div>
          <div v-if="multiSampleStatus.sampleText" class="picker-sample">{{ multiSampleStatus.sampleText }}</div>
          <div class="picker-actions">
            <button class="btn btn-primary btn-sm"
                    :disabled="!pickerTargetArgName || !multiSampleStatus.selector"
                    @click="applyMultiSampleSelector">
              {{ pickerTargetArgName ? `Use this selector for "${pickerTargetArgName}"` : 'Open this from an arg to apply' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="clearMultiSamples">Clear samples</button>
          </div>
        </div>

        <!-- Multi-field picker info + auto-suggest. Visible when the
             modal was opened from a structured stage's "🎯 Pick fields"
             button. Every click in the iframe adds a row directly to
             the stage's _fields; the count badge lives in the wizard. -->
        <div v-if="pickerMode === 'multi-field'" class="picker-result picker-multi">
          <div class="picker-multi-head">
            <strong>🎯 Multi-field picker</strong>
            <span v-if="pickerTargetStageIdx != null" class="picker-multi-target">
              → fills {{ (wizPipeline[pickerTargetStageIdx] || {}).stage }} row #{{ pickerTargetStageIdx + 1 }}
            </span>
          </div>
          <div class="picker-multi-row">
            <button class="btn btn-secondary btn-sm" @click="selectMacroBox"
                    title="Click the content region (e.g. the article) — AI infers fields from THAT box only.">
              {{ macroBox ? '📦 Content box ✓ (re-pick)' : '📦 Select content box' }}
            </button>
            <button v-if="macroBox" class="btn btn-ghost btn-sm" @click="clearMacroBox" title="Clear content box">✕</button>
            <input v-model="aiIntent" type="text" class="text-input" placeholder="describe the fields (e.g. name, price, rating, link)"
              @keyup.enter="macroBox && runAutoSuggestFields()">
            <button class="btn btn-primary btn-sm"
                    :disabled="aiLoading || !aiIntent.trim() || !macroBox"
                    :title="!macroBox ? 'Select a content box first (📦)' : 'Infer fields from the selected box'"
                    @click="runAutoSuggestFields">
              <span v-if="aiLoading" class="loading-spinner"></span>
              {{ aiLoading ? 'Thinking…' : '🪄 Auto-suggest fields' }}
            </button>
            <button class="btn btn-secondary btn-sm"
                    :disabled="suggestNamesLoading || !((currentStageFields).length)"
                    @click="suggestFieldNamesFromModal">
              <span v-if="suggestNamesLoading" class="loading-spinner"></span>
              🪄 Suggest names
            </button>
            <button class="btn btn-secondary btn-sm"
                    :disabled="relaxingFields || !((currentStageFields).length)"
                    title="Ask the LLM to make the field selectors robust: drop :nth-of-type / hashed classes, prefer semantic tags + stable classes. The highlight re-paints so you can review."
                    @click="relaxFieldSelectors">
              <span v-if="relaxingFields" class="loading-spinner"></span>
              ✨ Relax selectors
            </button>
            <button class="btn btn-secondary btn-sm" @click="closePicker">✅ Done</button>
          </div>
          <div v-if="aiError" class="picker-ai-err">{{ aiError }}</div>
          <div class="picker-multi-hint">
            Click each field on the page to add it. Edit names below; "🪄 Suggest names" asks the LLM to propose snake_case columns from the samples.
          </div>
          <!-- Inline editor: every field picked on the current stage is
               listed here so the user names + tweaks without closing
               the modal. Selectors that were already saved before
               re-opening were re-painted in the iframe by picker.js
               via webrobot-picker-multi-restore. -->
          <table v-if="currentStageFields.length" class="picker-multi-fields-table">
            <thead>
              <tr><th></th><th>as (column)</th><th>selector</th><th>sample</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="(f, fIdx) in currentStageFields" :key="fIdx">
                <td><span class="wizard-field-dot" :style="{background: f._color || '#bbb'}"></span></td>
                <td>
                  <input type="text" class="text-input"
                         :value="f.as"
                         placeholder="column"
                         @input="updateFieldProp(pickerTargetStageIdx, fIdx, 'as', $event.target.value)">
                </td>
                <td><code class="picker-multi-sel" :title="f.selector">{{ (f.selector || '').slice(0, 60) }}{{ (f.selector || '').length > 60 ? '…' : '' }}</code></td>
                <td class="picker-multi-sample" :title="f._sample">{{ (f._sample || '').slice(0, 32) }}</td>
                <td><button class="btn btn-danger btn-xs" @click="removeFieldFromModal(fIdx)">✕</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- AI Magic panel -->
        <div v-if="pickerMode === 'ai-magic'" class="picker-result picker-ai">
          <div class="picker-ai-row">
            <select v-model="aiMode" class="text-input picker-ai-mode">
              <option value="selector">Find selector</option>
              <option value="actions">Build action sequence</option>
              <option value="flatselect">flatSelect: segment + fields</option>
            </select>
            <button class="btn btn-secondary btn-sm" @click="selectMacroBox"
                    title="Optional: click the list/results region to FOCUS the AI inference on it (sharper link/segment selectors). Without it the AI uses the whole rendered page.">
              {{ macroBox ? '📦 box ✓' : '📦 box' }}
            </button>
            <button v-if="macroBox" class="btn btn-ghost btn-sm" @click="clearMacroBox" title="Clear content box">✕</button>
            <input
              v-model="aiIntent"
              type="text"
              class="text-input"
              :placeholder="aiMode === 'actions'
                ? 'e.g. search for laptops and click submit'
                : (aiMode === 'flatselect'
                    ? 'e.g. each product card with title, price, link, image'
                    : 'e.g. the next-page link at the bottom of the catalogue')"
              @keyup.enter="runAiMagic"
            />
            <button class="btn btn-primary btn-sm" :disabled="aiLoading || !pickerLoadedUrl" @click="runAiMagic">
              <span v-if="aiLoading" class="loading-spinner"></span>
              {{ aiLoading ? 'Thinking…' : '🪄 Suggest' }}
            </button>
          </div>
          <div v-if="aiError" class="picker-ai-err">{{ aiError }}</div>

          <!-- flatSelect end-to-end: shows the inferred segment selector
               + the suggested fields, with a "Apply all" CTA that fills
               row.args.selector + row._fields in one go. -->
          <div v-if="aiMode === 'flatselect' && aiFlatSelectResult" class="picker-ai-section">
            <div class="picker-ai-flat-head">
              <strong>📐 Segment</strong>
              <code class="picker-ai-flat-seg">{{ aiFlatSelectResult.segmentSelector || '—' }}</code>
              <span class="picker-ai-conf" v-if="aiFlatSelectResult.segmentMatches != null">{{ aiFlatSelectResult.segmentMatches }} rows</span>
            </div>
            <table v-if="aiFlatSelectResult.fields && aiFlatSelectResult.fields.length" class="picker-ai-flat-table">
              <thead><tr><th>as</th><th>method</th><th>selector (relative)</th><th>sample</th></tr></thead>
              <tbody>
                <tr v-for="(f, fi) in aiFlatSelectResult.fields" :key="fi">
                  <td><code>{{ f.as }}</code></td>
                  <td><code>{{ f.method || 'text' }}</code></td>
                  <td><code>{{ f.selector }}</code></td>
                  <td class="picker-ai-flat-sample" :title="f.sample">{{ (f.sample || '').slice(0, 40) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="picker-ai-flat-actions">
              <button class="btn btn-primary btn-sm"
                      :disabled="!aiFlatSelectResult.segmentSelector || !(aiFlatSelectResult.fields && aiFlatSelectResult.fields.length)"
                      @click="applyAiFlatSelect">
                ✅ Apply segment + {{ (aiFlatSelectResult.fields || []).length }} field(s)
              </button>
              <button class="btn btn-ghost btn-sm" @click="aiFlatSelectResult = null">Clear</button>
            </div>
          </div>

          <!-- Algorithmic candidates (yellow) -->
          <div v-if="aiAlgoResults.length" class="picker-ai-section">
            <strong class="picker-ai-tag algo">⚡ Algo</strong>
            <div v-for="(c, i) in aiAlgoResults" :key="'a'+i" class="picker-ai-card">
              <div class="picker-ai-card-top">
                <code>{{ c.selector || (c.type + (c.selector ? '("'+c.selector+'")' : '')) }}</code>
                <span class="picker-ai-conf">conf {{ Math.round((c.confidence || 0) * 100) }}%</span>
              </div>
              <div class="picker-ai-why">{{ c.why || '' }}</div>
              <button v-if="aiMode === 'selector' && c.selector" class="btn btn-secondary btn-xs" @click="applyAiCandidate(c)">
                Use this
              </button>
            </div>
          </div>

          <!-- LLM candidates (green) -->
          <div v-if="aiLlmResults.length" class="picker-ai-section">
            <strong class="picker-ai-tag llm">🔥 AI refined</strong>
            <div v-for="(c, i) in aiLlmResults" :key="'l'+i" class="picker-ai-card">
              <div class="picker-ai-card-top">
                <code>{{ c.selector || (c.type + (c.selector ? '("'+c.selector+'")' : '')) }}</code>
                <span class="picker-ai-conf">conf {{ Math.round((c.confidence || 0) * 100) }}%</span>
              </div>
              <div class="picker-ai-why">{{ c.why || '' }}</div>
              <button v-if="aiMode === 'selector' && c.selector" class="btn btn-primary btn-xs" @click="applyAiCandidate(c)">
                Use this
              </button>
            </div>
            <button v-if="aiMode === 'actions'" class="btn btn-primary btn-sm" style="margin-top:8px;" @click="applyAiCandidate(aiLlmResults[0])">
              Copy action YAML
            </button>
          </div>

          <!-- LCA refine from a click -->
          <div v-if="aiPickedRefined" class="picker-ai-section picker-ai-refine">
            <strong class="picker-ai-tag refine">💎 Refined from your click</strong>
            <div class="picker-ai-card">
              <code>{{ aiPickedRefined.selector }}</code>
              <div class="picker-ai-why">{{ aiPickedRefined.why }}</div>
              <button class="btn btn-primary btn-xs" @click="applyRefinedFromHighlight">Use refined</button>
            </div>
          </div>

          <div v-if="!aiAlgoResults.length && !aiLlmResults.length && !aiLoading && !aiError" class="picker-empty-small">
            Load a URL above, then describe what you want and press Suggest. Algo guesses appear instantly (yellow), AI refines (green). Click in the iframe to refine further (blue).
          </div>
        </div>

        <!-- Action recorder result panel.
             In Camoufox strategy, clicks no longer fire immediately —
             they queue here so the user can build a full sequence
             (focus input → type → click submit) and ship it as ONE
             batch to /cmf/step. That stops the "page changed after the
             first click before I could type" surprise the old live-
             forward flow had. -->
        <div v-if="pickerMode === 'action-record'" class="picker-result picker-result-tall">
          <div class="picker-result-row">
            <strong>
              <span v-if="pickerStrategy === 'cmf'">📥 Staged actions: {{ pickerActions.length }}</span>
              <span v-else>Recorded actions: {{ pickerActions.length }}</span>
            </strong>
            <div class="picker-action-buttons">
              <button v-if="pickerStrategy === 'cmf'"
                      class="btn btn-primary btn-sm"
                      :class="{ 'btn-antibot-pulse': antiBotDetected }"
                      :disabled="pickerLoading || pickerActions.length === 0"
                      @click="sendStagedActionsToCamoufox"
                      :title="antiBotDetected
                        ? 'Anti-bot challenge detected — Send to replay full mouse trace (clicks + mousemove + keys) on Camoufox'
                        : 'Replay the whole queue on the live Camoufox tab, then refresh the iframe'">
                <span v-if="antiBotDetected">🛡 </span>▶ Send to Camoufox ({{ pickerActions.length }})
              </button>
              <button class="btn btn-secondary btn-sm" @click="stopActionRecording">Stop &amp; collect</button>
            </div>
          </div>
          <div v-if="pickerStrategy === 'cmf'" class="picker-empty-small picker-stage-hint">
            Clicks/typings in the mirror are staged here, not sent live. Build the full sequence then press <strong>Send</strong> — the iframe will refresh once with the post-batch HTML.
          </div>
          <!-- Phase-switch CTA: when the wizard opened the picker for a
               selector / field-picking mode, we land here first (so the
               user can navigate to the right page) and surface a clear
               button to flip into the requested mode when ready. -->
          <div v-if="pickerIntendedMode" class="picker-phase-cta">
            <span>
              🧭 <strong>Navigation mode.</strong>
              Click links / type to drive the live page. When you're on the right page, switch to selection:
            </span>
            <button class="btn btn-primary btn-sm" @click="promoteToIntendedMode">
              📌 Start {{ intendedModeLabel }} →
            </button>
            <!-- Preliminary content box for explore/join: scope the list/results
                 region NOW (during navigation) so the AI link inference (in Ask
                 AI) is focused on it. Optional but recommended. -->
            <template v-if="(pickerOriginIsExplore || pickerOriginIsJoin) && pickerLoadedUrl">
              <button class="btn btn-secondary btn-sm" @click="selectMacroBox"
                      title="Preliminary: click the list/results region so the AI looks for links THERE. Then Start selector picking → Ask AI uses this box.">
                {{ macroBox ? '📦 Content box ✓ (re-pick)' : '📦 Select content box' }}
              </button>
              <button v-if="macroBox" class="btn btn-ghost btn-sm" @click="clearMacroBox" title="Clear content box">✕</button>
            </template>
            <!-- AI auto-suggest fields straight from the navigate phase (field
                 intent only): describe the fields and let the LLM seed + highlight
                 them from THIS page, without first switching to manual selection.
                 (Previously the intent box lived only in the multi-field panel, so
                 it looked like the feature wasn't there while browsing.) -->
            <div v-if="pickerIntendedMode === 'multi-field' && pickerLoadedUrl" class="picker-phase-ai">
              <button class="btn btn-secondary btn-sm" @click="selectMacroBox"
                      title="Click the content region (e.g. the article) — the AI infers fields from THAT box only (focused, no whole-page noise/truncation).">
                {{ macroBox ? '📦 Content box ✓ (re-pick)' : '📦 Select content box' }}
              </button>
              <button v-if="macroBox" class="btn btn-ghost btn-sm" @click="clearMacroBox" title="Clear content box">✕</button>
              <input v-model="aiIntent" type="text" class="text-input"
                     placeholder="describe the fields (e.g. title, author, date, body) — AI picks them"
                     @keyup.enter="macroBox && runAutoSuggestFields()" />
              <button class="btn btn-secondary btn-sm"
                      :disabled="aiLoading || !aiIntent.trim() || !macroBox"
                      :title="!macroBox ? 'Select a content box first (📦)' : 'Infer fields from the selected box'"
                      @click="runAutoSuggestFields">
                <span v-if="aiLoading" class="loading-spinner"></span>
                {{ aiLoading ? 'Thinking…' : '🪄 Auto-suggest fields' }}
              </button>
            </div>
          </div>
          <!-- Pre-Send draft view: just lets the user see WHAT is queued
               and clear it. No "Apply to trace" here — that would
               freeze a draft that hasn't been replayed yet and could
               easily mismatch the live Camoufox tab. Hidden during the
               navigate-first phase (pickerIntendedMode): pure navigation
               must not surface a trace list — you're only positioning the
               mirror, the actions are sent (to advance the page) but not
               recorded. -->
          <pre v-if="pickerActionsYaml && !pickerIntendedMode" class="picker-actions-yaml picker-actions-draft">{{ pickerActionsYaml }}</pre>
          <div v-if="pickerActionsYaml && !pickerIntendedMode" class="picker-actions">
            <button class="btn btn-ghost btn-sm" @click="clearStagedActions">Clear staged</button>
          </div>

          <!-- Apply panel: appears as soon as we have either a loaded
               URL (URL-only commit) OR committed actions (trace + URL
               commit). Lets the user save just the URL onto the fetch
               stage even when they didn't record any picker action —
               useful when the wizard is opened only to pick the target
               URL for a fetch/visit stage. -->
          <div v-if="(committedActions.length || pickerOpenedUrl) && !pickerIntendedMode" class="picker-committed-panel">
            <div class="picker-committed-head">
              <strong v-if="committedActions.length">🎬 Committed on Camoufox: {{ committedActions.length }}</strong>
              <strong v-else>🔗 URL loaded</strong>
              <span class="picker-committed-hint">
                <template v-if="committedActions.length">replayed on the live browser — ready to save as a stage trace</template>
                <template v-else>no actions recorded — applying will seed only the URL on the chosen stage</template>
              </span>
            </div>
            <pre v-if="committedActions.length" class="picker-actions-yaml">{{ committedActionsYaml }}</pre>
            <div v-else class="picker-actions-yaml picker-actions-draft">{{ pickerOpenedUrl }}</div>
            <div v-if="!tracableStages.length" class="picker-empty-small">
              No fetch / visit stage in the pipeline yet — add one and it'll appear here.
            </div>
            <div v-else class="picker-apply-trace">
              <label>Apply to:</label>
              <select v-model.number="applyTraceStageIdx" class="text-input picker-apply-select">
                <option v-for="s in tracableStages" :key="s.idx" :value="s.idx">
                  {{ s.idx + 1 }}. {{ s.stage }}
                </option>
              </select>
              <button class="btn btn-primary btn-sm"
                      :disabled="applyTraceStageIdx == null"
                      @click="applyCommittedTrace"
                      :title="committedActions.length
                        ? 'Save the trace + URL on the chosen stage and close.'
                        : 'Seed just the URL on the chosen stage (no actions recorded).'">
                {{ committedActions.length ? '✅ Apply & continue' : '✅ Use this URL' }}
              </button>
              <button v-if="committedActions.length" class="btn btn-primary btn-sm" @click="copyCommittedTrace">Copy YAML</button>
              <button v-if="committedActions.length" class="btn btn-ghost btn-sm" @click="committedActions = []">Clear</button>
            </div>
          </div>
          <div v-if="!pickerActionsYaml && !committedActions.length && !pickerOpenedUrl" class="picker-empty-small">
            Load a URL above, then either press <strong>✅ Use this URL</strong> to seed only the URL onto a fetch/visit stage, or interact with the page (click input → type → click submit) and press <strong>▶ Send</strong> to record a trace.
          </div>
        </div>
      </div>
    </div>

    <!-- Step warnings / failure modal — replaces the loud red "Load failed"
         banner that used to swap the iframe out (destroying the previous
         view).  Two render paths:
           - stepWarningsError populated → full-step failure (server
             threw, 5xx, network) — show error text.
           - stepWarnings populated → /cmf/step returned 200 but backend
             skipped 1+ actions (Hover on not-stable element, etc.) —
             show per-action table.
         Either way the iframe stays on the previous successful state
         (we don't bump cmfReloadKey on failure) so the operator can
         dismiss the modal and continue from where they were. -->
    <div v-if="stepWarningsOpen" class="picker-modal-backdrop step-warn-backdrop"
         @click.self="stepWarningsOpen = false">
      <div class="picker-modal step-warn-modal">
        <div class="picker-modal-header">
          <strong v-if="stepWarningsError">❌ Step failed</strong>
          <strong v-else>⚠️ Some actions were skipped</strong>
        </div>
        <div class="step-warn-body">
          <p v-if="stepWarningsError" class="step-warn-intro">
            The Camoufox replay couldn't complete. The iframe is still on
            the page you saw BEFORE the failed step — nothing was lost.
            Dismiss this and decide: retry the Send, change strategy
            (wget vs Camoufox), or use ← Back in the address bar to
            navigate the server-side browser to a known-good page.
          </p>
          <p v-else class="step-warn-intro">
            The Camoufox replay ran but {{ stepWarnings.length }}
            action{{ stepWarnings.length === 1 ? '' : 's' }} could not be
            executed (most often: the target element was covered by an
            overlay or animating). The rest of the batch ran and the
            page is on the post-step state — you can keep recording.
          </p>
          <pre v-if="stepWarningsError" class="step-warn-err-block">{{ stepWarningsError }}</pre>
          <table v-if="stepWarnings.length" class="step-warn-table">
            <thead>
              <tr>
                <th>#</th><th>type</th><th>selector</th><th>reason</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(w, idx) in stepWarnings" :key="idx">
                <td class="mono">{{ w.index }}</td>
                <td class="mono">{{ w.type }}</td>
                <td class="mono ellipsis" :title="w.selector">{{ (w.selector || '—').slice(0, 60) }}</td>
                <td class="step-warn-err" :title="w.error">{{ (w.error || '').slice(0, 120) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="step-warn-footer">
          <button class="btn btn-primary btn-sm" @click="dismissStepWarnings">Back</button>
        </div>
      </div>
    </div>

    <!-- Section 3: Private Demo (Authenticated) -->
    <div class="demo-section">
      <div class="section-header">
        <h2>🔐 Private Demo</h2>
        <p>
          Access client-specific demos and plugins. Requires API key authentication.
          <strong>Demo content is customized based on your account.</strong>
        </p>
      </div>

      <!-- Authentication Card -->
      <div v-if="!isAuthenticated" class="auth-card">
        <div class="auth-header">
          <h3>Authenticate to Access Private Demos</h3>
          <p>Enter your API key to view demos available for your account.</p>
        </div>
        
        <div class="form-group">
          <label for="private-api-key">
            API Key:
            <span class="hint">(Stored in session only, not saved)</span>
          </label>
          <input 
            type="password" 
            id="private-api-key"
            v-model="authConfig.apiKey"
            placeholder="Enter your API key"
            class="text-input"
            @keyup.enter="authenticate"
          />
        </div>

        <button 
          class="btn btn-primary"
          :disabled="!authConfig.apiKey.trim() || isAuthenticating"
          @click="authenticate"
        >
          <span v-if="isAuthenticating" class="loading-spinner"></span>
          {{ isAuthenticating ? 'Authenticating...' : 'Authenticate' }}
        </button>

        <div v-if="authError" class="error-content" style="margin-top: 1rem;">
          <p class="error-message">{{ authError }}</p>
        </div>
      </div>

      <!-- Authenticated Content -->
      <div v-else class="authenticated-content">
        <div class="auth-status-bar">
          <div class="auth-info">
            <span class="auth-label">Authenticated as:</span>
            <span class="auth-value">{{ authenticatedUser.name }}</span>
            <span class="badge badge-success">Active</span>
          </div>
          <button class="btn btn-secondary btn-sm" @click="logout">
            Logout
          </button>
        </div>

        <!-- Available Private Demos -->
        <div class="private-demos-grid">
          <div 
            v-for="demo in availablePrivateDemos" 
            :key="demo.id"
            class="private-demo-card"
            :class="{ 'demo-active': selectedPrivateDemo?.id === demo.id }"
            @click="selectPrivateDemo(demo)"
          >
            <div class="demo-icon">{{ demo.icon }}</div>
            <h3>{{ demo.name }}</h3>
            <p class="demo-description">{{ demo.description }}</p>
            <div class="demo-features">
              <span 
                v-for="feature in demo.features" 
                :key="feature"
                class="feature-tag"
              >
                {{ feature }}
              </span>
            </div>
            <div class="demo-status">
              <span :class="['status-indicator', demo.status]"></span>
              {{ demo.status === 'available' ? 'Available' : 'Coming Soon' }}
            </div>
          </div>
        </div>

        <!-- EAN Plugin Demo Interface -->
        <div v-if="selectedPrivateDemo?.id === 'ean-plugin'" class="private-demo-interface">
          <div class="demo-interface-header">
            <h3>EAN Image Sourcing Plugin</h3>
            <p>Upload CSV datasets with EAN codes and extract product images from e-commerce sites.</p>
          </div>

          <div class="ean-workflow">
            <!-- Step 1: Upload CSV -->
            <div class="workflow-step">
              <div class="step-header">
                <span class="step-number">1</span>
                <h4>Upload CSV Dataset</h4>
              </div>
              <div class="step-content">
                <div class="form-group">
                  <label for="ean-country">Country:</label>
                  <select 
                    id="ean-country"
                    v-model="eanConfig.country"
                    class="pipeline-select"
                  >
                    <option value="">-- Select country --</option>
                    <option value="denmark">Denmark</option>
                    <option value="belgium">Belgium</option>
                    <option value="france">France</option>
                    <option value="germany">Germany</option>
                    <option value="italy">Italy</option>
                    <option value="spain">Spain</option>
                    <option value="netherlands">Netherlands</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="ean-file">CSV File:</label>
                  <input 
                    type="file"
                    id="ean-file"
                    accept=".csv"
                    @change="handleFileSelect"
                    class="file-input"
                  />
                  <p class="file-hint">CSV must contain "EAN number" column. Optional: "Item description", "Brand"</p>
                </div>
                <button 
                  class="btn btn-primary"
                  :disabled="!canUploadEAN || isUploading"
                  @click="uploadEANDataset"
                >
                  <span v-if="isUploading" class="loading-spinner"></span>
                  {{ isUploading ? 'Uploading...' : 'Upload Dataset' }}
                </button>
              </div>
            </div>

            <!-- Step 2: Execute Job -->
            <div class="workflow-step">
              <div class="step-header">
                <span class="step-number">2</span>
                <h4>Execute Pipeline</h4>
              </div>
              <div class="step-content">
                <div v-if="eanUploadResult" class="upload-result">
                  <p><strong>Dataset ID:</strong> {{ eanUploadResult.datasetId }}</p>
                  <p><strong>Dataset Name:</strong> {{ eanUploadResult.datasetName }}</p>
                  <p><strong>Status:</strong> <span class="badge badge-success">Uploaded</span></p>
                </div>
                <button 
                  class="btn btn-primary"
                  :disabled="!eanUploadResult || isExecutingEAN"
                  @click="executeEANJob"
                >
                  <span v-if="isExecutingEAN" class="loading-spinner"></span>
                  {{ isExecutingEAN ? 'Executing...' : 'Execute Job' }}
                </button>
              </div>
            </div>

            <!-- Step 3: Query Results -->
            <div class="workflow-step">
              <div class="step-header">
                <span class="step-number">3</span>
                <h4>Query Results</h4>
              </div>
              <div class="step-content">
                <div class="form-group">
                  <label for="ean-query">EAN Codes (comma or line separated):</label>
                  <textarea 
                    id="ean-query"
                    v-model="eanConfig.query"
                    placeholder="8711000429969, 4012824723641&#10;Or one per line:&#10;8711000429969&#10;4012824723641"
                    class="textarea-input"
                    rows="4"
                  ></textarea>
                  <p class="hint">Enter EAN codes separated by commas or one per line</p>
                </div>
                <div class="button-group">
                <button 
                  class="btn btn-primary"
                  :disabled="!eanConfig.query.trim() || isQueryingEAN"
                  @click="queryEANResults"
                >
                  <span v-if="isQueryingEAN" class="loading-spinner"></span>
                    {{ isQueryingEAN ? 'Querying...' : 'Query Results' }}
                  </button>
                  <button 
                    class="btn btn-secondary"
                    :disabled="!eanConfig.query.trim() || isFetchingImages"
                    @click="getEANImagesList"
                  >
                    <span v-if="isFetchingImages" class="loading-spinner"></span>
                    {{ isFetchingImages ? 'Loading...' : 'Get Images List' }}
                </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="eanError" class="error-content" style="margin-top: 1rem;">
            <p class="error-message">{{ eanError }}</p>
          </div>

          <!-- EAN Results Display -->
          <div v-if="eanResults" class="ean-results">
            <div class="results-header">
              <h3>Query Results</h3>
              <span class="badge badge-info">{{ eanResults.length }} records</span>
            </div>
            <div class="results-table-container">
              <table class="results-table">
                <thead>
                  <tr>
                    <th v-for="col in eanTableColumns" :key="col">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in eanResults.slice(0, 10)" :key="idx">
                    <td v-for="col in eanTableColumns" :key="col">
                      {{ formatCellValue(row[col]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- EAN Images List Display -->
          <div v-if="eanImagesList" class="ean-images-list">
            <div class="results-header">
              <h3>Images Matched with EAN Codes</h3>
              <span class="badge badge-info">{{ eanImagesList.length }} EAN codes</span>
            </div>
            <div v-for="eanEntry in eanImagesList" :key="eanEntry.ean" class="ean-images-group">
              <h4>EAN: {{ eanEntry.ean }}</h4>
              <div v-if="eanEntry.images && eanEntry.images.length > 0" class="images-grid">
                <div v-for="(image, idx) in eanEntry.images" :key="idx" class="image-card">
                  <img 
                    :src="image.base64 || image.url" 
                    :alt="`Image ${idx + 1} for EAN ${eanEntry.ean}`"
                    class="product-image"
                    @error="handleImageError"
                  />
                  <div class="image-info">
                    <p class="image-score">Score: {{ (image.score * 100).toFixed(1) }}%</p>
                    <a :href="image.url" target="_blank" class="image-link">View Source</a>
                  </div>
                </div>
              </div>
              <p v-else class="no-images">No images found for this EAN code</p>
            </div>
          </div>
        </div>

        <!-- Placeholder for future demos -->
        <div v-if="selectedPrivateDemo && selectedPrivateDemo.id !== 'ean-plugin'" class="demo-coming-soon">
          <div class="coming-soon-content">
            <h3>{{ selectedPrivateDemo.name }}</h3>
            <p>This demo is coming soon. Check back later for updates.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ───────── Use from CLI / SDK / curl ───────── -->
    <div class="demo-section api-guide">
      <h2>📡 Use the demo from CLI, SDK or plain curl</h2>
      <p>
        Every endpoint this page hits is exposed publicly under
        <code>https://api.webrobot.eu/api/webrobot/api/demo/*</code>.
        No JWT, no API key — same demo posture you see in the browser
        is reachable from any HTTP client. OpenAPI spec at
        <code><a href="https://api.webrobot.eu/api/openapi.json" target="_blank">api.webrobot.eu/api/openapi.json</a></code>
        (216 paths, 25 demo).
      </p>

      <div class="api-guide-grid">
        <div class="api-guide-card">
          <h4>1. List available demo pipelines</h4>
<pre class="code-block code-block-sm"><code>curl -s https://api.webrobot.eu/api/webrobot/api/demo/list \
  | jq '.demos[] | {pipeline_name, is_draft, requires_input_dataset}'</code></pre>
          <p class="api-guide-hint">Returns curated <code>Demo: …</code> entries plus your saved drafts <code>Generated: …</code> (<code>is_draft: true</code>).</p>
        </div>

        <div class="api-guide-card">
          <h4>2. Run an existing pipeline</h4>
<pre class="code-block code-block-sm"><code>EXEC=$(curl -s -X POST \
  https://api.webrobot.eu/api/webrobot/api/demo/execute/01-wiki-us-presidents \
  -H 'content-type: application/json' \
  -d '{"parameters":{"limit":10}}' \
  | jq -r '.execution_id')
echo "execution_id=$EXEC"</code></pre>
          <p class="api-guide-hint">Demo runs are capped at <strong>5–10 records</strong>; ignore <code>limit</code> outside that range.</p>
        </div>

        <div class="api-guide-card">
          <h4>3. Poll status (phase-aware)</h4>
<pre class="code-block code-block-sm"><code>watch -n 3 "curl -s \
  https://api.webrobot.eu/api/webrobot/api/demo/executions/$EXEC/status \
  | jq '{phase, status, executors_ready, executors_total, duration_seconds}'"</code></pre>
          <p class="api-guide-hint"><code>phase</code> = <em>submitting / starting_driver / pulling_executors / running / completed / failed / lost</em>.</p>
        </div>

        <div class="api-guide-card">
          <h4>4. Read the output</h4>
<pre class="code-block code-block-sm"><code># preview rows (via Trino → MinIO/Parquet)
curl -s "https://api.webrobot.eu/api/webrobot/api/demo/executions/$EXEC/output?limit=10" \
  | jq '{source, columns, rows: (.rows | length)}'</code></pre>
          <p class="api-guide-hint">Response includes <code>source: "trino"</code> (preferred) or <code>"minio-direct"</code> (fallback). Format-agnostic.</p>
        </div>

        <div class="api-guide-card">
          <h4>5. Tail driver / executor logs</h4>
<pre class="code-block code-block-sm"><code>curl -s "https://api.webrobot.eu/api/webrobot/api/demo/executions/$EXEC/logs?tail=200&podType=driver"  | jq -r '.logs'
curl -s "https://api.webrobot.eu/api/webrobot/api/demo/executions/$EXEC/logs?tail=200&podType=executor&executorIndex=1" | jq -r '.logs'</code></pre>
          <p class="api-guide-hint">Direct <code>kubectl logs</code>-equivalent, sanitized server-side (secrets / pod names / internal classpaths stripped).</p>
        </div>

        <div class="api-guide-card">
          <h4>6. Save & run your own YAML</h4>
<pre class="code-block code-block-sm"><code>cat &gt; /tmp/my.yaml &lt;&lt;'EOF'
pipeline:
  - stage: wget
    args: ["https://en.wikipedia.org/wiki/Apache_Spark"]
  - stage: extract
    args:
      - { selector: "h1#firstHeading", method: "text", as: "title" }
EOF

curl -s -X POST https://api.webrobot.eu/api/webrobot/api/demo/save-generated-pipeline \
  -H 'content-type: application/json' \
  -d "{\"pipeline_name\":\"my-pipe\",\"pipeline_yaml\":$(jq -Rs . &lt; /tmp/my.yaml),\"execute\":true}" \
  | jq '{agent_id, status, execution: .execution.execution_id}'</code></pre>
          <p class="api-guide-hint">Same YAML schema the wizard emits. The new agent shows up in <code>/demo/list</code> as <code>Generated: my-pipe</code> with <code>is_draft: true</code>.</p>
        </div>

        <div class="api-guide-card">
          <h4>7. Validate selectors (no Spark needed)</h4>
<pre class="code-block code-block-sm"><code>curl -s -X POST https://api.webrobot.eu/api/webrobot/api/demo/wizard/validate \
  -H 'content-type: application/json' \
  -d "{\"yaml\":$(jq -Rs . &lt; /tmp/my.yaml)}" \
  | jq '{valid, record_count, steps: (.steps | map({stage, status}))}'</code></pre>
          <p class="api-guide-hint">Opens an ephemeral Camoufox session, replays the fetch trace, samples up to 5 records. Cheap dry-run before launching the Spark job.</p>
        </div>

        <div class="api-guide-card">
          <h4>8. Live stage catalog</h4>
<pre class="code-block code-block-sm"><code>curl -s https://api.webrobot.eu/api/webrobot/api/demo/catalog/stages \
  | jq '.data[] | {stage_name, args: (.arg_schema | map(.name))}'</code></pre>
          <p class="api-guide-hint">62 stages, dynamic. Same source the wizard reads. New stages here without rebuilding any client.</p>
        </div>
      </div>

      <div class="api-guide-pointers">
        <p>
          <strong>SDKs</strong>:
          <code><a href="https://github.com/WebRobot-Ltd/sdks" target="_blank">github.com/WebRobot-Ltd/sdks</a></code>
          generates Python / TypeScript / PHP / Go clients from the same OpenAPI spec
          (<code>./generate-sdks.sh</code> after a refresh).
        </p>
        <p>
          <strong>CLI</strong>:
          <code><a href="https://github.com/WebRobot-Ltd/webrobot-cli" target="_blank">github.com/WebRobot-Ltd/webrobot-cli</a></code>
          — Scala CLI for the agent / manifest / bundle surface;
          a dedicated <code>demo</code> subcommand is on the roadmap, in the
          meantime the curl recipes above cover the demo flow end-to-end.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

// Pipeline execution state
const selectedPipeline = ref('')
const selectedPipelineInfo = ref(null)
const isExecuting = ref(false)
const executionResult = ref(null)
const loadingPipelines = ref(false)
const pipelinesError = ref(null)

// BYOC — bound two-way to <ByocModeSelector>. executionMode = 'shared'
// is the existing behaviour (shared Spark cluster). 'byoc' adds the
// user's Hetzner token, a VM preset (default 'etl' = 2 executors,
// 0 brain), and the derived vmCount/vmRoles to the execute payload.
// hetznerKey lives in the user's localStorage, namespace 'etl' — see
// ByocModeSelector for the persistence rules. The demo plugin currently
// returns 501 because the Spark ephemeral provisioner isn't wired yet
// (it lands with elastic Ray workers Phase-4).
const executionMode = ref('shared')
// HITL pause-on-captcha toggle — when on, Spark pauses the row on
// captcha detect and waits for an operator to mark the notification
// resolved (via the 🔔 bell → mirror flow) instead of failing fast.
const hitlAwait      = ref(false)
const hitlTimeoutMin = ref('5')   // minutes; clamped to [1, 30]
// Anti-bot detection — set by picker.js postMessage when it spots a
// captcha/WAF indicator while the user is recording. Used to:
//   1. show a banner so the operator knows raw events are being captured
//   2. mark the target stage as requires_hitl so submit-time forces
//      hitlAwait=true (the resulting trace will likely re-hit captcha
//      on every run — needs operator presence)
const antiBotDetected = ref(false)
const antiBotReason   = ref(null)

// Per-step warnings / failure surfaced via modal instead of the loud red
// "Load failed: …" inline banner that swapped the iframe out. Keeping the
// iframe rendered means the user keeps their previous view + can press
// Back to restore. The modal carries:
//  - stepWarnings: per-action skips when /cmf/step returned 200 with a
//    warnings[] array (transient exceptions backend skipped).
//  - stepWarningsError: the full-step exception text when the whole batch
//    threw (server poison, network failure, 500). Either field can be
//    populated; the modal renders whichever is present.
//  - stepWarningsOpen: visibility.
const stepWarnings      = ref([])     // [{ index, type, selector, error }]
const stepWarningsError = ref(null)   // string — full-step error (5xx / poison)
const stepWarningsOpen  = ref(false)
function dismissStepWarnings() {
  stepWarningsOpen.value  = false
  stepWarnings.value      = []
  stepWarningsError.value = null
  // TODO (deferred per user): on dismiss after a full-step failure,
  // optionally also goBackInCamoufox() so server state matches the
  // iframe view exactly.  For now the iframe naturally stays on the
  // previous successful HTML (we never bumped cmfReloadKey on failure)
  // — visually correct, server may be one step ahead until next op.
}
const hetznerKey    = ref('')
const vmPreset      = ref('etl')        // ETL context default — 2 × executor
const vmCount       = ref(2)
const vmRoles       = ref(['executor', 'executor'])

// CSV upload state for demo pipelines
const demoUploadFile = ref(null)
const demoCsvText = ref('')
// 'none' = auto-attach a 1-row trigger CSV (works for wow-* demos that
// seed from a literal URL); 'file' = user picks a CSV file; 'manual' =
// CSV pasted into a textarea. Default to 'none' so the new wow demos
// run with a single click — legacy EAN-style demos can still toggle.
const csvInputMode = ref('none')
const isUploadingDemoDataset = ref(false)
const demoUploadResult = ref(null)
const demoUploadError = ref(null)
const showUploadModal = ref(false)
const showPipelineYaml = ref(false)
const showPipelineStages = ref(false)

// JWT authentication state for demo endpoints
const demoJwtToken = ref(null)
const isAuthenticatingDemo = ref(false)
const demoAuthError = ref(null)

// Demo credentials
const DEMO_EMAIL = 'demo@webrobot.eu'
const DEMO_PASSWORD = 'demo2026'
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || 'https://strapi.webrobot.eu'

// Pipeline generation state. LLM provider + API key are no longer needed
// here: the backend uses the server's own LLM credential (auto-detected,
// Groq by default).
const generationConfig = ref({
  prompt: ''
})
const isGenerating = ref(false)
const generatedPipeline = ref(null)
// Mirrors executionResult so saveAndExecute can show records under the
// generated YAML preview.
const generationExecutionResult = ref(null)

// Private demo authentication state
const authConfig = ref({
  apiKey: ''
})
const isAuthenticating = ref(false)
const isAuthenticated = ref(false)
const authError = ref(null)
const authenticatedUser = ref(null)
const authenticatedOrganizationId = ref(null) // Store organization_id from API
const selectedPrivateDemo = ref(null)

// Private demos available (extensible structure)
// Each demo can be associated with specific organization_ids
// 
// organizationId assignment rules:
// - null or undefined: demo is available to ALL organizations
// - string (e.g., 'org-123'): demo is available ONLY to that specific organization
// - array (e.g., ['org-1', 'org-2']): demo is available to multiple organizations listed
//
// To add a new demo, copy the structure below and assign the appropriate organizationId
const availablePrivateDemos = ref([
  {
    id: 'ean-plugin',
    name: 'EAN Image Sourcing',
    icon: '🖼️',
    description: 'Upload EAN codes and extract product images from e-commerce sites',
    features: ['CSV Upload', 'Image Extraction', 'SQL Query', 'Multi-country'],
    status: 'available',
    plugin: 'ean-image-sourcing',
    organizationId: null // Available to all organizations - change to specific org ID(s) to restrict access
  }
  // 
  // ADD MORE DEMOS HERE - Examples:
  //
  // Demo for a single organization:
  // {
  //   id: 'custom-plugin-org1',
  //   name: 'Custom Plugin for Organization 1',
  //   icon: '🔧',
  //   description: 'Custom plugin available only to organization 1',
  //   features: ['Feature 1', 'Feature 2'],
  //   status: 'available',
  //   plugin: 'custom-plugin-org1',
  //   organizationId: 'org-1' // Replace 'org-1' with actual organization_id
  // },
  //
  // Demo for multiple organizations:
  // {
  //   id: 'shared-plugin',
  //   name: 'Shared Plugin',
  //   icon: '📦',
  //   description: 'Plugin available to multiple organizations',
  //   features: ['Feature A', 'Feature B'],
  //   status: 'available',
  //   plugin: 'shared-plugin',
  //   organizationId: ['org-1', 'org-2', 'org-3'] // Replace with actual organization_ids
  // },
  //
  // Demo available to all (public demo):
  // {
  //   id: 'public-demo',
  //   name: 'Public Demo',
  //   icon: '🌐',
  //   description: 'Demo available to everyone',
  //   features: ['Public Feature'],
  //   status: 'available',
  //   plugin: 'public-demo',
  //   organizationId: null // null = available to all
  // }
])

// EAN Plugin state
const eanConfig = ref({
  country: '',
  query: '',
  file: null,
  cloudCredentialId: '' // Optional: cloud credential ID for execution
})
const isUploading = ref(false)
const isExecutingEAN = ref(false)
const isQueryingEAN = ref(false)
const isFetchingImages = ref(false)
const eanUploadResult = ref(null)
const eanResults = ref(null)
const eanImagesList = ref(null) // Lista immagini matchate con EAN code
const eanTableColumns = ref([])
const eanError = ref(null)

// Available pipelines - loaded dynamically from backend
const availablePipelines = ref([])

/**
 * Camoufox picker iframe URL — points at the Jersey proxy endpoint that
 * serves the session's live HTML + every asset roundtrip via the live
 * Camoufox BrowserContext. cmfReloadKey is bumped on every committed
 * /cmf/step so the iframe refreshes to show the post-action DOM.
 */
const cmfIframeSrc = computed(() => {
  if (!cmfSessionId.value) return ''
  return `${API_BASE_URL}/api/webrobot/api/demo/wizard/iframe/${encodeURIComponent(cmfSessionId.value)}/?_v=${cmfReloadKey.value}`
})

/**
 * Group pipelines by category for the gallery <optgroup>. Returns an array
 * of { category, items } in a stable order:
 *   1. Real categories sorted alphabetically (case-insensitive).
 *   2. "Uncategorized" last (only present if any pipeline has no category).
 * Drafts inside each group sort to the bottom — non-drafts first.
 */
const pipelinesByCategory = computed(() => {
  const map = new Map()
  for (const p of availablePipelines.value) {
    const cat = p.categoryName || 'Uncategorized'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(p)
  }
  const groups = Array.from(map.entries()).map(([category, items]) => ({
    category,
    items: items.slice().sort((a, b) => {
      if (a.isDraft !== b.isDraft) return a.isDraft ? 1 : -1
      return (a.name || '').localeCompare(b.name || '')
    })
  }))
  groups.sort((a, b) => {
    if (a.category === 'Uncategorized') return 1
    if (b.category === 'Uncategorized') return -1
    return a.category.toLowerCase().localeCompare(b.category.toLowerCase())
  })
  return groups
})

// Initialize: try to load stored JWT token and auto-authenticate on mount
onMounted(async () => {
  const storedToken = localStorage.getItem('demo_jwt_token')
  if (storedToken) {
    demoJwtToken.value = storedToken
  }
  // Auto-authenticate and load pipelines on mount
  try {
    await authenticateDemo()
    await loadPipelines()
  } catch (error) {
    console.error('Failed to initialize demo:', error)
  }

  // Wizard catalog (independent of the demo list).
  loadStageCatalog()

  // Reattach any in-flight execution from a previous session. localStorage
  // carries execution_id + pipeline_name + output_dataset_id; if the run
  // is already terminal the panel still renders but polling self-stops.
  const restored = loadExecutionState()
  if (restored && restored.execution_id) {
    executionState.value = restored
    startExecPolling()
  }

  // Picker iframe postMessage bridge.
  window.addEventListener('message', onPickerMessage)
})

onBeforeUnmount(() => {
  stopExecPolling()
  window.removeEventListener('message', onPickerMessage)
})

// Computed properties
const canGenerate = computed(() => {
  return generationConfig.value.prompt.trim() !== ''
})

// Methods
// Authenticate with Strapi and get JWT token for demo endpoints
async function authenticateDemo() {
  // Check if token is already stored in localStorage
  const storedToken = localStorage.getItem('demo_jwt_token')
  if (storedToken) {
    demoJwtToken.value = storedToken
    return storedToken
  }
  
  isAuthenticatingDemo.value = true
  demoAuthError.value = null
  
  try {
    // Login to Strapi to get JWT token
    const loginResponse = await fetch(`${STRAPI_URL}/api/auth/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identifier: DEMO_EMAIL,
        password: DEMO_PASSWORD
      })
    })
    
    if (!loginResponse.ok) {
      throw new Error(`Failed to authenticate: ${loginResponse.statusText}`)
    }
    
    const loginData = await loginResponse.json()
    const token = loginData.jwt || loginData.data?.jwt
    
    if (!token) {
      throw new Error('JWT token not found in login response')
    }
    
    // Store token in localStorage and state
    localStorage.setItem('demo_jwt_token', token)
    demoJwtToken.value = token
    
    return token
  } catch (error) {
    console.error('Demo authentication error:', error)
    demoAuthError.value = error instanceof Error ? error.message : 'Failed to authenticate'
    throw error
  } finally {
    isAuthenticatingDemo.value = false
  }
}

// Helper function to get JWT token (authenticates if needed)
async function getDemoJwtToken() {
  if (demoJwtToken.value) {
    return demoJwtToken.value
  }
  return await authenticateDemo()
}

// Helper function to make authenticated fetch requests
async function authenticatedDemoFetch(url, options = {}) {
  try {
    const token = await getDemoJwtToken()
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    })
    
    // If 401, try to re-authenticate once
    if (response.status === 401) {
      localStorage.removeItem('demo_jwt_token')
      demoJwtToken.value = null
      const newToken = await authenticateDemo()
      
      headers['Authorization'] = `Bearer ${newToken}`
      
      return await fetch(url, {
        ...options,
        headers
      })
    }
    
    return response
  } catch (error) {
    console.error('Authenticated fetch error:', error)
    throw error
  }
}

// Load available pipelines from backend
async function loadPipelines() {
  loadingPipelines.value = true
  pipelinesError.value = null
  
  try {
    const response = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/list`, {
      method: 'GET'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to load pipelines: ${response.statusText}`)
    }
    
    const data = await response.json()
    const demos = data.demos || []

    // Map backend demo format to frontend format
    availablePipelines.value = demos.map((demo) => ({
      id: demo.pipeline_name || demo.name,
      name: demo.display_name || demo.name || demo.pipeline_name,
      description: demo.description || 'No description available',
      source: demo.source || demo.pipeline_name,
      docLink: demo.doc_link || `https://docs.webrobot.eu`,
      stages: demo.stages || [],
      requiresInputDataset: demo.requires_input_dataset || false,
      csvFormatDescription: demo.csv_format_description || null,
      pipelineYaml: demo.pipeline_yaml || null,
      isDraft: !!demo.is_draft,  // backend marks wizard-saved pipelines (Generated:* agents) so the selector can flag them
      categoryId: demo.category_id ?? null,
      categoryName: demo.category_name || 'Uncategorized'
    }))
    
  } catch (error) {
    console.error('Error loading pipelines:', error)
    pipelinesError.value = error instanceof Error ? error.message : 'Failed to load pipelines'
    // Fallback to empty array - user will see error message
    availablePipelines.value = []
  } finally {
    loadingPipelines.value = false
  }
}

function onPipelineSelected() {
  const pipeline = availablePipelines.value.find(p => p.id === selectedPipeline.value)
  selectedPipelineInfo.value = pipeline || null
  executionResult.value = null
  showPipelineYaml.value = false // Reset YAML visibility when selecting a new pipeline
  showPipelineStages.value = false // Reset stages visibility when selecting a new pipeline
  
  // Debug: log selected pipeline info
  if (pipeline) {
    console.log('Selected pipeline:', {
      id: pipeline.id,
      name: pipeline.name,
      requiresInputDataset: pipeline.requiresInputDataset,
      csvFormatDescription: pipeline.csvFormatDescription
    })
  }
  
  // Reset upload state when selecting a new pipeline
  demoUploadFile.value = null
  demoUploadResult.value = null
  demoUploadError.value = null
}

function handleDemoFileSelect(event) {
  const target = event.target
  if (target && target.files && target.files.length > 0) {
    demoUploadFile.value = target.files[0]
    demoUploadError.value = null
  }
}

function getCsvRowCount(csvText) {
  if (!csvText || !csvText.trim()) return 0
  const lines = csvText.trim().split('\n').filter(line => line.trim().length > 0)
  return lines.length
}

async function uploadDemoDataset() {
  if (!selectedPipeline.value) return

  // Validate input based on mode
  if (csvInputMode.value === 'file' && !demoUploadFile.value) return
  if (csvInputMode.value === 'manual' && (!demoCsvText.value || !demoCsvText.value.trim())) return
  // 'none' mode has no user input to validate — we synthesize a 1-row CSV below

  isUploadingDemoDataset.value = true
  demoUploadError.value = null

  try {
    const token = await getDemoJwtToken()
    const formData = new FormData()

    // Prepare file based on input mode.
    //   'file'   — user-selected file
    //   'manual' — textarea contents wrapped as a Blob
    //   'none'   — synthesize a minimal 1-row CSV ("trigger\ngo"). The
    //              demo plugin requires an input_dataset for every demo
    //              (PipelineParser auto-injects load_csv as the first
    //              stage). Pipelines whose first real stage is a literal
    //              wget/fetch (Wikipedia, HN, …) ignore the row contents
    //              — they just need ONE row so the fan-out produces ONE
    //              seed downstream. This trigger CSV is the smallest
    //              viable input for that case.
    let fileToUpload
    if (csvInputMode.value === 'file') {
      fileToUpload = demoUploadFile.value
    } else if (csvInputMode.value === 'manual') {
      // Convert manual CSV text to File
      const csvBlob = new Blob([demoCsvText.value], { type: 'text/csv' })
      fileToUpload = new File([csvBlob], 'manual-input.csv', { type: 'text/csv' })
    } else {
      // csvInputMode.value === 'none' — synthesize trigger CSV
      const triggerCsv = 'trigger\ngo\n'
      const triggerBlob = new Blob([triggerCsv], { type: 'text/csv' })
      fileToUpload = new File([triggerBlob], 'trigger.csv', { type: 'text/csv' })
    }

    formData.append('file', fileToUpload)
    
    const pipelineName = selectedPipeline.value
    const response = await fetch(`${API_BASE_URL}/api/webrobot/api/demo/upload-dataset/${encodeURIComponent(pipelineName)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Upload failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    demoUploadResult.value = result
  } catch (error) {
    console.error('Upload error:', error)
    demoUploadError.value = error instanceof Error ? error.message : 'Failed to upload dataset'
  } finally {
    isUploadingDemoDataset.value = false
  }
}

function handleExecutePipeline() {
  if (!selectedPipeline.value) return
  
  // If pipeline requires input dataset, show modal first
  if (selectedPipelineInfo.value && selectedPipelineInfo.value.requiresInputDataset) {
    // If dataset already uploaded, execute directly
    if (demoUploadResult.value && demoUploadResult.value.datasetId) {
      executePipeline()
    } else {
      // Show upload modal
      showPipelineYaml.value = false // Reset YAML visibility when opening modal
      showPipelineStages.value = false // Reset stages visibility when opening modal
      csvInputMode.value = 'none' // Reset to auto-trigger mode
      showUploadModal.value = true
      // Reset upload state
      demoUploadFile.value = null
      demoCsvText.value = ''
      demoUploadResult.value = null
      demoUploadError.value = null
    }
  } else {
    // Pipeline doesn't require input, execute directly
    executePipeline()
  }
}

function closeUploadModal() {
  showUploadModal.value = false
  showPipelineYaml.value = false // Reset YAML visibility when closing modal
  showPipelineStages.value = false // Reset stages visibility when closing modal
  csvInputMode.value = 'none' // Reset to auto-trigger mode
  demoUploadFile.value = null
  demoCsvText.value = ''
  demoUploadResult.value = null
  demoUploadError.value = null
}

async function uploadAndExecute() {
  // Validate input based on mode
  if (csvInputMode.value === 'file' && !demoUploadFile.value) return
  if (csvInputMode.value === 'manual' && (!demoCsvText.value || !demoCsvText.value.trim())) return

  // First upload the dataset
  await uploadDemoDataset()

  // If upload successful, execute pipeline
  if (demoUploadResult.value && demoUploadResult.value.datasetId) {
    // Save datasetId before closing modal (which resets demoUploadResult)
    const datasetId = demoUploadResult.value.datasetId
    // Safeguard BEFORE launch: if the saved pipeline references a $col but
    // has no load_* loader, the uploaded dataset would be ignored (fetch
    // self-seeds, $col → null). Prepend load_csv ${INPUT_CSV_PATH} + persist
    // so the dataset drives the run. Covers pipelines templatized before the
    // prepend fix (e.g. $keyword without load_csv).
    await ensureSavedPipelineLoader()
    // Variable gate: the dataset (and its columns) is now known — detect
    // parameterizable values in the SAVED pipeline's YAML and let the user
    // bind them to a column before the Spark job submits. If gated, the
    // launch resumes from applyVariableBindings / skipVariableGate. If no
    // candidates (or detection fails) → proceed to execute as before.
    const gated = await maybeGateSavedExecute(datasetId)
    if (gated) return
    closeUploadModal()
    // Execute with the saved datasetId
    executePipeline(datasetId)
  }
}

// Pre-launch safeguard: if the selected saved pipeline contains a $col
// reference (e.g. `$keyword` in a trace/url) but no load_* loader stage,
// prepend load_csv ${INPUT_CSV_PATH} and persist it, so the uploaded dataset
// actually drives the pipeline. A $-token followed by a letter is a column
// reference; `${ENV}` placeholders (e.g. ${INPUT_CSV_PATH}) are NOT matched
// because `$` is followed by `{`.
async function ensureSavedPipelineLoader() {
  const yaml = (selectedPipelineInfo.value && selectedPipelineInfo.value.pipelineYaml) || ''
  if (!yaml) return
  const hasColRef = /\$[A-Za-z_]\w*/.test(yaml)
  if (!hasColRef || yamlHasInputLoader(yaml)) return
  const newYaml = ensureInputLoaderInYaml(yaml)
  if (newYaml === yaml) return
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/apply-variables`, {
      method: 'POST',
      body: JSON.stringify({ pipeline_name: selectedPipeline.value, pipeline_yaml: newYaml }),
    })
    const j = await r.json()
    if (r.ok && selectedPipelineInfo.value) selectedPipelineInfo.value.pipelineYaml = newYaml
    else if (!r.ok) console.warn('[demo] ensureSavedPipelineLoader persist failed:', j && j.error)
  } catch (e) {
    console.warn('[demo] ensureSavedPipelineLoader error:', e)
  }
}

// Columns for the variable gate, derived from the just-uploaded CSV: prefer
// the upload response's columns, else parse the header row of the manual CSV
// text. Empty → the modal lets the user type a column name.
function csvColumnsFromUpload() {
  const res = demoUploadResult.value
  if (res && Array.isArray(res.columns) && res.columns.length) return res.columns
  if (csvInputMode.value === 'manual' && demoCsvText.value) {
    const firstLine = demoCsvText.value.split(/\r?\n/)[0] || ''
    return firstLine.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  }
  return []
}

// Launch gate for the Upload & Execute (saved-pipeline) path. Returns true
// if the modal was opened (caller must halt); false to proceed to execute.
async function maybeGateSavedExecute(datasetId) {
  try {
    const srcYaml = (selectedPipelineInfo.value && selectedPipelineInfo.value.pipelineYaml) || ''
    if (!srcYaml) return false
    const cols = csvColumnsFromUpload()
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-variables`, {
      method: 'POST',
      body: JSON.stringify({ pipeline_yaml: srcYaml, dataset_columns: cols }),
    })
    const j = await r.json()
    if (!r.ok) return false
    const vars = (Array.isArray(j.variables) ? j.variables : [])
      .filter(v => v && typeof v.current === 'string' && !v.current.trim().startsWith('$'))
    if (!vars.length) return false
    varDetectColumns.value = cols.join(', ')
    varDetectResults.value = vars
    varBindings.value = vars.map(defaultBindingFor)
    varDetectRan.value = true
    varDetectError.value = null
    varGateExecute.value = false
    varGateSaved.value = { datasetId }
    varDetectOpen.value = true
    return true
  } catch (e) {
    return false
  }
}

// Rewrite a saved pipeline's YAML STRING: replace each column-bound
// variable's current literal with `$column`. Quoted forms first to avoid
// partial hits. Returns the new YAML + how many substitutions landed.
function rewriteYamlVariables(yamlStr, results, bindings) {
  let out = yamlStr
  let count = 0
  results.forEach((v, vi) => {
    const b = bindings[vi]
    if (!b || b.mode !== 'column') return
    const col = (b.column || '').trim().replace(/^\$+/, '')
    if (!col || !v.current) return
    const token = '$' + col
    const cur = String(v.current)
    const before = out
    out = out.split(`"${cur}"`).join(`"${token}"`)
    if (out === before) out = out.split(`'${cur}'`).join(`'${token}'`)
    if (out === before) out = out.split(cur).join(token)
    if (out !== before) count++
  })
  return { yaml: out, count }
}

// Prepend a `load_csv ${INPUT_CSV_PATH}` stage to a YAML STRING when none of
// the load_* loaders is present — so the uploaded dataset's rows drive the
// pipeline and the freshly-inserted $col references resolve per row. Mirrors
// ensureInputLoader() for the in-memory path.
// True if the YAML already pulls the input dataset in: ANY load* loader
// stage (load_csv, load_parquet, load_json, load_postgres, load_union,
// loadCsv, …) or an explicit ${INPUT_CSV_PATH} reference.
function yamlHasInputLoader(yamlStr) {
  return /stage:\s*["']?load/i.test(yamlStr) || /\$\{INPUT_CSV_PATH\}/.test(yamlStr)
}
function ensureInputLoaderInYaml(yamlStr) {
  if (yamlHasInputLoader(yamlStr)) return yamlStr
  return yamlStr.replace(/(^|\n)(pipeline:[ \t]*\n)/,
    `$1$2  - stage: load_csv\n    args:\n      - "\${INPUT_CSV_PATH}"\n`)
}

// Apply path for the saved-pipeline gate: rewrite + persist the YAML on the
// backend, then execute the (now-updated) pipeline with the dataset.
async function applyVariableBindingsSaved() {
  const dsId = varGateSaved.value ? varGateSaved.value.datasetId : null
  const srcYaml = (selectedPipelineInfo.value && selectedPipelineInfo.value.pipelineYaml) || ''
  let { yaml: newYaml, count } = rewriteYamlVariables(srcYaml, varDetectResults.value, varBindings.value)
  // If we turned anything into a $col, make sure the input dataset is loaded
  // so those columns exist at runtime.
  if (count > 0) newYaml = ensureInputLoaderInYaml(newYaml)
  varDetectOpen.value = false
  varGateSaved.value = null
  if (count > 0 && newYaml !== srcYaml) {
    try {
      const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/apply-variables`, {
        method: 'POST',
        body: JSON.stringify({ pipeline_name: selectedPipeline.value, pipeline_yaml: newYaml }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'apply-variables failed')
      if (selectedPipelineInfo.value) selectedPipelineInfo.value.pipelineYaml = newYaml
    } catch (e) {
      demoUploadError.value = 'Error applying variables: ' + (e.message || String(e))
      return  // don't run a half-rewritten pipeline; leave the upload modal open
    }
  }
  closeUploadModal()
  if (dsId != null) executePipeline(dsId)
}

async function executePipeline(datasetIdParam = null) {
  if (!selectedPipeline.value) return
  
  isExecuting.value = true
  executionResult.value = null
  
  try {
    // Get pipeline name from selected pipeline
    const pipelineName = selectedPipeline.value
    
    // Build request body with parameters
    const requestBody = {
      parameters: {
        limit: 10 // Demo limit
      }
    }
    
    // Use datasetId from parameter (from uploadAndExecute) or from demoUploadResult
    const datasetIdToUse = datasetIdParam || (demoUploadResult.value && demoUploadResult.value.datasetId)
    
    // If pipeline requires input dataset and we have a datasetId, include it
    if (selectedPipelineInfo.value && selectedPipelineInfo.value.requiresInputDataset && datasetIdToUse) {
      requestBody.parameters.datasetId = datasetIdToUse
      console.log('Executing pipeline with datasetId:', datasetIdToUse)
    } else if (selectedPipelineInfo.value && selectedPipelineInfo.value.requiresInputDataset) {
      console.warn('Pipeline requires input dataset but no datasetId provided!')
    }
    
    // BYOC fields — sent only when the user explicitly opts in via
    // the ByocModeSelector. cloudCredentials.hetznerApiKey is the
    // user's own token; we never echo it to logs (request body logs
    // below pre-stringify so the token would leak — sanitise it).
    requestBody.executionMode = executionMode.value
    if (executionMode.value === 'byoc' && hetznerKey.value) {
      requestBody.cloudCredentials = { hetznerApiKey: hetznerKey.value }
      requestBody.vmPreset = vmPreset.value
      requestBody.vmCount  = vmCount.value
      requestBody.vmRoles  = vmRoles.value
    }
    // HITL pause-on-captcha — when the user opts in, the Spark
    // executor's CaptchaDetector long-polls Strapi for an operator to
    // resolve the captcha via the mirror UI instead of failing the
    // row. The timeout sets how long Spark waits before giving up
    // and marking the row failed.
    //
    // The HITL checkbox is the single source of truth. Anti-bot
    // detection during recording auto-CHECKS the box (onAntiBotDetected
    // flips hitlAwait + surfaces a warning), so the operator is informed
    // — but unchecking it must win. We no longer force HITL from a stale
    // _requires_hitl row tag: a false-positive anti-bot trip (e.g. a
    // plain forum) would otherwise lock the pipeline into pause-on-captcha
    // forever, against the operator's explicit choice.
    if (hitlAwait.value) {
      requestBody.hitlAwait = true
      const tMinutes = Math.max(1, Math.min(30, parseInt(hitlTimeoutMin.value || '5', 10)))
      requestBody.hitlTimeoutMs = tMinutes * 60_000
    }

    // Log a redacted copy so we don't dump the BYOC token to the
    // console.
    const redactedForLog = {
      ...requestBody,
      cloudCredentials: requestBody.cloudCredentials
        ? { hetznerApiKey: '***redacted***' }
        : undefined,
    }
    console.log('Executing pipeline request:', JSON.stringify(redactedForLog, null, 2))

    // Call backend API to execute demo pipeline
    const response = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/execute/${encodeURIComponent(pipelineName)}`, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Execution failed: ${response.statusText}`)
    }
    
    const result = await response.json()

    // Brief acknowledgement — the live execution panel below takes over
    // for status / logs / output preview. No more long-poll blocking the
    // submit call.
    executionResult.value = {
      status: result.status || 'success',
      jobId: result.job_id,
      agentId: result.agent_id,
      recordsProcessed: result.record_limit || 10,
      executionTime: 0,
      message: result.message || 'Pipeline submitted — see Execution status below.',
      preview: [],
      note: result.note || '',
      outputDatasetId: result.output_dataset_id,
      polling: false
    }

    if (result.execution_id) {
      attachToExecution(result.execution_id, pipelineName, result.output_dataset_id)
    }

  } catch (error) {
    console.error('Execution error:', error)
    executionResult.value = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to execute pipeline'
    }
  } finally {
    isExecuting.value = false
  }
}

/**
 * Poll a SELECT query against the output dataset until rows are available
 * (or the timeout elapses).
 *
 * The demo plugin returns SUBMITTED right after Spark submit — actual
 * parquet write + Trino indexing take 20–90s typical. The Spark job's
 * completion webhook (POST .../jobs/{id}/completion) is what creates and
 * indexes the Trino table with the real schema, so this helper just
 * waits on rows.
 *
 * Do NOT call POST /datasets/{id}/index from the UI: triggering indexing
 * before Spark has written the parquet leaves a `_placeholder VARCHAR`
 * schema stuck on the dataset, which then shadows the real schema.
 *
 * @param {string|number} datasetId  output dataset id (numeric, as string)
 * @param {number} limit             max rows to return
 * @param {number} timeoutMs         total time budget
 * @param {number} pollEveryMs       polling interval
 */
async function pollDemoOutputRecords(datasetId, limit = 10, timeoutMs = 120000, pollEveryMs = 5000) {
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const queryResp = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/datasets/query`, {
        method: 'POST',
        body: JSON.stringify({ sql: `SELECT * FROM [${datasetId}] LIMIT ${limit}` })
      })
      if (queryResp.ok) {
        const queryResult = await queryResp.json()
        if (queryResult && queryResult.success && Array.isArray(queryResult.data) && queryResult.data.length > 0) {
          return queryResult.data
        }
        lastErr = queryResult && queryResult.error ? queryResult.error : null
      } else {
        lastErr = `HTTP ${queryResp.status}`
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    await new Promise(r => setTimeout(r, pollEveryMs))
  }
  if (lastErr) {
    throw new Error(`Polling exhausted (${Math.round(timeoutMs/1000)}s) — last error: ${lastErr}`)
  }
  return []
}

async function generatePipeline() {
  if (!canGenerate.value) return

  isGenerating.value = true
  generatedPipeline.value = null
  generationExecutionResult.value = null

  try {
    const response = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/generate-pipeline`, {
      method: 'POST',
      body: JSON.stringify({
        prompt: generationConfig.value.prompt
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Generation failed: ${response.statusText}`)
    }

    const result = await response.json()
    if (result && result.error) {
      throw new Error(result.error)
    }

    generatedPipeline.value = result.pipeline_yaml || result.yaml || result.pipeline || ''

    if (!generatedPipeline.value) {
      throw new Error('No pipeline YAML returned from API')
    }
  } catch (error) {
    console.error('Generation error:', error)
    alert(error instanceof Error ? error.message : 'Failed to generate pipeline')
    generatedPipeline.value = null
  } finally {
    isGenerating.value = false
  }
}

function formatPreview(preview) {
  return JSON.stringify(preview, null, 2)
}

function copyPipelineYamlToClipboard() {
  if (!selectedPipelineInfo.value || !selectedPipelineInfo.value.pipelineYaml) return
  try {
    navigator.clipboard.writeText(selectedPipelineInfo.value.pipelineYaml)
    alert('Pipeline YAML copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy YAML:', error)
    alert('Failed to copy YAML to clipboard')
  }
}

function copyToClipboard() {
  if (generatedPipeline.value) {
    navigator.clipboard.writeText(generatedPipeline.value)
    alert('YAML copied to clipboard!')
  }
}

function downloadYAML() {
  if (!generatedPipeline.value) return
  
  const blob = new Blob([generatedPipeline.value], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pipeline-${Date.now()}.yaml`
  a.click()
  URL.revokeObjectURL(url)
}

async function saveAndExecute() {
  if (!generatedPipeline.value) {
    alert('No pipeline to save. Please generate a pipeline first.')
    return
  }

  generationExecutionResult.value = {
    status: 'submitting',
    message: 'Saving pipeline and submitting Spark job…',
    polling: false
  }

  try {
    const pipelineName = `generated-pipeline-${Date.now()}`

    const response = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/save-generated-pipeline`, {
      method: 'POST',
      body: JSON.stringify({
        pipeline_name: pipelineName,
        pipeline_yaml: generatedPipeline.value,
        execute: true
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Save & execute failed: ${response.statusText}`)
    }

    const result = await response.json()
    const exec = result.execution || {}

    generationExecutionResult.value = {
      status: result.status || 'saved-and-executed',
      jobId: exec.job_id,
      agentId: result.agent_id,
      outputDatasetId: exec.output_dataset_id,
      pipelineName: result.pipeline_name || pipelineName,
      message: result.message || 'Pipeline saved and execution submitted.',
      preview: [],
      polling: false,
      pollingMessage: null
    }

    // Hand off to the live Execution panel — same as the executePipeline
    // path. The previous inline long-poll is gone.
    if (exec.execution_id) {
      attachToExecution(exec.execution_id, pipelineName, exec.output_dataset_id)
    }
  } catch (error) {
    console.error('Save & execute error:', error)
    generationExecutionResult.value = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to save & execute pipeline'
    }
  }
}

// ─── Reattach + live status / logs / output preview ─────────────────
// Mirrors the in-flight execution UX from the Jersey-bundled demo SPA:
// localStorage persists the run id across tab closes; polling resumes
// on mount. No long-poll inside the submit call — submit hands off to
// attachToExecution() and the panel takes over.

const LS_KEY = 'webrobot.demo.activeExecution'
const TERMINAL_STATUSES = new Set(['COMPLETED', 'SUCCEEDED', 'FAILED', 'CANCELLED'])
const STATUS_POLL_MS = 5000
const LOGS_POLL_MS   = 8000

const executionState = ref(null)   // {execution_id, pipeline_name, output_dataset_id, started_at}
const execPanelEl    = ref(null)   // template ref for the exec panel — used to scrollIntoView after Save & Run
const statusData     = ref(null)   // latest /status response
const logsText       = ref('')     // raw sanitized blob (kept for back-compat)
const logsLines      = ref([])     // parsed log entries: [{timestamp, level, message}]
const logsExecutors  = ref([])     // executor indices reported by server (e.g. [0, 1, 2])
const logsPodType    = ref('driver')        // 'driver' | 'executor'
const logsExecutorIndex = ref(null)         // null = first/any executor
const logsTail          = ref(200)          // matches server default
const logsAutoRefresh   = ref(true)         // toggled off when user wants to scroll quietly
const outputPreview  = ref(null)   // {format, columns, rows, truncated, note}
let statusTimerId = null
let logsTimerId   = null

function loadExecutionState() {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null }
  catch { return null }
}
function saveExecutionStateLs(s) {
  executionState.value = s
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}
function clearExecutionState() {
  executionState.value = null
  statusData.value = null
  logsText.value = ''
  logsLines.value = []
  logsExecutors.value = []
  outputPreview.value = null
  try { localStorage.removeItem(LS_KEY) } catch {}
}

function stopExecPolling() {
  if (statusTimerId) { clearInterval(statusTimerId); statusTimerId = null }
  if (logsTimerId)   { clearInterval(logsTimerId);   logsTimerId   = null }
}
function startExecPolling() {
  stopExecPolling()
  pollStatusOnce()
  pollLogsOnce()
  statusTimerId = setInterval(pollStatusOnce, STATUS_POLL_MS)
  if (logsAutoRefresh.value) {
    logsTimerId = setInterval(pollLogsOnce, LOGS_POLL_MS)
  }
}
function onLogsAutoRefreshToggle() {
  if (logsTimerId) { clearInterval(logsTimerId); logsTimerId = null }
  if (logsAutoRefresh.value && executionState.value) {
    logsTimerId = setInterval(pollLogsOnce, LOGS_POLL_MS)
    pollLogsOnce()
  }
}
function onLogsPodTypeChange() {
  // Switching driver → executor must reset the index — otherwise the
  // request would carry an executorIndex that doesn't make sense.
  logsExecutorIndex.value = null
  pollLogsOnce()
}

// Defense-in-depth: even though DemoLogSanitizer.sanitize ran server-side,
// mask anything that still looks credential-shaped before painting it
// in the DOM. Mirrors maskSensitiveInfo() from the Next.js portal but
// kept narrow — the heavy lifting is already done upstream.
function maskLogLine(s) {
  if (!s) return ''
  let out = String(s)
  // Presigned-URL query strings.
  out = out.replace(/(https?:\/\/[^\s?]+)\?[^\s]*(X-Amz-Signature|X-Amz-Credential|Signature=|presigned)[^\s]*/gi,
                    '$1?[REDACTED-CREDENTIALS]')
  // AWS-shaped access keys.
  out = out.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED-ACCESS-KEY]')
  // Common k=v secret pairs (token/secret/api-key).
  out = out.replace(/\b(token|secret|api[_-]?key)\s*[=:]\s*[A-Za-z0-9+/=._-]{16,}/gi, '$1=[REDACTED]')
  // Internal namespace still leaking through.
  out = out.replace(/spookystuff/gi, 'WebRobot')
  return out
}

// Parse the sanitized multi-line blob the server returns into rows the
// viewer can color-code. Tolerant: a line without timestamp or level
// still renders, just under default styling.
const LEVELS = /\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL)\b/i
const TS_REGEX = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/
function parseLogBlob(blob) {
  if (!blob) return []
  const out = []
  for (const raw of blob.split('\n')) {
    if (!raw.trim()) continue
    const masked = maskLogLine(raw)
    const tsMatch = masked.match(TS_REGEX)
    const lvlMatch = masked.match(LEVELS)
    let timestamp = ''
    let message = masked
    if (tsMatch) {
      timestamp = tsMatch[1]
      message = message.slice(tsMatch[0].length).trim()
    }
    let level = 'INFO'
    if (lvlMatch) {
      level = lvlMatch[1].toUpperCase()
      if (level === 'WARNING') level = 'WARN'
      // Drop the first level token from the body so it doesn't repeat in
      // the message column.
      message = message.replace(lvlMatch[0], '').trim()
    }
    out.push({ timestamp, level, message: message || masked })
  }
  return out
}

async function pollStatusOnce() {
  if (!executionState.value) return
  try {
    const url = `${API_BASE_URL}/api/webrobot/api/demo/executions/${encodeURIComponent(executionState.value.execution_id)}/status`
    const r = await authenticatedDemoFetch(url)
    if (!r.ok) return
    const s = await r.json()
    statusData.value = s
    // Adopt the output_dataset_id once the backend stamps it (V44 —
    // populated by DemoService.executeDemo right after the dataset is
    // materialised). On async BYOC runs the /demo/execute 202 returns
    // before the dataset exists, so this is the only way the SPA
    // learns about the id without a follow-up call.
    if (s.output_dataset_id && !executionState.value.output_dataset_id) {
      executionState.value = {
        ...executionState.value,
        output_dataset_id: s.output_dataset_id,
      }
    }
    if (s.status && TERMINAL_STATUSES.has(s.status)) {
      stopExecPolling()
      pollLogsOnce()
      if (s.status === 'COMPLETED' || s.status === 'SUCCEEDED') fetchOutputPreview()
    }
  } catch (e) { console.warn('status poll:', e) }
}

async function pollLogsOnce() {
  if (!executionState.value) return
  try {
    const params = new URLSearchParams()
    params.set('tail', String(logsTail.value || 200))
    params.set('podType', logsPodType.value || 'driver')
    if (logsPodType.value === 'executor' && logsExecutorIndex.value !== null && logsExecutorIndex.value !== undefined) {
      params.set('executorIndex', String(logsExecutorIndex.value))
    }
    const url = `${API_BASE_URL}/api/webrobot/api/demo/executions/${encodeURIComponent(executionState.value.execution_id)}/logs?${params}`
    const r = await authenticatedDemoFetch(url)
    if (!r.ok) return
    const j = await r.json()
    logsText.value = j.logs || ''
    logsLines.value = parseLogBlob(logsText.value)
    if (Array.isArray(j.executors)) {
      logsExecutors.value = j.executors.slice().sort((a, b) => a - b)
    }
  } catch (e) { console.warn('logs poll:', e) }
}

async function fetchOutputPreview() {
  if (!executionState.value) return
  try {
    const params = new URLSearchParams()
    params.set('limit', '10')
    if (executionState.value.output_dataset_id) {
      params.set('datasetId', String(executionState.value.output_dataset_id))
    }
    const url = `${API_BASE_URL}/api/webrobot/api/demo/executions/${encodeURIComponent(executionState.value.execution_id)}/output?${params}`
    const r = await authenticatedDemoFetch(url)
    if (!r.ok) return
    outputPreview.value = await r.json()
  } catch (e) { console.warn('output preview:', e) }
}

function refreshExecutionPanel() {
  pollStatusOnce()
  pollLogsOnce()
  if (statusData.value && TERMINAL_STATUSES.has(statusData.value.status)) {
    fetchOutputPreview()
  }
}

async function cancelCurrentExecution() {
  if (!executionState.value) return
  if (!window.confirm('Cancel this run?')) return
  try {
    const url = `${API_BASE_URL}/api/webrobot/api/demo/executions/${encodeURIComponent(executionState.value.execution_id)}`
    await authenticatedDemoFetch(url, { method: 'DELETE' })
    pollStatusOnce()
  } catch (e) { alert('Cancel failed: ' + e.message) }
}

function detachExecution() {
  stopExecPolling()
  clearExecutionState()
}

function attachToExecution(execId, pipelineName, outputDatasetId) {
  saveExecutionStateLs({
    execution_id: execId,
    pipeline_name: pipelineName,
    output_dataset_id: outputDatasetId || null,
    started_at: new Date().toISOString(),
  })
  outputPreview.value = null
  startExecPolling()
}

const statusBadgeColor = computed(() => {
  const s = statusData.value && statusData.value.status
  return ({
    RUNNING: '#2196f3', SUBMITTED: '#ff9800',
    COMPLETED: '#43a047', SUCCEEDED: '#43a047',
    FAILED: '#e53935', CANCELLED: '#9e9e9e',
    UNKNOWN: '#9e9e9e',
  })[s] || '#555'
})
const isExecutionRunning = computed(() => {
  const s = statusData.value && statusData.value.status
  return s === 'RUNNING' || s === 'SUBMITTED'
})

const TERMINAL_LIFECYCLE = new Set(['completed', 'failed', 'cancelled', 'lost'])
const isExecutionTerminal = computed(() => {
  const s = statusData.value && statusData.value.status
  const p = statusData.value && statusData.value.phase
  if (TERMINAL_LIFECYCLE.has(p)) return true
  return s === 'COMPLETED' || s === 'SUCCEEDED' || s === 'FAILED' || s === 'CANCELLED'
})

// Phase → (icon, friendly label, free-form detail) for the loading
// strip. Driven by the backend-synthesized `phase` field which we
// trust over the raw DB status because it correlates with what's
// actually visible to the user (driver up? executors pulling?).
const PHASE_META = {
  submitting:         { icon: '⏳', spinner: true,  label: 'Submitting to Spark…',
                        detail: 'Spark Operator is materialising the CRD on the cluster.' },
  starting_driver:    { icon: '🐣', spinner: true,  label: 'Starting Spark driver…',
                        detail: 'The driver pod is scheduling / pulling image.' },
  waiting_executors:  { icon: '🛎️', spinner: true, label: 'Driver ready, waiting for executors…',
                        detail: 'Driver is up, asking k8s for executor pods.' },
  pulling_executors:  { icon: '📥', spinner: true,  label: 'Pulling executor image on workers…',
                        detail: 'First run on a node downloads ~1 GB of container image. Typically 30–90s.' },
  executors_starting: { icon: '⚙️', spinner: true,  label: 'Executors warming up…',
                        detail: 'Image is on the node, container is initialising.' },
  running:            { icon: '🚀', spinner: true,  label: 'Pipeline running…',
                        detail: 'Driver + executors are fully up; tasks are flowing.' },
  completed:          { icon: '✅', spinner: false, label: 'Completed',
                        detail: 'Final output is in the preview table below.' },
  failed:             { icon: '❌', spinner: false, label: 'Failed',
                        detail: 'See the error message above and the Spark driver logs.' },
  cancelled:          { icon: '🛑', spinner: false, label: 'Cancelled',
                        detail: 'User cancelled this run.' },
  lost:               { icon: '⚠️', spinner: false, label: 'Lost — no pods materialised',
                        detail: 'The Spark Operator removed the SparkApplication CRD before the webhook could close this run. The DB row was auto-marked FAILED. Click "Forget run" to dismiss.' },
  unknown:            { icon: '❓', spinner: false, label: 'Status unknown',
                        detail: 'The execution record can\'t be located. It may have been pruned.' },
}
const phaseMeta = computed(() => {
  const p = statusData.value && statusData.value.phase
  return PHASE_META[p] || PHASE_META.unknown
})
// During the BYOC async window (V43, ~3-5 min before any pod exists),
// the workload stamps a fine-grained progress_message on
// job_executions ("Provisioning Hetzner VMs via Ansible...",
// "Submitting Spark application...") that is far more informative
// than the pod-state-derived synthetic phase. Prefer it when present.
// Falls back to the existing PHASE_META label once the workload
// transitions into pod-visible territory (or the row predates V43).
const phaseLabel = computed(() => {
  const pm = statusData.value && statusData.value.progress_message
  if (pm && !isExecutionTerminal.value) return pm
  return phaseMeta.value.label
})
const phaseDetail     = computed(() => phaseMeta.value.detail)
const phaseIcon       = computed(() => phaseMeta.value.icon)
const phaseShowSpinner = computed(() => phaseMeta.value.spinner)
// "Pulling image on w1mg1" — used in the executor row to point the
// user at the node that's still pulling. Returns null when no
// executor is in image-pull state.
const executorImagePullingNode = computed(() => {
  const execs = (statusData.value && statusData.value.executors) || []
  for (const e of execs) {
    if (e && e.image_pulling && e.node) return e.node
  }
  return null
})

// ─── CLI-style pipeline wizard ──────────────────────────────────────
// Mirrors `webrobot pipeline stages list/describe` + `pipeline add-stage`
// from the CLI. Catalog comes from the dynamic Strapi-backed endpoint
// /demo/catalog/stages so every newly-synced stage shows up here without
// a portal rebuild.

const wizCatalog       = ref([])
const wizPipeline      = ref([])   // [{stage, args: {name: value, …}}]
// Python post-processing extensions: top-level `python_extensions.stages`
// in the YAML, but always invoked LAST in the runtime pipeline because
// they operate on the assembled DataFrame (driver-side or via UDF), not
// on the RDD pipeline mid-stream. The wizard renders these as a
// separate section under the regular stage list and the YAML emitter
// auto-appends `python_<type>:<name>` stage references at the end of
// the pipeline:[...] block.
const wizPythonExtensions = ref([])   // [{name, type, functionBody, intent?, _aiBusy?, _valError?}]
const wizPipelineName  = ref('')
const wizIntent        = ref('')
const wizPluginFilter  = ref('')
const wizSearch        = ref('')
// Mobile-only: which designer pane is shown (the tab bar is hidden ≥721px,
// where both panes render side-by-side regardless of this value).
const wizMobilePane    = ref('catalog')  // 'catalog' | 'editor'
const wizStatus        = ref({ kind: null, text: '' })

// AI suggester (server-side LLM call) — given the intent, returns up to
// 5 stage names from the live catalog as the suggested order.
const wizSuggested        = ref([])      // ordered array of stage_names
const wizSuggesterLoading = ref(false)
const wizSuggesterError   = ref(null)
const wizSuggestedSet = computed(() => new Set(wizSuggested.value))

// ─── Selector / action picker (proxied iframe + injected JS) ───────
// Two distinct flows funnel into the same modal:
//   • SELECTOR pick : click an arg's 🎯 button → modal opens → user
//     clicks an element in the proxied page → the resulting CSS
//     selector auto-fills the arg input that opened the modal.
//   • ACTION RECORD : click "⏺ Record actions" → modal opens in
//     action mode → user interacts normally → ESC (or Stop) sends the
//     recorded action list; we render it as YAML the user can copy
//     into a fetch/visit trace argument.
const pickerOpen          = ref(false)
const pickerUrl           = ref('https://books.toscrape.com/')
const pickerLoadedUrl     = ref(null)
const pickerHtml          = ref('')           // legacy: srcdoc body (only used as fallback now — cmf flow uses cmfIframeSrc)
const cmfReloadKey        = ref(0)            // bumped on every /cmf/step success to refresh the iframe via ?_v=…
const pickerStrategy      = ref('cmf')        // Camoufox only (wget removed from the designer — almost never worked: plain HTTP, no JS/anti-bot)
const cmfSessionId        = ref(null)         // active Camoufox session id (cmf strategy)
// Captcha / WAF block state — populated when /cmf/open or /cmf/step
// returns a `block` field (or 409 status). While non-null, the wizard
// surfaces a red banner asking the user to resolve in the mirror, and
// further /cmf/step calls are blocked until POST /cmf/{sid}/resume
// succeeds.
const cmfBlock            = ref(null)
const cmfResumeBusy       = ref(false)
// In-app notification inbox for captcha blocks. Each entry mirrors a
// distinct session that's currently waiting on HITL resolution. The
// bell icon in the demo header reads from this; "Apri mirror" reopens
// the picker modal on that sid so the user can solve the challenge.
const cmfBlockNotifications = ref([])   // [{sid, kind, url, since, html}]
const cmfNotifOpen          = ref(false)
const pickerLoading       = ref(false)
const pickerLoadingStartedAt = ref(0)               // ms timestamp when the current step kicked off
const pickerLoadingElapsedS  = ref(0)               // updated by setInterval while loading
const pickerLoadingKind      = ref('step')          // 'open' | 'step' — drives the overlay copy
let   pickerLoadingTicker = null
const pickerLoadError     = ref(null)
// Overlay copy escalates with elapsed time so slow ecommerce searches
// (eBay can take 8-12s for the post-click render) don't read as frozen.
const pickerLoadingLabel = computed(() => {
  const e = pickerLoadingElapsedS.value
  if (pickerLoadingKind.value === 'open') {
    if (e >= 12) return 'Camoufox is still rendering — Cloudflare challenge or heavy SPA…'
    if (e >= 5)  return 'Loading page via Camoufox…'
    return 'Loading page…'
  }
  if (e >= 12) return 'Site is slow — still waiting for the server-side browser…'
  if (e >= 5)  return 'Applying action and re-rendering page…'
  return 'Sending action to Camoufox…'
})
// Drive the ticker from the loading flag — start at the first transition
// to true, stop when it flips back. Cheap (1Hz) and only while loading.
watch(pickerLoading, (now, prev) => {
  if (now && !prev) {
    pickerLoadingStartedAt.value = Date.now()
    pickerLoadingElapsedS.value  = 0
    pickerLoadingTicker = setInterval(() => {
      pickerLoadingElapsedS.value = Math.floor((Date.now() - pickerLoadingStartedAt.value) / 1000)
    }, 500)
  } else if (!now && prev) {
    if (pickerLoadingTicker) { clearInterval(pickerLoadingTicker); pickerLoadingTicker = null }
    pickerLoadingElapsedS.value = 0
  }
})
const pickerMode          = ref('selector-single')  // selector-single | selector-list | action-record | ai-magic
const pickerSelected      = ref(null)               // { selector, matches, sampleText, sampleHtml, refinedFromHighlight? }
// URL the picker actually OPENED on (immutable for the lifetime of
// the cmf session). Different from pickerLoadedUrl which advances
// with each /cmf/step. We need the open-URL to seed fetch.args.url
// when applying a trace, because the trace replays FROM there.
const pickerOpenedUrl     = ref(null)
const pickerActions       = ref([])                 // STAGED — composed in the iframe, pending Send
// COMMITTED — actions that already round-tripped through /cmf/step
// and were replayed on the live Camoufox tab. Only these are eligible
// for "Apply to a stage trace" because they're guaranteed to reproduce
// the page state. Staged queue is just a draft until Send fires.
const committedActions    = ref([])
const applyTraceStageIdx  = ref(null)
const pickerTargetStageIdx = ref(null)              // wizPipeline index that owns the target arg
const pickerTargetArgName  = ref(null)              // arg.name in that stage's args
// Live state of the multi-sample (repeating-link) picker, synced from
// picker.js on every click. selector is the generalised CSS that
// matches every clicked sample so far; matches is its querySelectorAll
// count on the iframe document.
const multiSampleStatus    = ref({ selector: null, matches: 0, samples: 0, sampleText: '' })
// Two-phase picker: when a non-trivial mode is requested (multi-field,
// multi-sample, selector-list, selector-single) the modal first opens
// in action-record so the user can navigate to the right page; a
// prominent "📌 Start picking" CTA then promotes the iframe into the
// requested mode. Set to null when the wizard didn't request a
// specific pick mode (e.g. the picker was opened straight as
// action-record / ai-magic for navigation only).
const pickerIntendedMode  = ref(null)
// Parked Camoufox session, preserved across modal close so the user can
// build a multi-stage pipeline interactively: drive the browser on
// stage N, save the trace + park, add stage N+1, reopen the picker and
// resume on the SAME live page (same URL, cookies, history). Server-
// side TTL is 5 min — we track the age client-side just to render it
// for the user, the backend reaps the rest.
const pausedCmfSession     = ref(null)   // { sessionId, html, url, savedAt }
const pausedCmfAgeTick     = ref(0)      // bumped by setInterval so the label refreshes
const pausedCmfAgeLabel    = computed(() => {
  pausedCmfAgeTick.value   // dependency for reactivity
  const p = pausedCmfSession.value
  if (!p || !p.savedAt) return ''
  const s = Math.max(0, Math.floor((Date.now() - p.savedAt) / 1000))
  if (s < 60) return s + 's ago'
  const m = Math.floor(s / 60); const r = s % 60
  return `${m}m${r > 0 ? ' ' + r + 's' : ''} ago`
})
// 5 min server-side reap matches our visual ageing.
setInterval(() => { if (pausedCmfSession.value) pausedCmfAgeTick.value++ }, 1000)

// AI Magic state — intent-driven inference of selectors or actions.
// The algo result arrives synchronously (~ms); the LLM result fills in
// after 1-3s and overlays a second-tier highlight in the iframe.
const aiIntent       = ref('')
const aiMode         = ref('selector')   // 'selector' | 'actions' | 'flatselect'
// flatSelect AI Magic result: bundles inferred segment selector + the
// per-row field schema so the user reviews the whole proposal at once
// and applies it with a single click.
const aiFlatSelectResult = ref(null)      // { segmentSelector, segmentMatches, fields:[{as, method, selector, sample}] }
const aiLoading      = ref(false)
const aiError        = ref(null)
const aiAlgoResults  = ref([])           // [{selector|type, confidence, why}]
const aiLlmResults   = ref([])           // same shape, second tier
const aiPickedRefined = ref(null)        // LCA refinement from picker click
const aiRawLlm       = ref(null)
// Auto body-selector suggestion banner (set after picking a long-text field).
// { stageIdx, fIdx, pickedSelector, selector, method, why, confidence,
//   paywalled, paywallReason } — or null when no suggestion is pending.
const bodySuggestion = ref(null)

// ── TEMP collaudo gate (soft password during final testing; remove when done) ──
const DEMO_GATE_PWD = 'web201979'
const demoUnlocked  = ref(false)
const demoGatePwd   = ref('')
const demoGateError = ref(false)
onMounted(() => {
  try { if (localStorage.getItem('wr_demo_gate') === DEMO_GATE_PWD) demoUnlocked.value = true } catch (_) {}
})
function unlockDemo() {
  if (demoGatePwd.value === DEMO_GATE_PWD) {
    demoUnlocked.value = true
    demoGateError.value = false
    try { localStorage.setItem('wr_demo_gate', DEMO_GATE_PWD) } catch (_) {}
  } else {
    demoGateError.value = true
  }
}
const pickerReloadNonce    = ref(0)       // bumped by the ↻ Refresh button (wget-mode cache-buster)
const pickerProxySrc       = computed(() => {
  if (!pickerLoadedUrl.value) return ''
  return `${API_BASE_URL}/api/webrobot/api/demo/wizard/proxy?url=${encodeURIComponent(pickerLoadedUrl.value)}&_r=${pickerReloadNonce.value}`
})

// ↻ Refresh — re-fetch the current mirror page without re-navigating.
// Camoufox: bump cmfReloadKey so the iframe re-pulls the LIVE session DOM
// (reflects server-side changes since the last snapshot, e.g. a cookie
// banner that has since been auto-dismissed). wget: bump the nonce so the
// proxied src changes and the iframe reloads.
function refreshPickerMirror() {
  if (pickerStrategy.value === 'cmf' && cmfSessionId.value) {
    cmfReloadKey.value++
  } else {
    pickerReloadNonce.value++
  }
}

// Friendly label for the "📌 Start <X>" button — keeps the noun in
// the CTA aligned with what the wizard actually requested.
const intendedModeLabel = computed(() => {
  switch (pickerIntendedMode.value) {
    case 'multi-field':      return 'field selection'
    case 'multi-sample':     return 'multi-link sampling'
    case 'selector-single':  return 'selector picking'
    case 'selector-list':    return 'list selector picking'
    default:                 return 'picking'
  }
})

// User clicked "📌 Start <X>" — flip the iframe out of action-record
// (navigation mode) into the mode the wizard originally requested.
// Clear the intent flag so the CTA disappears.
function promoteToIntendedMode() {
  if (!pickerIntendedMode.value) return
  const m = pickerIntendedMode.value
  pickerIntendedMode.value = null
  // multi-field needs its container-selector config re-pushed to the
  // iframe — route through openMultiFieldPicker (direct) instead of a
  // bare mode switch so flatSelect stays segment-relative.
  if (m === 'multi-field' && pickerTargetStageIdx.value != null) {
    openMultiFieldPicker(pickerTargetStageIdx.value, { direct: true })
  } else {
    setPickerMode(m)
  }
}

// Shared helper — every picker entry point should call this AFTER
// setting pickerOpen=true so the iframe rebinds to the previously
// parked Camoufox tab. Without this every "Pick" / "Pick fields" /
// "AI suggest" / "Record" button on a new stage would land the user
// on an empty modal instead of the page they were just on.
function tryResumePausedSession() {
  const p = pausedCmfSession.value
  if (p && p.sessionId && (Date.now() - (p.savedAt || 0) < 5 * 60 * 1000)) {
    resumePausedSession()
  }
}

function openPicker(stageIdx, argName, mode) {
  pickerTargetStageIdx.value = stageIdx != null ? stageIdx : null
  pickerTargetArgName.value  = argName || null
  // NAVIGATE-FIRST. Every selection mode (pick a selector / sample links)
  // opens in action-record (pure navigation — send actions to drive the
  // mirror to the right page; NOT a recorded stage trace) and surfaces the
  // "📌 Start <X>" CTA to arm selection when the user is on the target
  // page. The mirror often opens on a landing/search page where the target
  // elements don't exist yet (needs a search / pagination / a tab click)
  // — picking must come AFTER navigation. Navigation needs a real browser
  // → force Camoufox. (Was previously land-directly; restored per product
  // requirement that nav precedes selector selection on every stage.)
  const requested = mode || 'selector-single'
  const isSelectionMode = requested === 'multi-sample'
    || requested === 'selector-list' || requested === 'selector-single'
  pickerSelected.value = null
  pickerActions.value  = []
  pickerOpen.value = true
  if (isSelectionMode) {
    pickerIntendedMode.value = requested
    pickerMode.value = 'action-record'
    pickerStrategy.value = 'cmf'
  } else {
    pickerIntendedMode.value = null
    pickerMode.value = requested
  }
  tryResumePausedSession()
}
async function closePicker() {
  // Park the live Camoufox session BEFORE clearing the refs so the
  // next openPicker auto-resumes on the same page. The user almost
  // always wants to continue from where they left off across stages
  // (record fetch trace → pick visitExplore selector → pick extract
  // fields…); explicit DELETE was the wrong default. The server-side
  // idle reaper still cleans up after 5 min if they never come back,
  // and "Start fresh" on the resume banner is the explicit escape
  // hatch for "I really want a new session".
  if (cmfSessionId.value && pickerLoadedUrl.value && pickerHtml.value) {
    pausedCmfSession.value = {
      sessionId: cmfSessionId.value,
      html:      pickerHtml.value,
      url:       pickerLoadedUrl.value,
      savedAt:   Date.now(),
    }
  }
  pickerOpen.value = false
  pickerLoadedUrl.value = null
  pickerSelected.value = null
  pickerActions.value  = []
  committedActions.value = []
  applyTraceStageIdx.value = null
  pickerOpenedUrl.value = null
  pickerTargetStageIdx.value = null
  pickerTargetArgName.value  = null
  pickerHtml.value = ''
  pickerIntendedMode.value = null   // reset two-phase intent
  cmfSessionId.value = null   // ref only — server session stays alive in pausedCmfSession
}
async function loadPickerUrl() {
  const u = (pickerUrl.value || '').trim()
  if (!u || !(u.startsWith('http://') || u.startsWith('https://'))) {
    alert('Provide an http(s) URL.')
    return
  }
  pickerSelected.value = null
  pickerActions.value  = []
  committedActions.value = []  // fresh URL → fresh trace
  pickerOpenedUrl.value = u    // tentative — overwritten by /cmf/open if needed
  pickerLoadedUrl.value = u
  pickerLoadError.value = null

  // Close any prior Camoufox session before opening a new one.
  if (cmfSessionId.value) {
    try {
      await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/cmf/${cmfSessionId.value}`, { method: 'DELETE' })
    } catch (_) {}
    cmfSessionId.value = null
  }

  // For action-record mode we ALWAYS need a live Camoufox session so
  // clicks actually advance the page. For other modes (selector
  // picking / AI Magic / multi-field), Camoufox gives the best
  // rendering quality on JS-heavy sites but is slower than wget — start
  // with the strategy the user explicitly chose, default 'cmf' when the
  // host is likely-protected (Cloudflare-fronted, JS-SPA, etc.).
  if (pickerStrategy.value === 'cmf' || pickerMode.value === 'action-record') {
    pickerStrategy.value = 'cmf'
    await openWithCamoufox(u)
  } else {
    // wget fast-path: simple iframe src pointed at the proxy GET endpoint.
    pickerHtml.value = ''
    cmfSessionId.value = null
  }
}

async function openWithCamoufox(url) {
  pickerLoadingKind.value = 'open'
  pickerLoading.value = true
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/cmf/open`, {
      method: 'POST',
      // Pass the chosen geo zone so the LIVE designer session also exits
      // through that country (same proxy the generated pipeline will use).
      body: JSON.stringify(wizGeo.value ? { url, country: wizGeo.value } : { url }),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || `cmf/open failed: ${r.status}`)
    pickerHtml.value      = j.html || ''
    cmfSessionId.value    = j.session_id || null
    pickerLoadedUrl.value = j.current_url || url
    cmfReloadKey.value++   // force iframe :src refresh so it points at the new session
    // First-load captcha: backend already flagged it. Forward to iframe
    // once the picker is ready (handler in onmessage re-sends on
    // webrobot-picker-ready when cmfBlock is set).
    cmfBlock.value = j.block || null
    pushBlockStateToIframe()
    if (cmfBlock.value) recordBlockNotification(cmfSessionId.value, cmfBlock.value)
    // Remember where the trace started — applyCommittedTrace seeds
    // this onto the target stage's url arg when the user hasn't typed
    // one manually, so the runtime knows where to navigate before
    // replaying the actions.
    pickerOpenedUrl.value = j.current_url || url
    // Default the apply-target to the first trace-capable stage so the
    // "✅ Use this URL" button works on first load without forcing the
    // user to choose a stage when there's exactly one fetch/visit.
    if (applyTraceStageIdx.value == null && tracableStages.value.length) {
      applyTraceStageIdx.value = pickerTargetStageIdx.value != null && tracableStages.value.some(s => s.idx === pickerTargetStageIdx.value)
        ? pickerTargetStageIdx.value
        : tracableStages.value[0].idx
    }
    // Keep pickerLoading=true on success — onPickerIframeLoad() clears it once
    // the mirror iframe has actually RENDERED, so the host overlay also covers
    // the iframe's initial blank load (no white flash on first "Load page").
    setTimeout(() => { pickerLoading.value = false }, 30000)  // safety net if 'load' never fires
  } catch (e) {
    pickerLoadError.value = e.message || String(e)
    pickerHtml.value = ''
    pickerLoading.value = false
  }
}

// Cleared when the mirror iframe finishes loading its document — until then the
// host loading overlay stays up so the user never sees the blank white iframe.
function onPickerIframeLoad() {
  pickerLoading.value = false
}

// Forward an action (or an ordered batch) to Camoufox and swap the
// iframe with the post-step HTML. picker.js batches a pending Type
// with the triggering Click so we always send them in order in a
// single request — otherwise a search submit would race the typing.
// Drive page.goBack() on the live Camoufox tab. Backend treats the
// "Back" action type as a back-nav primitive; we forward it as a
// regular step so the same overlay + URL-refresh flow lights up.
// We snapshot the URL before the call so we can tell the user when
// goBack landed on the same page (Camoufox has nothing to undo,
// e.g. already at the entry of the history stack).
async function goBackInCamoufox() {
  if (pickerStrategy.value !== 'cmf' || !cmfSessionId.value) return
  const before = pickerLoadedUrl.value
  await forwardStepToCamoufox([{ type: 'Back' }])
  if (pickerLoadedUrl.value === before) {
    // Surface as a non-fatal status bubble — pickerLoadError swaps the
    // iframe out for the "Load failed: …" panel which is too loud
    // for "history is empty".
    wizStatus.value = { kind: 'info', text: '← Back: already at the start of this session — nothing to undo.' }
    setTimeout(() => {
      if (wizStatus.value && wizStatus.value.text && wizStatus.value.text.startsWith('← Back')) {
        wizStatus.value = null
      }
    }, 4000)
  }
}

// Ship the staged action queue (pickerActions) to Camoufox in one
// batch. First ask the iframe to commit any in-progress typing so
// the last keystroke isn't dropped, then snapshot+clear the queue
// and forward.
// "Clear staged" button. Wipes BOTH the parent's pickerActions mirror
// AND the picker.js side `actions[]` buffer — otherwise the very next
// pick-actions throttled ping would replay the (still-populated)
// iframe-side queue back to the parent and the staged list would
// "reappear" a beat after the user clicked Clear.  See
// webrobot-picker-clear-queue handler in demo-wizard-picker.js.
function clearStagedActions() {
  pickerActions.value = []
  const ifr = document.getElementById('wr-picker-iframe')
  try {
    ifr && ifr.contentWindow && ifr.contentWindow.postMessage(
      { type: 'webrobot-picker-clear-queue' }, '*')
  } catch (_) {}
}

async function sendStagedActionsToCamoufox() {
  if (pickerStrategy.value !== 'cmf' || !cmfSessionId.value) return
  // Flush pending Type inside the iframe; it'll bounce back a
  // webrobot-pick-actions with the final list, but to keep things
  // ordered we wait one tick and use what we already have plus what
  // arrives next.
  const ifr = document.getElementById('wr-picker-iframe')
  try { ifr && ifr.contentWindow && ifr.contentWindow.postMessage({ type: 'webrobot-picker-flush-queue' }, '*') } catch (_) {}
  await new Promise(r => setTimeout(r, 50))
  let queue = pickerActions.value.slice()
  if (!queue.length) return
  // Mode-dependent filter:
  //  - NORMAL recording (non-captcha):  ship ONLY the human-readable
  //    trace types (Click / Type / Scroll). These are the ones the
  //    YAML emitter renders, and they're the canonical "trace" the
  //    user expects to apply to a fetch / visit stage. Hover events
  //    (auto-captured on menu/dropdown triggers) and any stray raw
  //    events (MouseMove etc.) are DROPPED so the replay matches the
  //    visible YAML preview exactly.
  //  - CAPTCHA recording (antiBotDetected): ship EVERYTHING. Raw
  //    mouse trajectory + Hover + keys are exactly what the CMP
  //    needs to validate the human-mouse fingerprint at replay time.
  if (!antiBotDetected.value) {
    const traceTypes = new Set(['Click', 'Type', 'Scroll'])
    const before = queue.length
    queue = queue.filter(a => a && a.type && traceTypes.has(a.type))
    if (before !== queue.length) {
      console.log(`[picker] non-captcha mode: filtered ${before - queue.length} non-trace event(s) before send`)
    }
  }
  if (!queue.length) return
  pickerActions.value = []
  forwardStepToCamoufox(queue)
}

// Mirror cmfBlock changes into the notification inbox so the user can
// find their way back even after closing the modal. Dedup by sid.
// Entries from local cmfBlock events have id=null; entries reconciled
// from Strapi have a numeric id and survive a page reload.
function recordBlockNotification(sid, block, opts) {
  if (!sid || !block) return
  const existing = cmfBlockNotifications.value.find(n => n.sid === sid)
  if (existing) {
    existing.kind = block.kind || existing.kind
    existing.url  = block.url  || existing.url
    if (opts && opts.id && !existing.id) existing.id = opts.id
    return
  }
  cmfBlockNotifications.value = [
    ...cmfBlockNotifications.value,
    {
      id:    (opts && opts.id) || null,    // Strapi row id, null if local-only
      sid:   sid,
      kind:  block.kind || 'unknown',
      url:   block.url  || pickerLoadedUrl.value || '',
      since: (opts && opts.since) || Date.now(),
      html:  pickerHtml.value || '',
      source: (opts && opts.source) || 'demo_wizard',
    },
  ]
}
async function dismissBlockNotif(sid) {
  const row = cmfBlockNotifications.value.find(n => n.sid === sid)
  cmfBlockNotifications.value = cmfBlockNotifications.value.filter(n => n.sid !== sid)
  if (cmfBlockNotifications.value.length === 0) cmfNotifOpen.value = false
  // If the row is persisted in Strapi, mark it resolved server-side so
  // it doesn't reappear on the next poll. Best-effort.
  if (row && row.id) {
    try {
      await authenticatedDemoFetch(
        `${API_BASE_URL}/api/webrobot/api/demo/notifications/captcha/${row.id}/resolve`,
        { method: 'POST' }
      )
    } catch (_) {}
  }
}

// Periodic poll of the Strapi-backed inbox. Reconciles into the same
// cmfBlockNotifications array so the bell shows both:
//   - blocks the current tab caused in its own wizard session
//     (already present via recordBlockNotification from /cmf/* paths)
//   - blocks from other tabs / sessions / ETL pipelines persisted in DB
// Dedup is by sid. Local-only rows (id=null) get their id upgraded if
// the DB poll finds the matching sid.
let cmfNotifPollTimer = null
async function pollCaptchaNotifications() {
  try {
    const r = await authenticatedDemoFetch(
      `${API_BASE_URL}/api/webrobot/api/demo/notifications/captcha?limit=50`,
      { method: 'GET' }
    )
    if (!r.ok) return
    const j = await r.json()
    const rows = Array.isArray(j.data) ? j.data : []
    // Reconcile: add unseen sids, upgrade ids on existing local rows,
    // remove local rows whose Strapi twin is now resolved (resolvedAt
    // set) — though the listUnresolved query already excludes them.
    const seenSids = new Set()
    for (const row of rows) {
      if (!row || !row.sessionId) continue
      seenSids.add(row.sessionId)
      recordBlockNotification(row.sessionId, { kind: row.kind, url: row.url }, {
        id:     row.id,
        since:  row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
        source: row.source || 'demo_wizard',
      })
    }
    // Drop persisted entries whose backing row was resolved by another
    // tab. Local-only rows (id=null) are kept — they're the in-flight
    // ones the current tab just produced.
    cmfBlockNotifications.value = cmfBlockNotifications.value.filter(n => {
      if (!n.id) return true
      return seenSids.has(n.sid)
    })
  } catch (_) {
    // Silent: persistence layer down should not spam the wizard.
  }
}
function startCaptchaNotifPoll() {
  if (cmfNotifPollTimer) return
  pollCaptchaNotifications()
  cmfNotifPollTimer = setInterval(pollCaptchaNotifications, 30_000)
}
function stopCaptchaNotifPoll() {
  if (cmfNotifPollTimer) { clearInterval(cmfNotifPollTimer); cmfNotifPollTimer = null }
}
onMounted(() => { startCaptchaNotifPoll() })
onBeforeUnmount(() => { stopCaptchaNotifPoll() })
function clearBlockNotifFor(sid) {
  if (!sid) return
  dismissBlockNotif(sid)
}
// Click "Apri mirror" in the notification dropdown — bring the wizard
// modal back up on that exact session so the user can solve the
// captcha in-place. Reuses the parked-session path because the modal
// may have been closed (or a different sid was active).
function openMirrorForBlock(n) {
  if (!n || !n.sid) return
  cmfNotifOpen.value = false
  if (cmfSessionId.value && cmfSessionId.value !== n.sid && pickerLoadedUrl.value && pickerHtml.value) {
    pausedCmfSession.value = {
      sessionId: cmfSessionId.value,
      html:      pickerHtml.value,
      url:       pickerLoadedUrl.value,
      savedAt:   Date.now(),
    }
  }
  cmfSessionId.value    = n.sid
  pickerHtml.value      = n.html || ''
  pickerLoadedUrl.value = n.url
  pickerStrategy.value  = 'cmf'
  cmfBlock.value        = { kind: n.kind, url: n.url }
  cmfReloadKey.value++
  pickerOpen.value = true
  // The iframe will remount and ask for picker-ready; the existing
  // handler re-sends webrobot-picker-block when cmfBlock is set.
}
function shortHost(u) {
  if (!u) return '—'
  try { return new URL(u).host } catch (_) { return u.slice(0, 40) }
}
function relTime(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return s + 's fa'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm fa'
  return Math.floor(m / 60) + 'h fa'
}

// Forward the current cmfBlock state to the picker iframe (or clear it
// if cmfBlock is null). picker.js shows/hides its red banner accordingly
// and suspends/restores click interception so the user can interact
// natively with the captcha widget.
//
// On block: ALSO force the picker into action-record mode + flip on
// anti-bot capture so every mouse/key/wheel event the user produces
// while solving the captcha is buffered for trace replay. The CMP
// validates mouse trajectory + timing, so click-only replay fails —
// we need the full event stream. picker.js auto-detects captcha via
// its own 2s heuristic too, but the server-side cmfBlock signal is
// authoritative + earlier (it fires the instant Camoufox sees the
// challenge, before the DOM heuristic finds its markers).
function pushBlockStateToIframe() {
  const ifr = document.getElementById('wr-picker-iframe')
  if (!ifr || !ifr.contentWindow) return
  try {
    if (cmfBlock.value) {
      ifr.contentWindow.postMessage({ type: 'webrobot-picker-block', block: cmfBlock.value }, '*')
      // Force action-record so antiBotActive() === antiBotMode && mode==='action-record'
      // both gate-conditions are satisfied; otherwise the listeners are no-op.
      if (pickerMode.value !== 'action-record') {
        pickerMode.value = 'action-record'
        try {
          ifr.contentWindow.postMessage(
            { type: 'webrobot-picker-mode', mode: 'action-record' }, '*')
        } catch (_) {}
      }
      try {
        ifr.contentWindow.postMessage({
          type: 'webrobot-picker-anti-bot-mode',
          enabled: true,
          reason: (cmfBlock.value && cmfBlock.value.kind) || 'server-cmfBlock',
        }, '*')
      } catch (_) {}
      // Mirror the same UI side-effects as a client-side detection so
      // the operator sees the warning banner + pipeline tagging
      // consistently regardless of which side detected first.
      onAntiBotDetected((cmfBlock.value && cmfBlock.value.kind) || 'server-detected')
    } else {
      ifr.contentWindow.postMessage({ type: 'webrobot-picker-block-clear' }, '*')
      try {
        ifr.contentWindow.postMessage({
          type: 'webrobot-picker-anti-bot-mode',
          enabled: false,
        }, '*')
      } catch (_) {}
      // Don't auto-clear antiBotDetected — operator-only decision
      // (mirrors the original onAntiBotDetected comment "No auto-dismiss").
    }
  } catch (_) {}
}

// User clicked "Resolved, resume" in the iframe banner. POST /cmf/{sid}/resume —
// the backend re-runs the detector. If 200, the block is cleared and the
// trace can continue; if 409, the challenge widget is still on screen
// and the user must try again.
// Anti-bot detected inside the iframe (picker.js heuristics). Flip the
// UI banner, mark the target stage so its trace will be replay-tagged
// requires_hitl, and surface a one-line warning the operator can't
// miss.
function onAntiBotDetected(reason) {
  antiBotDetected.value = true
  antiBotReason.value   = reason
  // Force action-record so the UI tab + iframe listeners are aligned.
  // picker.js does the same flip locally (enableAntiBotMode sets
  // mode='action-record' inside the iframe) but the parent's
  // pickerMode also has to switch so the staged-actions panel
  // (which is v-if'd on pickerMode === 'action-record') becomes
  // visible and the YAML emitter knows we're recording.
  if (pickerMode.value !== 'action-record') {
    pickerMode.value = 'action-record'
    const ifr = document.getElementById('wr-picker-iframe')
    try { ifr && ifr.contentWindow && ifr.contentWindow.postMessage(
      { type: 'webrobot-picker-mode', mode: 'action-record' }, '*') } catch (_) {}
  }
  // Tag the target stage so the YAML emitter writes a meta field
  // forcing hitlAwait at run time.
  if (pickerTargetStageIdx.value != null) {
    const row = wizPipeline.value[pickerTargetStageIdx.value]
    if (row) {
      row._requires_hitl  = true
      row._anti_bot_kind  = reason
      wizPipeline.value   = [...wizPipeline.value]
    }
  }
  // Force the UI checkbox on so the operator sees the linkage.
  hitlAwait.value = true
  wizStatus.value = { kind: 'warn',
    text: `🤖 Anti-bot detected (${reason}) — capture switched to RAW EVENT mode. Pipeline tagged HITL-required. Each run will pause for operator captcha resolve.` }
  // No auto-dismiss — operator should explicitly clear.
}

async function resumeAfterCaptcha() {
  if (!cmfSessionId.value || cmfResumeBusy.value) return
  cmfResumeBusy.value = true
  try {
    const r = await authenticatedDemoFetch(
      `${API_BASE_URL}/api/webrobot/api/demo/wizard/cmf/${cmfSessionId.value}/resume`,
      { method: 'POST' }
    )
    const j = await r.json()
    if (r.ok && !j.blocked) {
      cmfBlock.value = null
      pushBlockStateToIframe()
      clearBlockNotifFor(cmfSessionId.value)
      // Bump the iframe so the picker re-mounts on whatever post-captcha
      // page Camoufox now exposes — many WAFs replace the body wholesale
      // after solving.
      cmfReloadKey.value++
    } else if (r.status === 409 && j.block) {
      cmfBlock.value = j.block
      pushBlockStateToIframe()
      wizStatus.value = { kind: 'warn',
        text: '⚠️ Sembra che il blocco sia ancora attivo. Completa il captcha nel mirror, poi riprova.' }
      setTimeout(() => { if (wizStatus.value && wizStatus.value.text && wizStatus.value.text.startsWith('⚠️ Sembra')) wizStatus.value = null }, 5000)
    }
  } catch (e) {
    wizStatus.value = { kind: 'warn', text: 'resume failed: ' + (e.message || e) }
  } finally {
    cmfResumeBusy.value = false
  }
}

async function forwardStepToCamoufox(actionOrBatch) {
  if (!cmfSessionId.value) return
  // Guard: do not push new actions while the session is blocked by a
  // captcha — they would either 409 again, or worse race the user's
  // resolve gesture. The Resume button is the only path forward.
  //
  // Exception: anti-bot mode is active. In that flow the user's mouse
  // gesture IS the way to clear the challenge — we WANT to ship the
  // staged raw-event trace (MouseMove/Down/Up/Wheel/Key) to Camoufox
  // so it replays the human signature against the CMP. Skipping the
  // send here would defeat the whole capture loop. Backend sniffs
  // block after each action and stops the batch if still challenged.
  if (cmfBlock.value && !antiBotDetected.value) {
    wizStatus.value = { kind: 'warn',
      text: '⚠️ Sessione bloccata da captcha — risolvi nel mirror prima di inviare nuove azioni.' }
    return
  }
  const batch = Array.isArray(actionOrBatch) ? actionOrBatch : [actionOrBatch]
  if (!batch.length) return
  const first = batch[0]
  pickerLoadingKind.value = 'step'
  pickerLoading.value = true
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/cmf/step`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: cmfSessionId.value,
        // New batch field — backend runs the actions in order.
        actions:  batch,
        // Single-action fields kept for backwards compat with older pods
        // mid-rollout; the backend prefers `actions` when present.
        type:     first.type,
        selector: first.selector,
        text:     first.text,
        ms:       first.ms,
      }),
    })
    const j = await r.json()
    // A poisoned Camoufox session (timed-out click, dropped WS frame,
    // Cloudflare challenge mid-step) returns 404 with "session expired
    // (driver state lost)". Auto-reopen on the last known URL instead
    // of leaving the wizard stuck — the user keeps their wizard state,
    // they just lose the action that failed.
    if (r.status === 404 && /session expired|session not found/i.test(j.error || '')) {
      const lastUrl = pickerLoadedUrl.value
      cmfSessionId.value = null
      if (lastUrl) {
        pickerLoadError.value = 'session reset — reloading page'
        await openWithCamoufox(lastUrl)
      } else {
        pickerLoadError.value = 'session expired — reopen the URL to continue'
      }
      return
    }
    // Captcha / WAF block returns 409 + block field + current HTML. NOT
    // an error — keep the iframe rendered on the challenge page so the
    // user can solve it, surface the red banner, and bail out of the
    // committed-actions append (the click that tripped the block never
    // really ran).
    if (r.status === 409 && j.block) {
      pickerHtml.value      = j.html || pickerHtml.value
      pickerLoadedUrl.value = j.current_url || pickerLoadedUrl.value
      cmfReloadKey.value++
      cmfBlock.value = j.block
      pushBlockStateToIframe()
      recordBlockNotification(cmfSessionId.value, j.block)
      return
    }
    if (!r.ok || j.error) throw new Error(j.error || 'cmf/step failed')
    // Per-action warnings — backend skipped some actions (e.g. Hover on a
    // not-stable element, MouseMove during a viewport repaint) so the
    // batch could continue. Surface as non-blocking modal — DO NOT throw
    // (the step DID succeed for the rest of the actions; the previous
    // iframe view stays mounted with the post-step HTML).
    if (Array.isArray(j.warnings) && j.warnings.length) {
      stepWarnings.value = j.warnings
      stepWarningsOpen.value = true
    }
    pickerHtml.value      = j.html || pickerHtml.value
    pickerLoadedUrl.value = j.current_url || pickerLoadedUrl.value
    cmfReloadKey.value++   // refresh iframe :src so it re-fetches the post-step HTML
    // Successful step also returns a block field if the page re-armed a
    // challenge mid-flight (e.g. PerimeterX after Nth click). Treat the
    // same as the 409 branch but keep going through the commit pipeline
    // — the action did run, so it goes into committedActions.
    if (j.block) {
      cmfBlock.value = j.block
      pushBlockStateToIframe()
      recordBlockNotification(cmfSessionId.value, j.block)
    } else if (cmfBlock.value) {
      // Previous step was blocked but this one cleared it (e.g. the
      // session was already past the challenge by the time we sent
      // another action). Drop the banner.
      cmfBlock.value = null
      pushBlockStateToIframe()
      clearBlockNotifFor(cmfSessionId.value)
    }
    // Successful round-trip: the batch we just sent really ran on the
    // live Camoufox tab. Append to the committed log — that's the
    // sequence the user can "Apply to a fetch/visit trace". Skip
    // pure-back-navigation entries (no useful trace value) to keep
    // the YAML tidy.
    //
    // NAVIGATE-FIRST exception: while pickerIntendedMode is set we are in
    // pure-navigation (driving the mirror to the right page BEFORE picking)
    // — those actions are positioning only and must NOT enter the trace.
    // Once the user clicks "📌 Start <X>" (or the 🎯 Select fields tab)
    // pickerIntendedMode clears; only an explicit ⏺ Record actions session
    // after that commits a replayable trace.
    const committable = pickerIntendedMode.value
      ? []
      : batch.filter(a => a && a.type && a.type !== 'Back')
    if (committable.length) {
      committedActions.value = [...committedActions.value, ...committable]
      // Default the apply-dropdown to the first trace-capable stage so
      // the user only has to click Apply, not also pick a target.
      if (applyTraceStageIdx.value == null && tracableStages.value.length) {
        applyTraceStageIdx.value = tracableStages.value[0].idx
      }
    }
  } catch (e) {
    // Step failed (5xx, poisoned session, network, etc.). DO NOT swap the
    // iframe out for the red "Load failed: …" banner — that destroys the
    // previous view (which is still valid: the iframe's :src points at
    // the last successful cmfReloadKey snapshot, which we do NOT bump on
    // failure).  Instead, surface the error via the stepWarnings modal
    // and keep the iframe rendered on the previous page so the operator
    // can decide whether to retry / change strategy / Back manually.
    // TODO: auto-Back on certain failure classes (Playwright navigation
    // timeout, mid-batch poison) — discussed but deferred.
    stepWarningsError.value = (e && e.message) ? e.message : String(e)
    stepWarnings.value      = []   // full-step error, no per-action warnings
    stepWarningsOpen.value  = true
  } finally {
    pickerLoading.value = false
  }
}

// Toggle Camoufox / wget strategy from the UI.
async function setPickerStrategy(s) {
  pickerStrategy.value = s
  if (pickerLoadedUrl.value) {
    if (s === 'cmf') {
      await openWithCamoufox(pickerLoadedUrl.value)
    } else {
      // Close any cmf session and fall back to wget proxy src.
      if (cmfSessionId.value) {
        try { await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/cmf/${cmfSessionId.value}`, { method: 'DELETE' }) } catch (_) {}
        cmfSessionId.value = null
      }
      pickerHtml.value = ''
    }
  }
}
function setPickerMode(m) {
  pickerMode.value = m
  // Action recording needs a real browser — silently promote wget →
  // Camoufox when the user enters Record actions on a loaded page.
  // Without this the wget tab just disables and recording is a no-op
  // (the proxied static HTML can't replay clicks). Re-opens the same
  // URL under Camoufox; harmless if already on cmf.
  if (m === 'action-record' && pickerStrategy.value === 'wget' && pickerLoadedUrl.value) {
    setPickerStrategy('cmf')
  }
  // If the user manually flipped tabs to leave action-record, they've
  // told us "I'm done navigating" — drop the deferred-intent flag so
  // the navigate-first CTA doesn't keep reappearing.
  if (m !== 'action-record') {
    pickerIntendedMode.value = null
  }
  // When entering AI Magic from a flatSelect stage, default the LLM
  // sub-mode to the segment+fields end-to-end flow (instead of plain
  // "Find selector"). The user can still switch to selector/actions
  // from the dropdown if they want.
  if (m === 'ai-magic' && pickerTargetStageIdx.value != null) {
    const row = wizPipeline.value[pickerTargetStageIdx.value]
    if (row && row.stage === 'flatSelect') aiMode.value = 'flatselect'
  }
  // Translate the parent's UI mode to one the iframe picker understands.
  // AI Magic uses selector-single under the hood (so click → LCA-refine works).
  const ifrMode = m === 'ai-magic' ? 'selector-single' : m
  const ifr = document.getElementById('wr-picker-iframe')
  // linkMode: explore/join/visitExplore FOLLOW a link, so the picker must
  // climb to the <a href>. flatSelect/extract pick rows/fields, not links.
  const linkMode = pickerOriginIsExplore.value || pickerOriginIsJoin.value
  try { ifr && ifr.contentWindow && ifr.contentWindow.postMessage({ type: 'webrobot-picker-mode', mode: ifrMode, linkMode }, '*') } catch (_) {}
  if (m === 'action-record') pickerSelected.value = null
  if (m !== 'action-record')  pickerActions.value = []
  if (m !== 'multi-sample') {
    // Switched away from sampling — drop the local mirror so the panel
    // restarts from zero next time the user enters the mode. picker.js
    // already cleared its own highlights on the mode message.
    multiSampleStatus.value = { selector: null, matches: 0, samples: 0, sampleText: '' }
  }
  if (m !== 'ai-magic') {
    // Drop AI Magic state + highlights when switching away.
    clearHighlightInIframe()
    aiAlgoResults.value = []
    aiLlmResults.value = []
    aiPickedRefined.value = null
    aiError.value = null
  }
}
function clearMultiSamples() {
  // Bounce the iframe out of and back into multi-sample so picker.js
  // wipes its local seed array + highlight classes.
  setPickerMode('selector-single')
  setPickerMode('multi-sample')
}
function applyMultiSampleSelector() {
  const sel = multiSampleStatus.value.selector
  if (!sel || pickerTargetStageIdx.value == null || !pickerTargetArgName.value) {
    closePicker(); return
  }
  updateStageArg(pickerTargetStageIdx.value, pickerTargetArgName.value, sel)
  closePicker()
}
function stopActionRecording() {
  const ifr = document.getElementById('wr-picker-iframe')
  try { ifr && ifr.contentWindow && ifr.contentWindow.postMessage({ type: 'webrobot-picker-stop-recording' }, '*') } catch (_) {}
}

function applyPickedSelector() {
  if (!pickerSelected.value || pickerTargetStageIdx.value == null || !pickerTargetArgName.value) {
    closePicker(); return
  }
  updateStageArg(pickerTargetStageIdx.value, pickerTargetArgName.value, pickerSelected.value.selector)
  closePicker()
}

// Render recorded actions as a YAML snippet the user can paste into a
// fetch/visit `trace` arg. Format mirrors what NativeFetchStage's
// trace parser accepts.
const pickerActionsYaml = computed(() => {
  if (!pickerActions.value.length) return ''
  const lines = ['trace:']
  for (const a of pickerActions.value) {
    if (a.type === 'Click' && a.selector) {
      lines.push(`  - Click("${a.selector}")`)
    } else if (a.type === 'Type' && a.selector) {
      const safe = String(a.text || '').replace(/"/g, '\\"')
      lines.push(`  - Type("${a.selector}", "${safe}")`)
    } else if (a.type === 'Scroll') {
      lines.push(`  - Scroll(${a.y || 0})`)
    }
  }
  return lines.join('\n')
})
function copyPickerActions() {
  navigator.clipboard.writeText(pickerActionsYaml.value).then(
    () => { /* silent */ },
    () => alert('clipboard write failed'),
  )
}

// Same YAML projection as pickerActionsYaml but applied to the
// committed log (post-Send). Used both by the on-screen <pre> and
// by the Copy button on the commit panel.
function actionsToTraceYaml(list) {
  if (!list || !list.length) return ''
  const lines = ['trace:']
  for (const a of list) {
    if (a.type === 'Click' && a.selector) {
      lines.push(`  - Click("${a.selector}")`)
    } else if (a.type === 'Type' && a.selector) {
      const safe = String(a.text || '').replace(/"/g, '\\"')
      lines.push(`  - Type("${a.selector}", "${safe}")`)
    } else if (a.type === 'Scroll') {
      lines.push(`  - Scroll(${a.y || 0})`)
    }
  }
  return lines.join('\n')
}
const committedActionsYaml = computed(() => actionsToTraceYaml(committedActions.value))
function copyCommittedTrace() {
  navigator.clipboard.writeText(committedActionsYaml.value).then(
    () => { /* silent */ },
    () => alert('clipboard write failed'),
  )
}

// Heuristic: is this arg a CSS selector? (drives whether to show the
// 🎯 button next to it). Hybrid args like `url_or_selector` (visit
// stage takes a URL OR a column ref OR a selector) are excluded —
// they're URL-shaped most of the time and rendering the picker
// next to them was confusing the user into thinking the field was
// CSS-only.
function isSelectorArg(arg) {
  if (!arg || !arg.name) return false
  const n = arg.name.toLowerCase()
  // Pure URL fields (or hybrid url/selector fields) get URL treatment.
  if (n.includes('url') || n === 'href' || n === 'src') return false
  // `on` is the join-family row anchor: "Column reference ($col) or CSS
  // selector to join on". Bare `join` / wgetJoin / intelligentJoin use
  // this name instead of `selector` — so without this branch the 🎯
  // Pick button wouldn't render on the only stage arg that needs it.
  if (n === 'on') return true
  // Defensive: any catalog arg whose description explicitly mentions
  // "CSS selector" should expose the picker even if its name doesn't
  // end in `selector` (covers future / plugin-defined args).
  if (arg.description && /css\s*selector/i.test(arg.description)) return true
  return /selector$/i.test(arg.name) || n === 'selector';
}

// Args that are structured field-lists (extract.extractors,
// flatSelect.extractors, etc.) live in row._fields not row.args, so
// rendering a generic <input> for them shows a confusing placeholder
// ("Array of {selector, method, as} maps — …" truncated) and a dead
// text field the user can't actually use. The 📋 Fields panel below
// is the only correct UI for them. Same alias set as the validator.
const FIELDS_LIST_ARG_NAMES = new Set(['extractors', 'fields', 'columns'])
function isFieldsListArg(arg) {
  return !!(arg && arg.name && FIELDS_LIST_ARG_NAMES.has(arg.name))
}

// Compact, type-driven placeholder for the arg input. The catalog
// description is shown in full as a label suffix; the placeholder
// should hint at the SHAPE of the value, not repeat the description.
function argPlaceholder(arg) {
  if (!arg) return ''
  const n = (arg.name || '').toLowerCase()
  const t = (arg.type || '').toLowerCase()
  // URL check first — hybrid names like `url_or_selector` (visit
  // stage) would otherwise fall into the selector branch.
  if (n.includes('url') || n === 'href' || n === 'src') return 'https://example.com/…'
  if (isSelectorArg(arg))      return 'e.g. div.product > h2 a'
  if (n === 'jointype')        return 'LeftOuter | Inner'
  if (n === 'depth' || t === 'int' || t === 'integer') return 'integer, e.g. 1'
  if (n.startsWith('$'))       return '$column_name'
  return ''
}

// Stages whose primary selector arg points at a REPEATING link/card
// (next-page paginator, list of item links, etc.). Open the picker
// in 'multi-sample' mode: the user clicks 2+ example links, the
// picker intersects their tag+class paths and emits a selector that
// matches all of them via querySelectorAll. More robust than
// 'selector-list' (single-click generalisation) because it confirms
// the pattern across multiple seeds — class collisions and one-off
// outliers don't survive the intersection.
const LIST_PICK_STAGES = new Set([
  'intelligentExplore',
  'intelligentWgetExplore',
  'wgetExplore',
  'visitExplore',
  'explore',
  'intelligentJoin',
  'intelligentWgetJoin',
  'wgetJoin',
  'visitJoin',
  'join',
  // flatSelect's segmentSelector/selector picks the REPEATING row that
  // contains the fields — same UX as explore: click 2+ examples, picker
  // generalises a CSS selector that matches all sibling rows, highlights
  // them all so the user can see the row count before committing.
  'flatSelect',
])
function pickModeFor(stage) {
  return LIST_PICK_STAGES.has(stage) ? 'multi-sample' : 'selector-single'
}

// postMessage listener for the proxied iframe.
// AI-generalize a too-specific row/segment selector. Calls the existing
// PTA-backed segment inferencer with the element+parent HTML the picker sent
// (it holds the repeating siblings) and replies to the iframe with a
// generalized selector. Best-effort: on error / PTA-not-configured (503) we
// stay silent and the picker keeps its heuristic selector.
async function handleGeneralizeRequest(d, source) {
  const html = (d && d.html) ? String(d.html) : ''
  if (!html || !source) return
  const sample = (d && d.sampleText) ? String(d.sampleText).slice(0, 120) : ''
  const nested = !!(d && d.nested)
  // Link-following origin (explore/join/visitExplore): the stage navigates to
  // each link's href, so the selector MUST terminate on the <a> anchor — not
  // an inner <span>/text node (which has no href → Visit('A.href)=N/A → no
  // navigation → null rows). The deterministic picker climb to closest('a[href]')
  // is the primary fix; this LLM prompt rectifies/generalizes when it fires.
  const linkFollow = (typeof d.linkMode === 'boolean')
    ? d.linkMode
    : (pickerOriginIsExplore.value || pickerOriginIsJoin.value)
  const prompt = linkFollow
    ? ('Find the CSS selector of the repeating LINK in this list'
        + (sample ? ` whose text is «${sample}»` : '')
        + '. The selector MUST target the <a> anchor element itself and END at that '
        + '`a` (so it carries an href to follow) — do NOT end on an inner span/heading/'
        + 'text node. It must match ALL such links: ignore auto-generated/hashed classes '
        + 'and :nth-of-type; prefer stable tags/attributes, ending in `a` or `a[href]`.')
    : nested
    ? ('This is a NESTED / threaded structure (e.g. comments) where the same item '
        + 'repeats at MULTIPLE nesting depths' + (sample ? ` (one contains the text «${sample}»)` : '')
        + '. Return ONE depth-agnostic CSS selector that matches EVERY node at EVERY depth '
        + '(top-level and all replies), e.g. the custom element tag or a stable class/attribute. '
        + 'Do NOT constrain by depth or position; ignore auto-generated/hashed classes and '
        + ':nth-of-type; prefer stable tags/attributes (custom element, data-testid, semantic class).')
    : ('Find the CSS selector of the repeating ROW/item of the list'
        + (sample ? ` that contains the text «${sample}»` : '')
        + '. It must match ALL similar rows: ignore auto-generated/hashed classes and '
        + ':nth-of-type, prefer stable tags/attributes (data-testid, custom element, semantic classes).')
  try {
    wizStatus.value = { kind: 'info', text: '🧬 Generalizing row selector (AI)…' }
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-segment`, {
      method: 'POST',
      body: JSON.stringify({ html, segmentation_prompt: prompt }),
    })
    const j = await r.json().catch(() => ({}))
    const sel = r.ok ? (j.segment_selector || '') : ''
    if (sel) {
      try { source.postMessage({ type: 'webrobot-generalize-result', selector: sel }, '*') } catch (_) {}
      wizStatus.value = { kind: 'info', text: '🧬 Generalized row selector applied.' }
    } else {
      wizStatus.value = { kind: 'info', text: 'AI generalization unavailable — using the heuristic selector.' }
    }
  } catch (e) {
    // silent fallback to heuristic
  }
}

// Ask the backend (LLM) for a cleaner ARTICLE-BODY selector after the user
// picked a long-text field. The user usually clicks a broad column whose
// extraction then includes related-articles / CTAs / the paywall instead of
// the article. Surfaces a suggestion banner (selector + method + paywall flag)
// that the user applies or ignores — never auto-overwrites the pick.
async function suggestBodySelector(stageIdx, fIdx, pickedSelector, pickedHtml) {
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-body-selector`, {
      method: 'POST',
      body: JSON.stringify({
        url: pickerLoadedUrl.value || '',
        picked_selector: pickedSelector,
        picked_html: pickedHtml || '',
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) return
    const sel = (j.selector || '').trim()
    const paywalled = j.paywalled === true
    // Worth showing if we got a cleaner selector OR a paywall warning.
    if (!sel && !paywalled) return
    bodySuggestion.value = {
      stageIdx, fIdx,
      pickedSelector,
      selector: sel,
      method: (j.method === 'text') ? 'text' : 'boilerPipe',
      why: j.why || '',
      confidence: (typeof j.confidence === 'number') ? j.confidence : null,
      paywalled,
      paywallReason: j.paywall_reason || '',
    }
  } catch (_) { /* silent — suggestion is best-effort */ }
}

function applyBodySuggestion() {
  const s = bodySuggestion.value
  if (!s) return
  if (s.selector) updateFieldProp(s.stageIdx, s.fIdx, 'selector', s.selector)
  if (s.method)   updateFieldProp(s.stageIdx, s.fIdx, 'method', s.method)
  wizStatus.value = { kind: 'info', text: `✨ Selettore body applicato (${s.method}).` }
  bodySuggestion.value = null
}

function dismissBodySuggestion() { bodySuggestion.value = null }

function onPickerMessage(ev) {
  const d = ev.data
  if (!d || typeof d !== 'object') return
  if (d.type === 'webrobot-generalize-request') {
    // picker.js picked a row/segment box but the heuristic selector matched
    // ≤1 (too specific — e.g. Reddit web-components + hashed classes). Run
    // LLM segment inference on the element+parent HTML and reply with a
    // generalized selector; picker.js validates + applies it.
    handleGeneralizeRequest(d, ev.source)
    return
  }
  if (d.type === 'webrobot-pick-selector') {
    // oddsSelect market-box capture: the user picked ONE market block. Append
    // it as a market + auto-run AI structure inference. Do NOT treat it as a
    // normal field/macro pick.
    if (pickingMarketBox.value != null) {
      const stageIdx = pickingMarketBox.value
      pickingMarketBox.value = null
      appendMarket(stageIdx, d.selector, d.sampleHtmlFull || d.sampleHtml || '')
      return
    }
    // Macro-box capture: the user is scoping the content region for AI field
    // inference. Store the box (selector + its full HTML) + keep it highlighted,
    // and stop — do NOT treat it as a normal field/selector pick.
    if (pickingMacroBox.value) {
      macroBox.value = { selector: d.selector, html: d.sampleHtmlFull || d.sampleHtml || '' }
      pickingMacroBox.value = false
      sendHighlightToIframe([{ selector: d.selector, color: '#6366f1', label: 'content box' }])
      wizStatus.value = { kind: 'info', text: '📦 Content box set — describe the fields, then 🪄 Auto-suggest.' }
      return
    }
    pickerSelected.value = {
      selector: d.selector,
      matches: d.matches,
      sampleText: d.sampleText,
      sampleHtml: d.sampleHtml,
      mode: d.mode,
    }
    aiPickedRefined.value = d.refinedFromHighlight || null
    // 🧩 Row (2 clicks): the LCA wrapper is an EXPLICIT row-container
    // definition — auto-apply it to the target segment arg instead of
    // making the user click "Use this selector" afterwards. The green
    // highlight in the picker reads as "done", so users skipped the apply
    // step → the flatSelect kept its old (per-column) segment → rows came
    // out single/misaligned on Spark. Also warn when the wrapper matches
    // ≤1: a non-repeating container means it's NOT a real row wrapper
    // (likely parallel sibling columns → use parallelSelect instead).
    if (d.mode === 'row-lca' && pickerTargetStageIdx.value != null &&
        typeof pickerTargetArgName.value === 'string' &&
        pickerTargetArgName.value.indexOf('__field_selector__:') !== 0) {
      updateStageArg(pickerTargetStageIdx.value, pickerTargetArgName.value, d.selector)
      const n = d.matches
      if (n <= 1) {
        wizStatus.value = { kind: 'error', text: `🧩 Row container matched only ${n} element — that's not a repeating wrapper. Click two parts of ONE row (closer together), or switch the stage to parallelSelect for split (avatar+body) rows.` }
      } else {
        wizStatus.value = { kind: 'info', text: `🧩 Row container set (${n} rows): ${d.selector}` }
      }
      closePicker()
      return
    }
    // Field-row picker (single click from a specific field's 🎯 Pick).
    // The target arg name is encoded as "__field_selector__:<idx>" so
    // we can route the pick back to the right row.
    if (typeof pickerTargetArgName.value === 'string' &&
        pickerTargetArgName.value.indexOf('__field_selector__:') === 0) {
      const fIdx = parseInt(pickerTargetArgName.value.split(':')[1], 10)
      if (!isNaN(fIdx) && pickerTargetStageIdx.value != null) {
        const stageIdx = pickerTargetStageIdx.value
        updateFieldProp(stageIdx, fIdx, 'selector', d.selector)
        // Refresh the field's available attributes (drives the method dropdown).
        if (Array.isArray(d.attributes)) {
          updateFieldProp(stageIdx, fIdx, '_attrs', d.attributes)
        }
        // Auto body-selector suggestion: if the picked element is a long text
        // block (article body), ask the backend (LLM) for a cleaner body
        // selector + recommended method + paywall flag. Human-in-the-loop:
        // we surface a suggestion banner; the user applies or ignores it.
        const textLen = (typeof d.fullTextLen === 'number')
          ? d.fullTextLen : (d.sampleText || '').length
        if (textLen >= 250) {
          suggestBodySelector(stageIdx, fIdx, d.selector, d.sampleHtmlFull || d.sampleHtml || '')
        }
        closePicker()
      }
    }
  } else if (d.type === 'webrobot-pick-multi-field-refine') {
    // picker.js detected that this click is the SAME logical column
    // as an existing field but in a different row → it generalised
    // the existing field's selector (stripped :nth-of-type chains).
    // Update the matching field in-place; do NOT append a duplicate.
    if (pickerTargetStageIdx.value != null && typeof d.index === 'number') {
      const stageIdx = pickerTargetStageIdx.value
      const fields = wizPipeline.value[stageIdx]?._fields
      if (Array.isArray(fields) && fields[d.index]) {
        fields[d.index].selector = d.selector
        if (d.matches != null) fields[d.index]._matches = d.matches
        wizPipeline.value = [...wizPipeline.value]
      }
    }
  } else if (d.type === 'webrobot-pick-multi-field') {
    // Multi-field picker accumulates clicks. Each click appends a new
    // field row on the target stage — UNLESS the same selector is
    // already present, in which case we no-op (double-clicking the
    // same cell, or picker.js auto-generalising to a selector that
    // happens to match an existing field, must not produce a dupe).
    if (pickerTargetStageIdx.value != null) {
      const stageIdx = pickerTargetStageIdx.value
      const fields = ensureFieldsArray(stageIdx) || []
      const incomingSel = (d.selector || '').trim()
      // Diagnostic: print exact selector chars + existing list so we can
      // see WHY dedup misses (whitespace? case? trailing char?).
      console.debug('[demo-wizard] pick-multi-field IN:',
        'incoming=', JSON.stringify(incomingSel),
        'existing=', fields.map(f => JSON.stringify((f.selector || '').trim())))
      if (incomingSel && fields.some(f => (f.selector || '').trim() === incomingSel)) {
        console.debug('[demo-wizard] DEDUP HIT — skipping append')
        wizStatus.value = {
          kind: 'info',
          text: 'Selector already in the fields list — duplicate skipped.',
        }
        return
      }
      // Auto-suggest a column name from the sample text if it's short
      // and not numeric — falls back to "field_N".
      const guess = (() => {
        const t = (d.sampleText || '').trim()
        if (!t) return 'field_' + (fields.length + 1)
        if (/^\d+([.,]\d+)?$/.test(t)) return 'field_' + (fields.length + 1)
        return t.toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 24) || ('field_' + (fields.length + 1))
      })()
      const method = (() => {
        // Smart default. Runtime extractor syntax is attr(name) —
        // NativeFlatSelectStage parses `attr(...)`; anything else goes
        // through ScalaDynamicExtractor. The inline chips let the user
        // override in one click.
        const txt = (d.sampleText || '').trim()
        const attrs = Array.isArray(d.attributes) ? d.attributes : []
        // No visible text but carries an image/link attr → use that attr.
        if (!txt && attrs.includes('src')) return 'attr(src)'
        if (!txt && attrs.includes('href')) return 'attr(href)'
        if (/img/i.test(d.selector || '') && attrs.includes('src')) return 'attr(src)'
        if (/href/i.test(d.selector || '') && attrs.includes('href')) return 'attr(href)'
        return 'text'
      })()
      wizPipeline.value[stageIdx]._fields = [
        ...fields,
        { selector: d.selector, as: guess, method, _color: d.color, _sample: d.sampleText,
          _sampleHtml: d.sampleHtml || d.sampleHtmlFull || null,
          // Field picked OUTSIDE the segment → marks the row as SPLIT, so
          // buildYamlFromPipeline emits parallelSelect (cardinality join).
          _parallel: !!d.parallel,
          _attrs: Array.isArray(d.attributes) ? d.attributes : [] },
      ]
      wizPipeline.value = [...wizPipeline.value]
    }
  } else if (d.type === 'webrobot-picker-field-samples') {
    // Values resolved on the page for the LLM-suggested selectors — fill the
    // list's sample column (index-aligned with the request). This is what makes
    // the suggested rows "valorize"; the LLM only returns selectors.
    const sIdx = pendingSampleStageIdx.value
    if (sIdx != null && wizPipeline.value[sIdx] && Array.isArray(wizPipeline.value[sIdx]._fields)) {
      const flds = wizPipeline.value[sIdx]._fields
      ;(Array.isArray(d.samples) ? d.samples : []).forEach((s, i) => {
        if (flds[i] && s) {
          if (s.text) flds[i]._sample = s.text
          if (s.html) flds[i]._sampleHtml = s.html
        }
      })
      wizPipeline.value = [...wizPipeline.value]
    }
    pendingSampleStageIdx.value = null
  } else if (d.type === 'webrobot-picker-multi-warn') {
    // Surface the warning briefly (e.g. clicked outside flatSelect container).
    wizStatus.value = { kind: 'error', text: d.warn || 'click was outside the segment container' }
  } else if (d.type === 'webrobot-picker-multi-rows') {
    // Picker reports how many rows the configured container selector
    // currently matches. Surface as a status info chip so the user can
    // sanity-check the row selector before picking fields.
    const n = typeof d.count === 'number' ? d.count : 0
    wizStatus.value = {
      kind: n > 0 ? 'info' : 'error',
      text: n > 0
        ? `Picker tracking ${n} row${n === 1 ? '' : 's'} via container selector.`
        : 'Picker tracking 0 rows — the container selector matches nothing on this page.',
    }
  } else if (d.type === 'webrobot-pick-multi-sample') {
    // Repeating-link sampler progress ping. d.selector may be null if
    // the seeds don't yet share a usable suffix (rare — usually means
    // user clicked unrelated elements).
    multiSampleStatus.value = {
      selector:   d.selector || null,
      matches:    typeof d.matches === 'number' ? d.matches : 0,
      samples:    typeof d.samples === 'number' ? d.samples : 0,
      sampleText: d.sampleText || '',
    }
  } else if (d.type === 'webrobot-step-request') {
    // Legacy auto-send path: picker.js used to emit this on every
    // non-editable click. That auto-send was removed (see picker.js
    // line ~460). Keep the handler as a defensive no-op-by-default —
    // some older cached picker.js builds might still emit. Apply the
    // same trace-only filter as sendStagedActionsToCamoufox so the
    // user experience matches the manual Send path.
    if (cmfSessionId.value && (d.action || (Array.isArray(d.actions) && d.actions.length))) {
      let batch = Array.isArray(d.actions) ? d.actions.slice() : [d.action]
      if (!antiBotDetected.value) {
        const traceTypes = new Set(['Click', 'Type', 'Scroll'])
        batch = batch.filter(a => a && a.type && traceTypes.has(a.type))
      }
      if (batch.length) {
        pickerActions.value = []
        forwardStepToCamoufox(batch)
      }
    }
  } else if (d.type === 'webrobot-pick-actions') {
    pickerActions.value = Array.isArray(d.actions) ? d.actions : []
  } else if (d.type === 'webrobot-picker-navigation') {
    // Page is reloading in action mode — buffer already received.
  } else if (d.type === 'webrobot-picker-anti-bot-detected') {
    // picker.js detected an anti-bot indicator (Cloudflare turnstile,
    // Datadome, hCaptcha, PerimeterX, interstitial text). It has
    // ALREADY flipped into raw-event capture mode locally; we just
    // need to surface this to the operator and tag the target
    // pipeline as requires_hitl so the eventual replay forces
    // hitlAwait=true at run time.
    onAntiBotDetected(d.reason || 'unknown')
  } else if (d.type === 'webrobot-picker-resume-request') {
    // Iframe banner Resume button → POST /cmf/{sid}/resume. On success
    // clear cmfBlock + tell iframe to drop its banner; on 409 the block
    // is still there (user clicked Resume too early) — keep the banner
    // and let the user try again.
    resumeAfterCaptcha()
  } else if (d.type === 'webrobot-picker-ready') {
    // Iframe (re)loaded — picker.js boots in default 'selector-single'.
    // Echo back the current UI mode so click handling matches what the
    // user sees in the toolbar; otherwise an 'action-record' UI would
    // still hit the selector branch and never forward clicks to Camoufox.
    // This also covers the /cmf/step path, which replaces the srcdoc.
    const ifrMode = pickerMode.value === 'ai-magic'
      ? 'selector-single'
      : (pickerMode.value || 'selector-single')
    const linkMode = pickerOriginIsExplore.value || pickerOriginIsJoin.value
    try { ev.source && ev.source.postMessage({ type: 'webrobot-picker-mode', mode: ifrMode, linkMode }, '*') } catch (_) {}
    // CRITICAL: re-send the container (segment) selector on EVERY iframe
    // (re)load. The one-shot setTimeout in openMultiFieldPicker /
    // openFieldPicker fires once; if the iframe reloads afterwards (e.g.
    // a /cmf/step navigation that replaces the srcdoc, or simply slow
    // first paint that lands after the timeout), the fresh picker.js
    // instance has multiContainerSelector=null and every field pick
    // falls back to an ABSOLUTE selector (ul.srp-results > li…:nth-of-type
    // > …). Re-deriving + re-posting the config here makes the row
    // container sticky across reloads so field selectors stay relative.
    if (pickerTargetStageIdx.value != null) {
      const cfgRow = wizPipeline.value[pickerTargetStageIdx.value]
      const isFieldCtx = ifrMode === 'multi-field'
        || pickerIntendedMode.value === 'multi-field'
        || pickerIsFieldSelection.value
      if (isFieldCtx) {
        const cfgSeg = cfgRow && cfgRow.stage === 'flatSelect' && cfgRow.args
          ? (cfgRow.args.segmentSelector || cfgRow.args.selector)
          : null
        try {
          ev.source && ev.source.postMessage(
            { type: 'webrobot-picker-multi-config', containerSelector: cfgSeg || null }, '*')
        } catch (_) {}
      }
    }
    // If we have a pending block from a previous /cmf/step response,
    // re-send it now that the picker has remounted (iframe reload
    // resets blockInfo inside picker.js to null).
    if (cmfBlock.value) {
      try { ev.source && ev.source.postMessage({ type: 'webrobot-picker-block', block: cmfBlock.value }, '*') } catch (_) {}
    }
    // When the picker is reopened on a stage that already carries
    // row._fields (extract / flatSelect, user comes back to refine),
    // re-paint those seeds inside the iframe so the user sees
    // immediately what's saved. picker.js handles the restore
    // synchronously — re-resolves each selector against the current
    // DOM, applies the outline + color.
    if ((ifrMode === 'multi-field' || pickerIntendedMode.value === 'multi-field') && pickerTargetStageIdx.value != null) {
      const row = wizPipeline.value[pickerTargetStageIdx.value]
      const fields = (row && Array.isArray(row._fields)) ? row._fields.filter(f => (f.selector || '').trim()) : []
      if (fields.length) {
        try {
          ev.source && ev.source.postMessage({
            type: 'webrobot-picker-multi-restore',
            fields: fields.map(f => ({
              selector: f.selector,
              color:    f._color || null,
              label:    f.as || null,
              sampleText: f._sample || null,
            })),
          }, '*')
        } catch (_) {}
      }
    }
  } else if (d.type === 'webrobot-picker-cancel') {
    closePicker()
  }
}

// Push a {selectors → colored highlights} layer set to picker.js.
function sendHighlightToIframe(layers) {
  const ifr = document.getElementById('wr-picker-iframe')
  try {
    ifr && ifr.contentWindow && ifr.contentWindow.postMessage({
      type: 'webrobot-highlight',
      layers: layers,
    }, '*')
  } catch (_) {}
}
function clearHighlightInIframe() {
  const ifr = document.getElementById('wr-picker-iframe')
  try {
    ifr && ifr.contentWindow && ifr.contentWindow.postMessage({
      type: 'webrobot-highlight-clear',
    }, '*')
  } catch (_) {}
}

// Drives both `infer-selector` and `infer-actions`. Algo result is the
// immediate fast-path (no LLM); the LLM call is awaited in the same
// fetch (server-side) but the layered highlights make the difference
// visible to the user (yellow first if we ever split — for v1 we just
// paint both together when the response lands).
// Multi-field AI auto-suggest. Calls /wizard/infer-fields, then replaces
// the target stage's _fields with the returned list. Uses the stage's
// flatSelect segment selector as container_selector when present, so
// the LLM returns RELATIVE selectors.
// Enter "select content box" mode: reuse single-selector picking, but route the
// next pick into macroBox instead of treating it as a field/selector.
function selectMacroBox() {
  pickingMacroBox.value = true
  const ifr = document.getElementById('wr-picker-iframe')
  try {
    ifr && ifr.contentWindow && ifr.contentWindow.postMessage(
      { type: 'webrobot-picker-mode', mode: 'selector-single', linkMode: false }, '*')
  } catch (_) {}
  wizStatus.value = { kind: 'info', text: '📦 Click the content region (e.g. the article body) to set the box.' }
}
function clearMacroBox() {
  macroBox.value = null
  clearHighlightInIframe()
}

// ── oddsSelect: deterministic multi-market odds extractor ───────────────────
// Each market on an oddsSelect stage lives in row._markets:
//   { label, sectionSelector, rowSelector, fields:[{selector,as,method}],
//     enabled, _sectionHtml }
function ensureMarketsArray(stageIdx) {
  const row = wizPipeline.value[stageIdx]
  if (!row) return null
  if (!Array.isArray(row._markets)) row._markets = []
  return row._markets
}

// Start picking ONE market box. We reuse the single-selector picker mode; the
// pick-selector handler routes the result to appendMarket when pickingMarketBox
// is set (instead of treating it as a macro box / field).
function addMarketBoxPick(stageIdx) {
  if (!pickerLoadedUrl.value) {
    wizStatus.value = { kind: 'error', text: 'Load the bookmaker page in the picker first (and scroll/expand to lazy-load the markets you want).' }
    return
  }
  pickingMarketBox.value = stageIdx
  pickerTargetStageIdx.value = stageIdx
  const ifr = document.getElementById('wr-picker-iframe')
  try {
    ifr && ifr.contentWindow && ifr.contentWindow.postMessage(
      { type: 'webrobot-picker-mode', mode: 'selector-single', linkMode: false }, '*')
  } catch (_) {}
  wizStatus.value = { kind: 'info', text: '📦 Click ONE market block (e.g. the whole "Match Result" table). Repeat for each market you want.' }
}

// Append a freshly-picked market box, then auto-run AI structure inference.
function appendMarket(stageIdx, selector, html) {
  const markets = ensureMarketsArray(stageIdx)
  if (!markets) return
  const mi = markets.length
  markets.push({
    label: '',
    sectionSelector: selector,
    rowSelector: '',
    fields: [],
    enabled: true,
    _sectionHtml: html || '',
  })
  wizPipeline.value = [...wizPipeline.value]
  sendHighlightToIframe([{ selector, color: '#f59e0b', label: 'market ' + (mi + 1) }])
  wizStatus.value = { kind: 'info', text: `📦 Market ${mi + 1} captured — inferring structure…` }
  inferMarketStructure(stageIdx, mi)
}

async function inferMarketStructure(stageIdx, marketIdx) {
  const row = wizPipeline.value[stageIdx]
  const mkt = row && Array.isArray(row._markets) ? row._markets[marketIdx] : null
  if (!mkt) return
  oddsInferKey.value = `${stageIdx}:${marketIdx}`
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-odds-structure`, {
      method: 'POST',
      body: JSON.stringify({ label: mkt.label || '', section_html: mkt._sectionHtml || '' }),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || 'infer failed')
    if (j.rowSelector) mkt.rowSelector = j.rowSelector
    if (Array.isArray(j.fields)) {
      mkt.fields = j.fields.map(f => ({
        selector: f.selector || '',
        as: f.as || 'field',
        method: f.method || 'text',
        _why: f.why || '',
      }))
    }
    if (!mkt.label) {
      // Derive a provisional label from the dominant semantic field.
      const sel = mkt.fields.find(f => f.as === 'selection')
      mkt.label = sel ? 'Market ' + (marketIdx + 1) : ('Market ' + (marketIdx + 1))
    }
    wizPipeline.value = [...wizPipeline.value]
    wizStatus.value = { kind: 'info', text: `🪄 Structure suggested for market ${marketIdx + 1} — review selection/odds, then confirm.` }
  } catch (e) {
    wizStatus.value = { kind: 'error', text: `AI structure inference failed: ${e.message}. Pick the row + fields manually.` }
  } finally {
    oddsInferKey.value = null
  }
}

function removeMarket(stageIdx, marketIdx) {
  const row = wizPipeline.value[stageIdx]
  if (!row || !Array.isArray(row._markets)) return
  row._markets.splice(marketIdx, 1)
  wizPipeline.value = [...wizPipeline.value]
}
function toggleMarketEnabled(stageIdx, marketIdx, val) {
  const row = wizPipeline.value[stageIdx]
  if (!row || !Array.isArray(row._markets) || !row._markets[marketIdx]) return
  row._markets[marketIdx].enabled = !!val
  wizPipeline.value = [...wizPipeline.value]
}
function updateMarketProp(stageIdx, marketIdx, prop, val) {
  const row = wizPipeline.value[stageIdx]
  if (!row || !Array.isArray(row._markets) || !row._markets[marketIdx]) return
  row._markets[marketIdx][prop] = val
  wizPipeline.value = [...wizPipeline.value]
}
function addMarketField(stageIdx, marketIdx) {
  const row = wizPipeline.value[stageIdx]
  const mkt = row && Array.isArray(row._markets) ? row._markets[marketIdx] : null
  if (!mkt) return
  if (!Array.isArray(mkt.fields)) mkt.fields = []
  mkt.fields.push({ selector: '', as: 'field', method: 'text' })
  wizPipeline.value = [...wizPipeline.value]
}
function updateMarketField(stageIdx, marketIdx, fIdx, prop, val) {
  const row = wizPipeline.value[stageIdx]
  const mkt = row && Array.isArray(row._markets) ? row._markets[marketIdx] : null
  if (!mkt || !Array.isArray(mkt.fields) || !mkt.fields[fIdx]) return
  mkt.fields[fIdx][prop] = val
  wizPipeline.value = [...wizPipeline.value]
}
function removeMarketField(stageIdx, marketIdx, fIdx) {
  const row = wizPipeline.value[stageIdx]
  const mkt = row && Array.isArray(row._markets) ? row._markets[marketIdx] : null
  if (!mkt || !Array.isArray(mkt.fields)) return
  mkt.fields.splice(fIdx, 1)
  wizPipeline.value = [...wizPipeline.value]
}
const ODDS_FIELD_ROLES = ['selection', 'odds', 'line', 'over_under', 'spread', 'player_name', 'field']

async function runAutoSuggestFields() {
  if (pickerTargetStageIdx.value == null) return
  if (!pickerLoadedUrl.value) {
    wizStatus.value = { kind: 'error', text: 'Load a target URL in the picker first.' }
    return
  }
  // Gate depends on the stage: flatSelect per-row fields are RELATIVE to the
  // row delimiter (segment) — that IS the container, so no macro box is needed
  // (find the row delimiter first). Everything else (extract) needs the box.
  {
    const _row = wizPipeline.value[pickerTargetStageIdx.value]
    const _isFlat = _row && _row.stage === 'flatSelect'
    const _seg = _isFlat && _row.args && (_row.args.segmentSelector || _row.args.selector)
    if (_isFlat) {
      if (!_seg) {
        wizStatus.value = { kind: 'error', text: 'Find the row delimiter first (segment) — then per-row fields are relative to it.' }
        return
      }
    } else if (!macroBox.value || !(macroBox.value.html || '').trim()) {
      wizStatus.value = { kind: 'error', text: 'Select a content box first (📦) so the AI infers from the right region.' }
      return
    }
  }
  const intent = aiIntent.value.trim()
  if (!intent) {
    wizStatus.value = { kind: 'error', text: 'Describe which fields to extract in the intent box.' }
    return
  }
  aiLoading.value = true
  aiError.value = null
  try {
    const row = wizPipeline.value[pickerTargetStageIdx.value]
    const body = {
      url: pickerLoadedUrl.value,
      // FOCUSED inference: send only the user-selected content box (the article
      // region), not the whole page. Avoids the 12k whole-page truncation that
      // dropped the article, and strips nav/footer/ad noise → far better
      // selectors. Falls back to the full rendered HTML if no box (shouldn't
      // happen — the button is gated on macroBox).
      html: (macroBox.value && macroBox.value.html) || pickerHtml.value || null,
      intent,
      stage_name: row && row.stage,
    }
    if (row && row.stage === 'flatSelect' && row.args) {
      // Honor either the catalog name (segmentSelector) or the legacy
      // wizard-internal name (selector). See buildYamlFromPipeline for
      // the same alias.
      const seg = row.args.segmentSelector || row.args.selector
      if (seg) body.container_selector = seg
    }
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-fields`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || 'infer-fields failed')
    const fields = (j.llm && j.llm.length ? j.llm : j.algo) || []
    replaceFields(pickerTargetStageIdx.value, fields)
    // Push highlights for visual confirmation in the iframe.
    const palette = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#ef4444','#14b8a6','#eab308']
    const layers = fields.map((f, i) => ({ selector: f.selector, color: palette[i % palette.length], label: f.as }))
    if (body.container_selector) {
      // For flatSelect, the LLM returned RELATIVE selectors — we need to
      // compose them with the container for the in-iframe highlight to
      // hit anything.
      const composed = layers.map(L => ({ ...L, selector: `${body.container_selector} ${L.selector}` }))
      sendHighlightToIframe(composed)
    } else {
      sendHighlightToIframe(layers)
    }
    // Populate the list's sample column: the LLM returns selectors, NOT values,
    // so resolve each selector ON THE PAGE and fill _sample — otherwise the
    // suggested rows show no value ("non valorizza"). Index-aligned response.
    pendingSampleStageIdx.value = pickerTargetStageIdx.value
    const sampleSels = body.container_selector
      ? fields.map(f => `${body.container_selector} ${f.selector}`)
      : fields.map(f => f.selector)
    try {
      const ifr2 = document.getElementById('wr-picker-iframe')
      ifr2 && ifr2.contentWindow && ifr2.contentWindow.postMessage(
        { type: 'webrobot-picker-sample-fields', selectors: sampleSels }, '*')
    } catch (_) {}
  } catch (e) {
    aiError.value = 'Error: ' + (e.message || String(e))
  } finally {
    aiLoading.value = false
  }
}

async function runAiMagic() {
  if (!pickerLoadedUrl.value) {
    aiError.value = 'Load a target URL first.'
    return
  }
  const intent = aiIntent.value.trim()
  if (!intent) {
    aiError.value = 'Describe what to find (intent textarea).'
    return
  }
  aiLoading.value = true
  aiError.value = null
  aiAlgoResults.value = []
  aiLlmResults.value = []
  aiPickedRefined.value = null
  clearHighlightInIframe()

  // Stage context — if the modal was opened from a specific arg, pass
  // the stage name, the arg name, and the arg's catalog description.
  // The server uses these to bias both the algo candidates (e.g. strip
  // :nth-of-type for list-pattern stages) and the LLM prompt (extra
  // Context block before the Rules).
  const ctx = {}
  if (pickerTargetStageIdx.value != null) {
    const row = wizPipeline.value[pickerTargetStageIdx.value]
    if (row) {
      ctx.stage_name = row.stage
      const spec = findStageSpec(row.stage)
      const argDef = spec && (spec.arg_schema || []).find(a => a.name === pickerTargetArgName.value)
      if (pickerTargetArgName.value) ctx.arg_name = pickerTargetArgName.value
      if (argDef && argDef.description) ctx.arg_description = argDef.description
    }
  }

  // ── flatSelect end-to-end branch ───────────────────────────────
  // Two calls: first infer-segment (skip if user already typed a row
  // selector), then infer-fields with that segment as container. The
  // result is bundled in aiFlatSelectResult so the user reviews and
  // applies with one click via applyAiFlatSelect().
  if (aiMode.value === 'flatselect') {
    try {
      const row = pickerTargetStageIdx.value != null ? wizPipeline.value[pickerTargetStageIdx.value] : null
      let segSel = row && row.args && (row.args.segmentSelector || row.args.selector)
      let segMatches = null
      // Send the Camoufox-rendered HTML alongside the URL — server prefers
      // it and skips its bare-wget fetch which 403s on anti-bot sites
      // (Bazaraki, eBay, Amazon). pickerHtml.value is the live snapshot
      // returned by /cmf/open or /cmf/step, exactly what the user sees.
      // Prefer the macro box (the list region the user scoped) so segment
      // inference is focused; else the full live snapshot.
      const liveHtml = (macroBox.value && macroBox.value.html) || pickerHtml.value || null
      if (!segSel || !String(segSel).trim()) {
        const r1 = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-segment`, {
          method: 'POST',
          body: JSON.stringify({ url: pickerLoadedUrl.value, html: liveHtml, segmentation_prompt: intent }),
        })
        const j1 = await r1.json()
        if (!r1.ok || j1.error || !j1.segment_selector) {
          throw new Error(j1.error || 'PTA could not find a repeating container')
        }
        segSel = j1.segment_selector
        segMatches = j1.segment_matches || null
      }
      const r2 = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-fields`, {
        method: 'POST',
        body: JSON.stringify({ url: pickerLoadedUrl.value, html: liveHtml, intent, container_selector: segSel, stage_name: 'flatSelect' }),
      })
      const j2 = await r2.json()
      if (!r2.ok || j2.error) throw new Error(j2.error || 'infer-fields failed')
      // Server returns {algo:[…], llm:[…]} — prefer llm tier; fields
      // come in a structured shape but field names vary; normalise.
      const raw = (j2.llm && j2.llm.length ? j2.llm : (j2.algo || []))
      const fields = raw.map(f => ({
        as:       f.as || f.name || f.column || '',
        method:   f.method || f.extract || 'text',
        selector: f.selector || f.selector_relative || f.css || '',
        sample:   f.sample || f.sample_text || '',
      })).filter(f => f.selector)
      aiFlatSelectResult.value = { segmentSelector: segSel, segmentMatches: segMatches, fields }
      // Live preview in iframe: highlight segment rows + every field
      // selector across all rows so the user sees the full extraction
      // shape before committing.
      const layers = [{ selector: segSel, color: '#3b82f6', label: 'segment' }]
      const palette = ['#10b981','#f59e0b','#ec4899','#8b5cf6','#ef4444','#14b8a6','#eab308']
      fields.forEach((f, fi) => {
        // qualify the relative selector with the segment so the parent
        // page's querySelectorAll resolves the column at each row.
        layers.push({ selector: segSel + ' ' + f.selector, color: palette[fi % palette.length], label: f.as })
      })
      sendHighlightToIframe(layers)
    } catch (e) {
      aiError.value = e.message || String(e)
    } finally {
      aiLoading.value = false
    }
    return
  }

  const path = aiMode.value === 'actions' ? 'infer-actions' : 'infer-selector'
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/${path}`, {
      method: 'POST',
      // Send the rendered HTML (focused on the macro box if the user scoped one)
      // — infer-selector's bare wget is blind on anti-bot / JS-rendered pages,
      // so explore/join link inference was guessing. Box → focused list region.
      body: JSON.stringify({
        url: pickerLoadedUrl.value, intent,
        html: (macroBox.value && macroBox.value.html) || pickerHtml.value || null,
        ...ctx,
      }),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || `${path} failed`)

    aiAlgoResults.value = j.algo || []
    aiLlmResults.value  = (aiMode.value === 'actions' ? (j.llm || []) : (j.llm || []))
    aiRawLlm.value      = j.raw_llm || null

    // Highlight algo (yellow) + LLM (green). Only selector mode draws
    // overlays on the page — action sequences have no single "selector
    // to highlight", we just show the list in the side panel.
    if (aiMode.value === 'selector') {
      const layers = []
      for (const c of aiAlgoResults.value) {
        if (c.selector) layers.push({ selector: c.selector, color: '#fbbf24', label: 'algo' })
      }
      for (const c of aiLlmResults.value) {
        if (c.selector) layers.push({ selector: c.selector, color: '#43a047', label: 'AI' })
      }
      sendHighlightToIframe(layers)
    } else {
      // For actions, highlight the FIRST action's selector if any (gives
      // the user a visual anchor on where the sequence starts).
      const first = (aiLlmResults.value[0] || aiAlgoResults.value[0])
      if (first && first.selector) {
        sendHighlightToIframe([{ selector: first.selector, color: '#43a047', label: 'first action' }])
      }
    }
  } catch (e) {
    aiError.value = 'Error: ' + (e.message || String(e))
  } finally {
    aiLoading.value = false
  }
}

// Apply the full flatSelect AI Magic proposal: write segmentSelector
// into row.args + each suggested field into row._fields, then close
// the modal. The user reviews the table in the panel before clicking
// Apply, so this is the irreversible commit step.
// ── Python post-processing extensions ────────────────────────────
function addPythonExtension(type) {
  const proposedName = type === 'row_transform' ? 'transform_row'
    : (type === 'dataframe_transform' ? 'transform_df' : 'query_df')
  // Avoid name collisions when the user clicks + multiple times in a row.
  let n = proposedName, suffix = 2
  while (wizPythonExtensions.value.some(e => e.name === n)) { n = proposedName + '_' + suffix++; }
  wizPythonExtensions.value = [
    ...wizPythonExtensions.value,
    { name: n, type: type, functionBody: '', intent: '' },
  ]
}
function removePythonExtension(idx) {
  const next = [...wizPythonExtensions.value]; next.splice(idx, 1); wizPythonExtensions.value = next
}
function pythonBodyPlaceholder(type) {
  if (type === 'row_transform') {
    return '# Body of def NAME(row: dict) -> dict — runs as PySpark UDF per row.\n'
      + '# Sandbox: stdlib only. For LLM calls use the pre-injected helper\n'
      + '#   webrobot_llm(prompt, system=None, model=None, temperature=0.2)\n'
      + '# which transparently uses the org\'s WEBROBOT_LLM_* credentials.\n'
      + '#\n'
      + '# Example (regex):\n'
      + 'import re\n'
      + "price_str = row.get('raw_price', '') or ''\n"
      + "m = re.search(r'\\d+(?:[.,]\\d+)?', price_str)\n"
      + "return {**row, 'price': float(m.group().replace(',', '.')) if m else None}\n"
      + '\n'
      + '# Example (LLM sentiment):\n'
      + "# text = (row.get('review_text') or '').strip()\n"
      + "# sentiment = webrobot_llm('Reply with POSITIVE/NEGATIVE/NEUTRAL: ' + text[:1500], temperature=0.0).strip().upper()\n"
      + "# return {**row, 'sentiment': sentiment}"
  }
  if (type === 'dataframe_transform') {
    return '# Body of def NAME(df, spark) -> DataFrame — driver-side, can import pyspark.sql.\n'
      + '# Example (groupBy + agg):\n'
      + 'from pyspark.sql.functions import count, avg, col\n'
      + "return (df.groupBy('category')\n"
      + "          .agg(count('*').alias('n_items'), avg(col('price').cast('double')).alias('avg_price'))\n"
      + "          .orderBy(col('n_items').desc()))\n"
      + '\n'
      + '# Example (window rank):\n'
      + '# from pyspark.sql.functions import row_number, col\n'
      + '# from pyspark.sql.window import Window\n'
      + "# w = Window.partitionBy('category').orderBy(col('price').cast('double').desc())\n"
      + "# return df.withColumn('rank_in_category', row_number().over(w))"
  }
  return '-- SQL run against the upstream DataFrame (registered as `df`).\n'
    + '-- Spark SQL dialect: ANSI-ish, backticks for reserved words, LIMIT not TOP.\n'
    + '-- Example:\n'
    + 'SELECT title, price FROM df WHERE price IS NOT NULL ORDER BY price DESC LIMIT 50'
}

async function aiMagicForPythonExt(idx) {
  const ext = wizPythonExtensions.value[idx]
  if (!ext) return
  const intent = (ext.intent || '').trim()
  if (!intent) return
  ext._aiBusy = true
  ext._valError = null
  // Collect upstream columns from the last extract/flatSelect _fields so
  // the LLM has the schema to write against. Falls back to an empty hint.
  const cols = []
  for (const row of wizPipeline.value) {
    if (Array.isArray(row._fields)) {
      for (const f of row._fields) if (f.as && cols.indexOf(f.as) === -1) cols.push(f.as)
    }
  }
  try {
    const r = await authenticatedDemoFetch(
      `${API_BASE_URL}/api/webrobot/api/demo/wizard/generate-python-transform`,
      { method: 'POST', body: JSON.stringify({
        intent: intent,
        type: ext.type,
        name: ext.name,
        available_columns: cols,
      }) }
    )
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || 'generate-python-transform failed')
    // Server returns {name, type, functionBody, valid, security}. Honor
    // name if the user left the default, keep type fixed (UI-driven).
    if (j.functionBody) ext.functionBody = j.functionBody
    if (j.name && (!ext.name || ext.name.startsWith('transform_') || ext.name.startsWith('query_'))) {
      ext.name = j.name
    }
    if (j.security && j.security.warning) {
      ext._valError = '⚠️ security: ' + j.security.warning
    }
  } catch (e) {
    ext._valError = 'AI Magic failed: ' + (e.message || String(e))
  } finally {
    ext._aiBusy = false
  }
  wizPythonExtensions.value = [...wizPythonExtensions.value]
}

function applyAiFlatSelect() {
  const idx = pickerTargetStageIdx.value
  if (idx == null || !aiFlatSelectResult.value) return
  const row = wizPipeline.value[idx]
  if (!row) return
  row.args = row.args || {}
  // flatSelect spec accepts either segmentSelector OR selector — pick
  // whichever the catalog defines first, fall back to selector for
  // older fixtures.
  const spec = findStageSpec(row.stage)
  const segArg = (spec && (spec.arg_schema || []).find(a => a.name === 'segmentSelector')) ? 'segmentSelector' : 'selector'
  row.args[segArg] = aiFlatSelectResult.value.segmentSelector
  // Replace fields wholesale — AI Magic's whole point is "do it for me".
  // The table is editable post-apply in the stage editor so manual
  // tweaks are easy.
  const palette = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#ef4444','#14b8a6','#eab308']
  row._fields = aiFlatSelectResult.value.fields.map((f, fi) => ({
    as:       f.as,
    method:   f.method || 'text',
    selector: f.selector,
    _sample:  f.sample || '',
    _color:   palette[fi % palette.length],
  }))
  wizPipeline.value = [...wizPipeline.value]
  wizStatus.value = { kind: 'ok',
    text: `🪄 AI Magic: segment "${aiFlatSelectResult.value.segmentSelector}" + ${row._fields.length} field(s) applicati a ${row.stage} (stage ${idx + 1}).` }
  aiFlatSelectResult.value = null
  closePicker()
}

function applyAiCandidate(c) {
  if (!c) return
  if (aiMode.value === 'selector' && c.selector) {
    if (pickerTargetStageIdx.value != null && pickerTargetArgName.value) {
      updateStageArg(pickerTargetStageIdx.value, pickerTargetArgName.value, c.selector)
      closePicker()
    } else {
      // Picker opened without a target — copy to clipboard as a fallback.
      navigator.clipboard.writeText(c.selector).catch(() => {})
    }
  } else if (aiMode.value === 'actions') {
    // Apply the full action sequence as a YAML trace snippet copied to
    // clipboard — the user pastes it into the relevant trace arg.
    const yaml = actionsToYaml(aiLlmResults.value.length ? aiLlmResults.value : aiAlgoResults.value)
    navigator.clipboard.writeText(yaml).catch(() => {})
  }
}

function applyRefinedFromHighlight() {
  if (!aiPickedRefined.value || !aiPickedRefined.value.selector) return
  if (pickerTargetStageIdx.value != null && pickerTargetArgName.value) {
    updateStageArg(pickerTargetStageIdx.value, pickerTargetArgName.value, aiPickedRefined.value.selector)
    closePicker()
  } else {
    navigator.clipboard.writeText(aiPickedRefined.value.selector).catch(() => {})
  }
}

function actionsToYaml(actions) {
  if (!actions || !actions.length) return ''
  const lines = ['trace:']
  for (const a of actions) {
    const sel = (a.selector || '').replace(/"/g, '\\"')
    const txt = (a.text     || '').replace(/"/g, '\\"')
    if (a.type === 'Click' && sel) lines.push(`  - Click("${sel}")`)
    else if (a.type === 'Type' && sel) lines.push(`  - Type("${sel}", "${txt}")`)
    else if (a.type === 'Wait') lines.push(`  - Wait(${a.ms || 1000})`)
    else if (a.type === 'Scroll') lines.push(`  - Scroll(${a.y || 0})`)
  }
  return lines.join('\n')
}

const wizPluginIds = computed(() =>
  Array.from(new Set(wizCatalog.value.map(s => s.plugin_id).filter(Boolean))).sort()
)

// Hand-curated suggestion graph. NOT an LLM call — just a small static
// map used to render "Try next" chips under each stage in the editor.
// Keys are stage names; values are catalog stage names that typically
// come next. Missing keys = no suggestions (user picks freely).
const STAGE_SUGGESTIONS = {
  'fetch':                  ['intelligentExplore', 'intelligentJoin', 'iextract', 'flatSelect', 'extract'],
  'visit':                  ['intelligentExplore', 'intelligentJoin', 'visitExplore', 'visitJoin', 'iextract', 'flatSelect'],
  'wget':                   ['intelligentWgetExplore', 'intelligentWgetJoin', 'wgetExplore', 'wgetJoin', 'iextract', 'extract'],
  'load_csv':               ['wget', 'visit', 'iextract'],
  'intelligentExplore':     ['intelligentJoin', 'iextract', 'extract'],
  'intelligentWgetExplore': ['intelligentWgetJoin', 'iextract', 'extract'],
  'visitExplore':           ['intelligentJoin', 'visitJoin', 'iextract', 'extract'],
  'wgetExplore':            ['intelligentJoin', 'wgetJoin', 'iextract', 'extract'],
  'intelligentJoin':        ['iextract', 'extract'],
  'intelligentWgetJoin':    ['iextract', 'extract'],
  'visitJoin':              ['iextract', 'extract'],
  'wgetJoin':               ['iextract', 'extract'],
  'iextract':               ['extract', 'save_csv'],
  'flatSelect':             ['extract', 'save_csv'],
}
// Starting points shown when the editor is empty.
const STAGE_STARTERS = ['fetch', 'visit', 'wget', 'load_csv']

function suggestionsFor(stageName) {
  // Only return suggestions that actually exist in the live catalog —
  // a hand-curated list shouldn't show entries the user can't click.
  const want = STAGE_SUGGESTIONS[stageName] || []
  return want.filter(n => wizCatalog.value.some(s => s.stage_name === n))
}
function starterSuggestions() {
  return STAGE_STARTERS.filter(n => wizCatalog.value.some(s => s.stage_name === n))
}
const wizFilteredCatalog = computed(() => {
  const plugin = wizPluginFilter.value
  const q = wizSearch.value.trim().toLowerCase()
  return wizCatalog.value.filter(s => {
    if (plugin && s.plugin_id !== plugin) return false
    if (!q) return true
    const hay = `${s.stage_name} ${(s.aliases || []).join(' ')} ${s.description || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

// Group the filtered catalog by `category` for a categorised browser
// view. Returns [{ category, label, items }] in a stable order roughly
// matching pipeline flow (source → crawl → extract → transform → sink).
// Categories not in CATEGORY_ORDER fall back to alphabetical at the end.
// "Uncategorized" always last.
// Pipeline-flow order — categories listed here surface in this exact
// order at the top of the catalog browser. Anything not listed falls
// to the alphabetical tail; "Uncategorized" always last.
// Keys MUST match the `category` strings in stage-catalog.json
// (see live JSON; current set: connector, analytics, io, external-api,
// crawling, utility, intelligent, use-case, rag, extraction, matching,
// python — counts as of 2026-05-29).
const CATEGORY_ORDER = [
  'source', 'io', 'connector', 'external-api',
  'crawling', 'browsing', 'intelligent',
  'extraction', 'matching',
  'transformation', 'python', 'utility',
  'analytics', 'rag', 'ml',
  'sink', 'output',
  'use-case',
]
const CATEGORY_LABELS = {
  'source':         '📥 Sources',
  'io':             '📂 I/O',
  'connector':      '🔌 Connectors',
  'external-api':   '🌐 External APIs',
  'crawling':       '🕷 Crawling',
  'browsing':       '🌍 Browsing',
  'intelligent':    '🪄 Intelligent (LLM)',
  'extraction':     '🎯 Extraction',
  'matching':       '🔗 Matching',
  'transformation': '🔧 Transformation',
  'python':         '🐍 Python',
  'utility':        '🔩 Utility',
  'analytics':      '📊 Analytics',
  'rag':            '🧠 RAG',
  'ml':             '🤖 ML',
  'sink':           '💾 Sinks',
  'output':         '📤 Output',
  'use-case':       '📦 Use cases',
  'Uncategorized':  '· Other',
}
// Infer a category bucket from stage_name / plugin_id when the catalog
// API doesn't carry one. The Strapi etl-stage-specs content-type was
// historically populated without the `category` field, so the live API
// returns category=null for ~all stages. Rather than wait for a Strapi
// content-model migration we classify client-side via the stage's
// canonical name + the plugin it ships from. Keep keys in sync with
// CATEGORY_ORDER above. Returns 'Uncategorized' if nothing matches.
function inferStageCategory(s) {
  if (!s) return 'Uncategorized'
  if (s.category && String(s.category).trim()) return String(s.category).trim()
  const name = (s.stage_name || '').toLowerCase()
  const plug = (s.plugin_id || '').toLowerCase()
  // Plugin-id hints win first — plugins are usually mono-category.
  if (plug.includes('rag')) return 'rag'
  if (plug.includes('sentiment') || plug.includes('price-comparison')
      || plug.includes('real-estate') || plug.includes('lead'))     return 'use-case'
  if (plug.includes('python'))                                       return 'python'
  // Stage-name suffix / prefix hints.
  if (/^load_|^read_|^fetch_csv$|^from_/.test(name))                 return 'io'
  if (/^save_|^write_|^to_/.test(name))                              return 'io'
  if (name.includes('fetch') || name.includes('visit')
      || name.includes('wget') || name.includes('explore')
      || name.includes('crawl'))                                      return 'crawling'
  if (name.includes('intelligent') || name.includes('aimagic')
      || name.includes('aiSuggest') || name.endsWith('_ai'))         return 'intelligent'
  if (name.includes('extract') || name === 'flatselect'
      || name === 'iextract')                                         return 'extraction'
  if (name.includes('join') || name.includes('match'))                return 'matching'
  if (name.includes('sentiment') || name.includes('aggregate'))       return 'analytics'
  if (name.includes('rag') || name.includes('embed')
      || name.includes('vector'))                                     return 'rag'
  if (name.includes('python') || name.includes('udf'))                return 'python'
  if (name.includes('api') || name.endsWith('api')
      || name.startsWith('macro'))                                    return 'external-api'
  if (name.includes('filter') || name.includes('sort')
      || name.includes('limit') || name.includes('dedupe'))           return 'utility'
  if (name.includes('connector') || /^mysql|^postgres|^mongo|^kafka|^elastic|^cassandra/.test(name))
                                                                       return 'connector'
  return 'Uncategorized'
}
const wizCatalogByCategory = computed(() => {
  const map = new Map()
  for (const s of wizFilteredCatalog.value) {
    const cat = inferStageCategory(s)
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(s)
  }
  // Sort items inside each group by stage_name.
  for (const items of map.values()) items.sort((a, b) => a.stage_name.localeCompare(b.stage_name))
  // Order groups: known categories first per CATEGORY_ORDER, then
  // alphabetical for any leftover, "Uncategorized" last.
  const groups = []
  for (const known of CATEGORY_ORDER) {
    if (map.has(known)) { groups.push({ category: known, items: map.get(known) }); map.delete(known) }
  }
  const rest = Array.from(map.entries())
    .filter(([c]) => c !== 'Uncategorized')
    .sort((a, b) => a[0].localeCompare(b[0]))
  for (const [cat, items] of rest) groups.push({ category: cat, items })
  if (map.has('Uncategorized')) groups.push({ category: 'Uncategorized', items: map.get('Uncategorized') })
  return groups.map(g => ({
    ...g,
    label: CATEGORY_LABELS[g.category] || ('· ' + g.category),
  }))
})
const wizYamlPreview = computed(() => buildYamlFromPipeline(wizPipeline.value, wizCatalog.value))

function findStageSpec(name) {
  return wizCatalog.value.find(s => s.stage_name === name || (s.aliases || []).includes(name))
}
function addStageToPipeline(stageName) {
  wizPipeline.value = [...wizPipeline.value, { stage: stageName, args: {} }]
}
function removeStage(idx) {
  const next = [...wizPipeline.value]; next.splice(idx, 1); wizPipeline.value = next
}
function moveStage(idx, dir) {
  const j = idx + dir
  if (j < 0 || j >= wizPipeline.value.length) return
  const next = [...wizPipeline.value]
  const tmp = next[idx]; next[idx] = next[j]; next[j] = tmp
  wizPipeline.value = next
}

// Single-line readable rendering of a recorded action, matching the
// YAML emitter so the inline preview and the final YAML look the same.
function formatTraceAction(a) {
  if (!a || !a.type) return ''
  if (a.type === 'Click'  && a.selector) return `Click("${a.selector}")`
  if (a.type === 'Type'   && a.selector) return `Type("${a.selector}", "${a.text || ''}")`
  if (a.type === 'Wait')   return `Wait(${a.ms || 1000})`
  if (a.type === 'Scroll') return `Scroll(${a.y || 0})`
  if (a.type === 'Back')   return 'Back()'
  return `${a.type}(${a.selector ? '"' + a.selector + '"' : ''})`
}
function clearStageTrace(idx) {
  const row = wizPipeline.value[idx]
  if (!row) return
  row._trace = []
  wizPipeline.value = [...wizPipeline.value]
}
function removeTraceAction(stageIdx, actionIdx) {
  const row = wizPipeline.value[stageIdx]
  if (!row || !Array.isArray(row._trace)) return
  row._trace = row._trace.filter((_, i) => i !== actionIdx)
  wizPipeline.value = [...wizPipeline.value]
}
function updateStageArg(idx, argName, value) {
  const row = wizPipeline.value[idx]
  if (!row) return
  row.args = { ...row.args, [argName]: value }
  wizPipeline.value = [...wizPipeline.value]
}

// ─── Structured editor for extract / flatSelect ─────────────────
// These stages take a list of {selector, as, method} field maps.
// We render them as a tabbed field-row editor on the stage, separate
// from the generic arg inputs.

function isStructuredFieldsStage(stageName) {
  return stageName === 'extract' || stageName === 'flatSelect'
}

function ensureFieldsArray(idx) {
  const row = wizPipeline.value[idx]
  if (!row) return null
  if (!Array.isArray(row._fields)) {
    row.args = row.args || {}
    row._fields = []
    wizPipeline.value = [...wizPipeline.value]
  }
  return row._fields
}
function addField(idx) {
  const f = ensureFieldsArray(idx)
  if (!f) return
  wizPipeline.value[idx]._fields = [...f, { selector: '', as: '', method: 'text' }]
  wizPipeline.value = [...wizPipeline.value]
}

// Ask the demo wizard's LLM (BYOC, demo org credential) to propose
// snake_case names for every picked field on a stage. Fields without
// a selector are skipped (LLM needs at least the selector to derive
// context). On success we patch row._fields[*].as in-place.
const suggestNamesLoading = ref(false)
const relaxingFields = ref(false)
// Macro content box: the user scopes the region (e.g. the article) the AI should
// infer fields from. Its full HTML is sent for focused inference (no 12k
// whole-page truncation, no nav/footer noise). AI auto-suggest is gated on it.
const macroBox = ref(null)          // { selector, html }
const pickingMacroBox = ref(false)  // true while waiting for the box click
// oddsSelect (deterministic odds extractor): the operator picks ONE box per
// market (lazy-loaded markets each have their own structure), AI magic infers
// the per-market odds structure, then ticks the subset to extract.
const pickingMarketBox = ref(null)  // stageIdx while waiting for a market-box click
const oddsInferKey     = ref(null)  // "stageIdx:marketIdx" while inferring structure
// Pipeline-level execution runtime. 'spark' (default) runs the pipeline as a
// Spark job; 'ray_actor' marks it to run as a Ray actor. METADATA ONLY for now
// — the actual dispatch is handled by the executor (Phase-4 elastic Ray); the
// flag just travels in metadata.runtime so the pipeline declares its intent.
const wizRuntime = ref('spark')
// Preferential geo zone for the residential proxy (DataImpulse). Empty = no
// geo (global rotating). ISO-2 code → emitted as metadata.geo, which the
// runtime turns into DATAIMPULSE_PROXY_COUNTRY (per-session context proxy).
const wizGeo = ref('')
const GEO_ZONES = [
  { code: '', label: '🌍 Auto (no geo)' }, { code: 'af', label: '🇦🇫 Afghanistan' }, { code: 'al', label: '🇦🇱 Albania' }, { code: 'dz', label: '🇩🇿 Algeria' },
  { code: 'ad', label: '🇦🇩 Andorra' }, { code: 'ao', label: '🇦🇴 Angola' }, { code: 'ar', label: '🇦🇷 Argentina' }, { code: 'am', label: '🇦🇲 Armenia' },
  { code: 'au', label: '🇦🇺 Australia' }, { code: 'at', label: '🇦🇹 Austria' }, { code: 'az', label: '🇦🇿 Azerbaijan' }, { code: 'bs', label: '🇧🇸 Bahamas' },
  { code: 'bh', label: '🇧🇭 Bahrain' }, { code: 'bd', label: '🇧🇩 Bangladesh' }, { code: 'bb', label: '🇧🇧 Barbados' }, { code: 'by', label: '🇧🇾 Belarus' },
  { code: 'be', label: '🇧🇪 Belgium' }, { code: 'bz', label: '🇧🇿 Belize' }, { code: 'bj', label: '🇧🇯 Benin' }, { code: 'bt', label: '🇧🇹 Bhutan' },
  { code: 'bo', label: '🇧🇴 Bolivia' }, { code: 'ba', label: '🇧🇦 Bosnia & Herzegovina' }, { code: 'bw', label: '🇧🇼 Botswana' }, { code: 'br', label: '🇧🇷 Brazil' },
  { code: 'bn', label: '🇧🇳 Brunei' }, { code: 'bg', label: '🇧🇬 Bulgaria' }, { code: 'bf', label: '🇧🇫 Burkina Faso' }, { code: 'bi', label: '🇧🇮 Burundi' },
  { code: 'kh', label: '🇰🇭 Cambodia' }, { code: 'cm', label: '🇨🇲 Cameroon' }, { code: 'ca', label: '🇨🇦 Canada' }, { code: 'cv', label: '🇨🇻 Cape Verde' },
  { code: 'ky', label: '🇰🇾 Cayman Islands' }, { code: 'td', label: '🇹🇩 Chad' }, { code: 'cl', label: '🇨🇱 Chile' }, { code: 'cn', label: '🇨🇳 China' },
  { code: 'co', label: '🇨🇴 Colombia' }, { code: 'cg', label: '🇨🇬 Congo' }, { code: 'cr', label: '🇨🇷 Costa Rica' }, { code: 'hr', label: '🇭🇷 Croatia' },
  { code: 'cu', label: '🇨🇺 Cuba' }, { code: 'cy', label: '🇨🇾 Cyprus' }, { code: 'cz', label: '🇨🇿 Czechia' }, { code: 'cd', label: '🇨🇩 DR Congo' },
  { code: 'dk', label: '🇩🇰 Denmark' }, { code: 'dj', label: '🇩🇯 Djibouti' }, { code: 'dm', label: '🇩🇲 Dominica' }, { code: 'do', label: '🇩🇴 Dominican Republic' },
  { code: 'ec', label: '🇪🇨 Ecuador' }, { code: 'eg', label: '🇪🇬 Egypt' }, { code: 'sv', label: '🇸🇻 El Salvador' }, { code: 'ee', label: '🇪🇪 Estonia' },
  { code: 'et', label: '🇪🇹 Ethiopia' }, { code: 'fj', label: '🇫🇯 Fiji' }, { code: 'fi', label: '🇫🇮 Finland' }, { code: 'fr', label: '🇫🇷 France' },
  { code: 'ga', label: '🇬🇦 Gabon' }, { code: 'gm', label: '🇬🇲 Gambia' }, { code: 'ge', label: '🇬🇪 Georgia' }, { code: 'de', label: '🇩🇪 Germany' },
  { code: 'gh', label: '🇬🇭 Ghana' }, { code: 'gr', label: '🇬🇷 Greece' }, { code: 'gd', label: '🇬🇩 Grenada' }, { code: 'gt', label: '🇬🇹 Guatemala' },
  { code: 'gn', label: '🇬🇳 Guinea' }, { code: 'gy', label: '🇬🇾 Guyana' }, { code: 'ht', label: '🇭🇹 Haiti' }, { code: 'hn', label: '🇭🇳 Honduras' },
  { code: 'hk', label: '🇭🇰 Hong Kong' }, { code: 'hu', label: '🇭🇺 Hungary' }, { code: 'is', label: '🇮🇸 Iceland' }, { code: 'in', label: '🇮🇳 India' },
  { code: 'id', label: '🇮🇩 Indonesia' }, { code: 'ir', label: '🇮🇷 Iran' }, { code: 'iq', label: '🇮🇶 Iraq' }, { code: 'ie', label: '🇮🇪 Ireland' },
  { code: 'il', label: '🇮🇱 Israel' }, { code: 'it', label: '🇮🇹 Italy' }, { code: 'ci', label: '🇨🇮 Ivory Coast' }, { code: 'jm', label: '🇯🇲 Jamaica' },
  { code: 'jp', label: '🇯🇵 Japan' }, { code: 'jo', label: '🇯🇴 Jordan' }, { code: 'kz', label: '🇰🇿 Kazakhstan' }, { code: 'ke', label: '🇰🇪 Kenya' },
  { code: 'kw', label: '🇰🇼 Kuwait' }, { code: 'kg', label: '🇰🇬 Kyrgyzstan' }, { code: 'la', label: '🇱🇦 Laos' }, { code: 'lv', label: '🇱🇻 Latvia' },
  { code: 'lb', label: '🇱🇧 Lebanon' }, { code: 'ls', label: '🇱🇸 Lesotho' }, { code: 'lr', label: '🇱🇷 Liberia' }, { code: 'ly', label: '🇱🇾 Libya' },
  { code: 'li', label: '🇱🇮 Liechtenstein' }, { code: 'lt', label: '🇱🇹 Lithuania' }, { code: 'lu', label: '🇱🇺 Luxembourg' }, { code: 'mo', label: '🇲🇴 Macao' },
  { code: 'mg', label: '🇲🇬 Madagascar' }, { code: 'mw', label: '🇲🇼 Malawi' }, { code: 'my', label: '🇲🇾 Malaysia' }, { code: 'mv', label: '🇲🇻 Maldives' },
  { code: 'ml', label: '🇲🇱 Mali' }, { code: 'mt', label: '🇲🇹 Malta' }, { code: 'mr', label: '🇲🇷 Mauritania' }, { code: 'mu', label: '🇲🇺 Mauritius' },
  { code: 'mx', label: '🇲🇽 Mexico' }, { code: 'md', label: '🇲🇩 Moldova' }, { code: 'mc', label: '🇲🇨 Monaco' }, { code: 'mn', label: '🇲🇳 Mongolia' },
  { code: 'me', label: '🇲🇪 Montenegro' }, { code: 'ma', label: '🇲🇦 Morocco' }, { code: 'mz', label: '🇲🇿 Mozambique' }, { code: 'mm', label: '🇲🇲 Myanmar' },
  { code: 'na', label: '🇳🇦 Namibia' }, { code: 'np', label: '🇳🇵 Nepal' }, { code: 'nl', label: '🇳🇱 Netherlands' }, { code: 'nz', label: '🇳🇿 New Zealand' },
  { code: 'ni', label: '🇳🇮 Nicaragua' }, { code: 'ne', label: '🇳🇪 Niger' }, { code: 'ng', label: '🇳🇬 Nigeria' }, { code: 'mk', label: '🇲🇰 North Macedonia' },
  { code: 'no', label: '🇳🇴 Norway' }, { code: 'om', label: '🇴🇲 Oman' }, { code: 'pk', label: '🇵🇰 Pakistan' }, { code: 'pa', label: '🇵🇦 Panama' },
  { code: 'pg', label: '🇵🇬 Papua New Guinea' }, { code: 'py', label: '🇵🇾 Paraguay' }, { code: 'pe', label: '🇵🇪 Peru' }, { code: 'ph', label: '🇵🇭 Philippines' },
  { code: 'pl', label: '🇵🇱 Poland' }, { code: 'pt', label: '🇵🇹 Portugal' }, { code: 'pr', label: '🇵🇷 Puerto Rico' }, { code: 'qa', label: '🇶🇦 Qatar' },
  { code: 'ro', label: '🇷🇴 Romania' }, { code: 'ru', label: '🇷🇺 Russia' }, { code: 'rw', label: '🇷🇼 Rwanda' }, { code: 'sa', label: '🇸🇦 Saudi Arabia' },
  { code: 'sn', label: '🇸🇳 Senegal' }, { code: 'rs', label: '🇷🇸 Serbia' }, { code: 'sc', label: '🇸🇨 Seychelles' }, { code: 'sl', label: '🇸🇱 Sierra Leone' },
  { code: 'sg', label: '🇸🇬 Singapore' }, { code: 'sk', label: '🇸🇰 Slovakia' }, { code: 'si', label: '🇸🇮 Slovenia' }, { code: 'so', label: '🇸🇴 Somalia' },
  { code: 'za', label: '🇿🇦 South Africa' }, { code: 'kr', label: '🇰🇷 South Korea' }, { code: 'ss', label: '🇸🇸 South Sudan' }, { code: 'es', label: '🇪🇸 Spain' },
  { code: 'lk', label: '🇱🇰 Sri Lanka' }, { code: 'sd', label: '🇸🇩 Sudan' }, { code: 'sr', label: '🇸🇷 Suriname' }, { code: 'se', label: '🇸🇪 Sweden' },
  { code: 'ch', label: '🇨🇭 Switzerland' }, { code: 'sy', label: '🇸🇾 Syria' }, { code: 'tw', label: '🇹🇼 Taiwan' }, { code: 'tj', label: '🇹🇯 Tajikistan' },
  { code: 'tz', label: '🇹🇿 Tanzania' }, { code: 'th', label: '🇹🇭 Thailand' }, { code: 'tg', label: '🇹🇬 Togo' }, { code: 'tt', label: '🇹🇹 Trinidad & Tobago' },
  { code: 'tn', label: '🇹🇳 Tunisia' }, { code: 'tr', label: '🇹🇷 Turkey' }, { code: 'tm', label: '🇹🇲 Turkmenistan' }, { code: 'ae', label: '🇦🇪 UAE' },
  { code: 'ug', label: '🇺🇬 Uganda' }, { code: 'ua', label: '🇺🇦 Ukraine' }, { code: 'gb', label: '🇬🇧 United Kingdom' }, { code: 'us', label: '🇺🇸 United States' },
  { code: 'uy', label: '🇺🇾 Uruguay' }, { code: 'uz', label: '🇺🇿 Uzbekistan' }, { code: 've', label: '🇻🇪 Venezuela' }, { code: 'vn', label: '🇻🇳 Vietnam' },
  { code: 'ye', label: '🇾🇪 Yemen' }, { code: 'zm', label: '🇿🇲 Zambia' }, { code: 'zw', label: '🇿🇼 Zimbabwe' }
]
const geoSearch = ref('')
const geoOptions = computed(() => {
  const q = geoSearch.value.trim().toLowerCase()
  if (!q) return GEO_ZONES
  return GEO_ZONES.filter(z => !z.code || z.label.toLowerCase().includes(q) || z.code.includes(q))
})
// Stage awaiting a field-sample response (LLM auto-suggest → resolve values to
// fill the list's sample column; also used for multi-page consolidation).
const pendingSampleStageIdx = ref(null)
// Live mirror of the target stage's _fields so the inline editor in
// the multi-field modal can iterate them without re-resolving
// wizPipeline.value[stageIdx] on every render.
const currentStageFields = computed(() => {
  const idx = pickerTargetStageIdx.value
  if (idx == null) return []
  const row = wizPipeline.value[idx]
  return (row && Array.isArray(row._fields)) ? row._fields : []
})
// Used by the inline "🪄 Suggest names" button INSIDE the modal —
// just forwards to the existing suggestFieldNames(stageIdx) action.
function suggestFieldNamesFromModal() {
  if (pickerTargetStageIdx.value == null) return
  suggestFieldNames(pickerTargetStageIdx.value)
}

// "✨ Relax selectors": send the picked field selectors (+ element HTML) to the
// LLM, which drops :nth-of-type / hashed classes and prefers semantic tags, so
// an article/field selector survives across detail pages. Explicit button (not
// auto on every pick). Re-paints the highlights so the user can review.
async function relaxFieldSelectors() {
  const idx = pickerTargetStageIdx.value
  if (idx == null) return
  const row = wizPipeline.value[idx]
  const fields = (row && Array.isArray(row._fields)) ? row._fields.filter(f => (f.selector || '').trim()) : []
  if (!fields.length) return
  relaxingFields.value = true
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/relax-selectors`, {
      method: 'POST',
      body: JSON.stringify({
        fields: fields.map(f => ({
          selector:   f.selector,
          sampleHtml: f._sampleHtml || null,
          label:      f.as || null,
        })),
      }),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || `relax failed: ${r.status}`)
    let changed = 0
    ;(Array.isArray(j.fields) ? j.fields : []).forEach(rf => {
      const tgt = fields.find(f => f.selector === rf.original)
      if (tgt && rf.selector && rf.selector !== rf.original) { tgt.selector = rf.selector; changed++ }
    })
    wizPipeline.value = [...wizPipeline.value]
    // Re-paint with the relaxed selectors so the user sees what they now match.
    const ifr = document.getElementById('wr-picker-iframe')
    if (ifr && ifr.contentWindow) {
      ifr.contentWindow.postMessage({
        type: 'webrobot-picker-multi-restore',
        fields: fields.map(f => ({ selector: f.selector, color: f._color || null, label: f.as || null, sampleText: f._sample || null })),
      }, '*')
    }
    wizStatus.value = { kind: changed ? 'info' : 'info', text: changed ? `Relaxed ${changed} selector(s) — review the highlight.` : 'Selectors already robust — nothing to relax.' }
  } catch (e) {
    wizStatus.value = { kind: 'error', text: 'Relax failed: ' + (e.message || e) }
  } finally {
    relaxingFields.value = false
  }
}
function removeFieldFromModal(fieldIdx) {
  if (pickerTargetStageIdx.value == null) return
  // Also clear the highlight on the iframe so the user sees the field
  // is gone — picker.js holds its own multiFields array we need to
  // sync. The simplest sync is to re-send the restore message with
  // the remaining fields after the local mutation.
  removeField(pickerTargetStageIdx.value, fieldIdx)
  const row = wizPipeline.value[pickerTargetStageIdx.value]
  const fields = (row && Array.isArray(row._fields)) ? row._fields.filter(f => (f.selector || '').trim()) : []
  const ifr = document.getElementById('wr-picker-iframe')
  try {
    ifr && ifr.contentWindow && ifr.contentWindow.postMessage({
      type: 'webrobot-picker-multi-restore',
      fields: fields.map(f => ({
        selector: f.selector,
        color:    f._color || null,
        label:    f.as || null,
        sampleText: f._sample || null,
      })),
    }, '*')
  } catch (_) {}
}
async function suggestFieldNames(stageIdx) {
  const row = wizPipeline.value[stageIdx]
  if (!row || !Array.isArray(row._fields) || !row._fields.length) return
  // Build the LLM-side items: drop empty selectors, keep a short
  // sample so the prompt stays compact (backend trims further to
  // 140 chars anyway).
  const items = row._fields
    .map((f, i) => ({ _idx: i, selector: (f.selector || '').trim(), sample: (f._sample || '').slice(0, 200) }))
    .filter(it => it.selector)
  if (!items.length) {
    wizStatus.value = { kind: 'error', text: 'Pick at least one field selector before naming.' }
    return
  }
  suggestNamesLoading.value = true
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/suggest-field-names`, {
      method: 'POST',
      body: JSON.stringify({
        items: items.map(it => ({ selector: it.selector, sample: it.sample })),
        stage_name: row.stage,
      }),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || 'suggest-field-names failed')
    const suggestions = Array.isArray(j.fields) ? j.fields : []
    if (!suggestions.length) {
      wizStatus.value = { kind: 'error', text: 'LLM returned no usable names — try again or rename manually.' }
      return
    }
    // Zip back by index. The backend preserves order, so suggestions[k]
    // corresponds to items[k] which carries _idx pointing at the
    // original row._fields slot.
    const next = row._fields.slice()
    suggestions.forEach((sg, k) => {
      const i = items[k] && items[k]._idx
      if (i == null) return
      next[i] = { ...next[i], as: sg.as || next[i].as }
    })
    row._fields = next
    wizPipeline.value = [...wizPipeline.value]
    wizStatus.value = { kind: 'ok', text: `🪄 Suggested ${suggestions.length} name${suggestions.length === 1 ? '' : 's'} for ${row.stage}.` }
  } catch (e) {
    wizStatus.value = { kind: 'error', text: 'Suggest-names: ' + (e.message || String(e)) }
  } finally {
    suggestNamesLoading.value = false
  }
}
function removeField(idx, fieldIdx) {
  const row = wizPipeline.value[idx]
  if (!row || !row._fields) return
  row._fields = row._fields.filter((_, i) => i !== fieldIdx)
  wizPipeline.value = [...wizPipeline.value]
}
function updateFieldProp(idx, fieldIdx, prop, value) {
  const row = wizPipeline.value[idx]
  if (!row || !row._fields || !row._fields[fieldIdx]) return
  row._fields[fieldIdx] = { ...row._fields[fieldIdx], [prop]: value }
  wizPipeline.value = [...wizPipeline.value]
}
// Distinct field names (`as`) produced by upstream extract / flatSelect /
// iextract stages ABOVE this one. Lets downstream stages that take a column
// name (sentiment.textField, aggregatesentiment.groupField, …) offer the
// already-defined fields instead of forcing the user to retype them.
function upstreamFieldNames(idx) {
  const out = []
  const seen = new Set()
  const pipe = wizPipeline.value || []
  const upTo = Math.min(idx, pipe.length)
  for (let i = 0; i < upTo; i++) {
    const row = pipe[i]
    if (!row) continue
    if (row.stage === 'extract' || row.stage === 'flatSelect' || row.stage === 'iextract') {
      for (const f of (row._fields || [])) {
        const nm = f && f.as ? String(f.as).trim() : ''
        if (nm && !seen.has(nm)) { seen.add(nm); out.push(nm) }
      }
    }
  }
  return out
}
// Does this stage arg reference a column/field name (vs a selector / literal)?
// Drives the field-name dropdown. Matches the catalog's field-name args
// (textField / groupField / *Field / *column) and descriptions that say so.
function isFieldNameArg(a) {
  if (!a || !a.name) return false
  const n = String(a.name).toLowerCase()
  if (n === 'textfield' || n === 'groupfield' || n === 'field' || n === 'column') return true
  if (n.endsWith('field') || n.endsWith('column')) return true
  const d = String(a.description || '').toLowerCase()
  return d.includes('field name') || d.includes('column name')
}
// Custom AttributeResolvers shipped by plugins. Dispatched by the runtime's
// ScalaDynamicExtractor on the registered NAME (AttributeResolverRegistry
// normalizes class names: `LLMResolver` → `llm`, `PriceResolver` → `price`).
// These are NOT Unstructured built-ins — they run plugin Scala/Python code
// per element. The registry lives in the Spark/ETL JVM, so the wizard (Jersey
// JVM) can't introspect it live; this is a curated mirror of what example-
// plugin always registers. When the resolver catalog moves to DB (mirroring
// etl_stage_specs — see project memory), swap this const for a fetched list.
const CUSTOM_ATTR_RESOLVERS = [
  { value: 'llm',   label: 'llm — LLM features (word/char count + summary)' },
  { value: 'price', label: 'price — parse numeric price from text' },
]
// Method dropdown options for a field: text/html + an `attr(<name>)` for every
// attribute actually present on the picked element (f._attrs, captured by the
// picker). Syntax is `attr(name)` — what NativeFlatSelectStage parses; other
// names fall through to the runtime's ScalaDynamicExtractor. Falls back to
// common attrs when the element's attrs are unknown (field added manually /
// not yet picked). Always includes the current method so a custom value stays
// selectable.
function fieldMethodOptions(f) {
  // Built-in extractor resolvers (Unstructured methods, dispatched by the
  // runtime's ScalaDynamicExtractor) + a `attr(<name>)` per real attribute on
  // the picked element. Values are the exact method strings the ETL expects;
  // labels are friendlier. No DB catalog — curated list.
  const opts = [
    { value: 'text',         label: 'text' },
    { value: 'ownText',      label: 'ownText (no children)' },
    { value: 'html',         label: 'html' },
    { value: 'boilerPipe',   label: 'boilerPipe (article text)' },
    { value: 'href',         label: 'href (link)' },
    { value: 'src',          label: 'src' },
    { value: 'code',         label: 'code (outerHTML)' },
    { value: 'breadcrumb',   label: 'breadcrumb' },
  ]
  const seen = new Set(opts.map(o => o.value))
  const attrs = Array.isArray(f && f._attrs) ? f._attrs : []
  const attrNames = attrs.length ? attrs : ['href', 'src', 'title', 'alt']
  for (const a of attrNames) {
    const v = 'attr(' + a + ')'
    if (!seen.has(v)) { opts.push({ value: v, label: v }); seen.add(v) }
  }
  // Plugin-provided custom resolvers (llm, price, …) — surfaced so the
  // operator can pick them, not just the Unstructured built-ins.
  for (const r of CUSTOM_ATTR_RESOLVERS) {
    if (!seen.has(r.value)) { opts.push({ value: r.value, label: '⚙ ' + r.label }); seen.add(r.value) }
  }
  // Keep a custom/typed method selectable.
  if (f && f.method && !seen.has(f.method)) opts.push({ value: f.method, label: f.method })
  return opts
}
function replaceFields(idx, newFields) {
  const row = wizPipeline.value[idx]
  if (!row) return
  row._fields = (newFields || []).map(f => ({
    selector: String(f.selector || ''),
    as: String(f.as || ''),
    method: String(f.method || 'text'),
  }))
  wizPipeline.value = [...wizPipeline.value]
}

// Open picker focused on filling a SINGLE field row's selector — both
// for extract.fields[i].selector and flatSelect.fields[i].selector.
function openFieldPicker(stageIdx, fieldIdx) {
  pickerTargetStageIdx.value = stageIdx
  pickerTargetArgName.value  = '__field_selector__:' + fieldIdx
  // Re-picking a SINGLE field on the already-loaded page → go straight to
  // selector-single (no navigate-first CTA; the page is already the right
  // one because the row/segment was just picked on it).
  pickerIntendedMode.value = null
  pickerMode.value = 'selector-single'
  pickerSelected.value = null
  pickerOpen.value = true
  tryResumePausedSession()
  // For flatSelect, the field selector MUST be relative to the row
  // segment — otherwise selector-single computes an absolute path that
  // includes the wrapper (ul.srp-results …) and the row :nth-of-type(N),
  // locking the field to a single row. Push the segment selector as the
  // picker's container so the single-pick path computes a row-relative
  // selector (same as the bulk "Pick fields" flow). For non-flatSelect
  // stages (extract on a detail page) we explicitly clear any stale
  // container so selectors stay page-absolute as intended.
  const row = wizPipeline.value[stageIdx]
  const segSel = row && row.stage === 'flatSelect' && row.args
    ? (row.args.segmentSelector || row.args.selector)
    : null
  setTimeout(() => {
    const ifr = document.getElementById('wr-picker-iframe')
    try {
      if (ifr && ifr.contentWindow) {
        ifr.contentWindow.postMessage(
          { type: 'webrobot-picker-multi-config', containerSelector: segSel || null }, '*')
      }
    } catch (_) {}
  }, 600)
}

// Open the picker in multi-field mode AND immediately prompt the
// user for the field-describing intent so the "🪄 Auto-suggest fields"
// flow becomes one click away from the wizard row. For flatSelect we
// need the segment_selector (container) set first; otherwise the
// LLM looks at the whole page and produces selectors that match the
// first row only. PTA-based auto-detection of the segment is the
// natural next step but isn't wired to the demo wizard yet.
async function openAiSuggestFields(stageIdx) {
  const row = wizPipeline.value[stageIdx]
  // For flatSelect we need a segment container before the LLM can
  // suggest field selectors relative to a row. If the user hasn't set
  // one yet, call PTA server-side (same script DirectExtractionApiV10
  // uses) to auto-detect it. If PTA isn't configured on the pod, fall
  // back to a clear error so the user knows to set the selector
  // manually.
  if (row && row.stage === 'flatSelect') {
    const hasContainer = row.args && typeof row.args.selector === 'string' && row.args.selector.trim()
    if (!hasContainer) {
      // Prefer the parked Camoufox tab's URL — that's the listing page
      // the user just navigated to in the previous stage's recorder.
      // Falls back to pickerUrl / row.args.url so the manual paths still
      // work when no session is parked.
      const url = (pickerUrl.value || '').trim()
        || (row.args && row.args.url)
        || (pausedCmfSession.value && pausedCmfSession.value.url)
        || (pickerLoadedUrl.value)
        || null
      if (!url) {
        wizStatus.value = { kind: 'error', text: 'flatSelect: set the URL or `selector` first.' }
        return
      }
      wizStatus.value = { kind: 'info', text: 'flatSelect: inferring segment container via PTA…' }
      try {
        const prompt = (aiIntent.value || '').trim() ||
          'each repeated item / card / row in the main listing on the page'
        // Send Camoufox-rendered HTML when available (anti-bot sites 403
        // the server-side bare wget — see /wizard/infer-segment endpoint).
        const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-segment`, {
          method: 'POST',
          body: JSON.stringify({ url, html: pickerHtml.value || null, segmentation_prompt: prompt }),
        })
        const j = await r.json()
        if (!r.ok || j.error || !j.segment_selector) {
          throw new Error(j.error || 'PTA could not find a repeating container')
        }
        updateStageArg(stageIdx, 'selector', j.segment_selector)
        wizStatus.value = { kind: 'ok', text: `flatSelect: PTA picked "${j.segment_selector}"` }
      } catch (e) {
        wizStatus.value = {
          kind: 'error',
          text: 'PTA segment inference failed: ' + (e.message || String(e))
            + ' — set the container selector manually via 🎯 Pick.',
        }
        return
      }
    }
  }
  openMultiFieldPicker(stageIdx)
  // Hand focus to the intent input in the picker once it's mounted.
  // 350 ms is enough for the modal CSS transition + iframe srcdoc.
  setTimeout(() => {
    const el = document.querySelector('.picker-multi input.text-input')
    try { el && el.focus() } catch (_) {}
  }, 350)
}

// Open picker in multi-field mode for batch field picking. When the
// stage is flatSelect with a segment selector already set, configure
// the picker to constrain clicks to descendants of that container.
function openMultiFieldPicker(stageIdx, opts) {
  const direct = !!(opts && opts.direct)
  pickerTargetStageIdx.value = stageIdx
  pickerTargetArgName.value  = '__fields_multi__'
  const row = wizPipeline.value[stageIdx]
  // NAVIGATE-FIRST (initial open from "🎯 Pick fields"): the detail/list
  // page may not be loaded yet. Land in pure-navigation (action-record, no
  // trace) so the user drives the mirror there, then the "📌 Start field
  // selection" CTA (or the 🎯 Select fields tab) arms field clicking.
  // enterFieldSelection() passes {direct:true} to skip this — the user has
  // already navigated and explicitly asked to start selecting.
  if (!direct) {
    pickerIntendedMode.value = 'multi-field'
    pickerMode.value = 'action-record'
    pickerStrategy.value = 'cmf'
    pickerOpen.value = true
    tryResumePausedSession()
    return
  }
  // Multi-field is the primary mode for "Pick fields" on BOTH:
  //   - flatSelect (list page): user picks N field selectors RELATIVE to
  //     the segment container, applied per-row at runtime.
  //   - extract   (detail page): user picks N field selectors on the
  //     current page, each becomes a row in row._fields.
  //
  // In both cases the user has already navigated to the target page
  // before clicking "Pick fields" — they shouldn't need to "promote"
  // via a navigate-first CTA. Land directly in multi-field mode.
  //
  // The container-selector config (flatSelect-only) drives selector
  // computeSelectorRelativeTo + per-row highlight; for extract we
  // skip that so selectors are absolute / page-rooted.
  pickerIntendedMode.value = null
  pickerMode.value = 'multi-field'
  pickerOpen.value = true
  tryResumePausedSession()
  const segSel = row && row.stage === 'flatSelect' && row.args
    ? (row.args.segmentSelector || row.args.selector)
    : null
  setTimeout(() => {
    const ifr = document.getElementById('wr-picker-iframe')
    try {
      if (ifr && ifr.contentWindow) {
        // Push the mode FIRST so picker.js knows we're in multi-field
        // when it processes the container config + the first clicks.
        ifr.contentWindow.postMessage({ type: 'webrobot-picker-mode', mode: 'multi-field', linkMode: false }, '*')
        if (segSel) {
          // flatSelect-only: confine clicks to descendants of one
          // segment match and produce RELATIVE field selectors.
          ifr.contentWindow.postMessage({ type: 'webrobot-picker-multi-config', containerSelector: segSel }, '*')
        } else {
          // extract: clear any stale container so selectors are absolute.
          ifr.contentWindow.postMessage({ type: 'webrobot-picker-multi-config', containerSelector: null }, '*')
        }
        // Re-paint the fields ALREADY saved on this stage. Without this,
        // re-entering "Select fields" (enterFieldSelection / re-edit) shows
        // the field LIST in the sidebar but no on-page highlight, because the
        // picker-ready restore only fires on a fresh iframe load — not when the
        // user re-arms field selection on an already-loaded mirror.
        const seeds = (row && Array.isArray(row._fields))
          ? row._fields.filter(f => (f.selector || '').trim()) : []
        if (seeds.length) {
          ifr.contentWindow.postMessage({
            type: 'webrobot-picker-multi-restore',
            fields: seeds.map(f => ({
              selector:   f.selector,
              color:      f._color || null,
              label:      f.as || null,
              sampleText: f._sample || null,
            })),
          }, '*')
        }
      }
    } catch (_) {}
  }, 600)
}

// Explicit "🎯 Select fields" tab (flatSelect / extract). The picker may
// have opened on the wrong page, or the user just navigated/paginated via
// ⏺ Record actions; this arms field selection on the CURRENT mirror page
// without tearing down the live Camoufox session. Reuses
// openMultiFieldPicker so flatSelect keeps its segment-relative container
// config and extract stays page-rooted. No-op if we lost the target row.
function enterFieldSelection() {
  const idx = pickerTargetStageIdx.value
  if (idx == null || !wizPipeline.value[idx]) return
  openMultiFieldPicker(idx, { direct: true })
}

// Open picker in action-record mode tied to a specific stage row.
// When the recording is collected we route the action list to
// row._trace (instead of letting the user copy YAML manually).
function openTraceRecorder(stageIdx) {
  pickerTargetStageIdx.value = stageIdx
  pickerTargetArgName.value  = '__stage_trace__'
  pickerMode.value = 'action-record'
  // Pre-select the stage in the post-Send "Apply trace to" dropdown
  // so the user only has to click Apply once the trace is committed.
  // Falls back to whatever the dropdown decides if the stage isn't
  // trace-capable (e.g. trace recorder opened from an extract row).
  if (isTraceCapableStage(wizPipeline.value[stageIdx]?.stage)) {
    applyTraceStageIdx.value = stageIdx
  }
  pickerOpen.value = true
  tryResumePausedSession()
}

// Stages whose YAML accepts a `trace:` block — confirmed by reading
// etl_stage_specs.usage_guide ("optional `trace` (sequence of
// actions)" in the doc for each). NOTE: `visit` is intentionally
// EXCLUDED — it's not a distinct trace target, it's syntactic sugar
// for `fetch` whose trace starts with `visit` (browser mode), so the
// trace always belongs to a fetch stage in the YAML. intelligentExplore
// uses a different per-action `traceAction` arg (a single action name
// string, not a block), so it's NOT in this set. wget is HTTP-only
// and can't replay browser actions either.
const TRACE_CAPABLE_STAGES = new Set(['fetch', 'explore', 'join'])
function isTraceCapableStage(name) { return TRACE_CAPABLE_STAGES.has(name) }

// flatSelect needs a row/segment selector populated BEFORE the user
// can pick fields — field selectors are relative to each row. extract
// (single-row scope) doesn't carry this constraint and reports ready
// regardless. Other structured-fields stages: be permissive (return
// true) so we don't gate them by accident.
function flatSelectSegmentArgName(row) {
  if (!row || row.stage !== 'flatSelect') return null
  // The flatSelect spec uses `segmentSelector`; older specs / yaml
  // fixtures fall back to `selector`. Accept either as the row anchor.
  return (row.args && row.args.segmentSelector != null) ? 'segmentSelector' : 'selector'
}
function flatSelectSegmentReady(row) {
  if (!row) return false
  if (row.stage !== 'flatSelect') return true
  const seg = row.args && (row.args.segmentSelector || row.args.selector)
  return seg != null && String(seg).trim() !== ''
}

// Picker-toolbar gating: hide selector tabs (Single / List / Repeating /
// AI Magic) when the picker was opened from a stage whose primary work
// is navigation rather than CSS selection.
//
// Only `fetch` remains here — pure navigation, no selectors. explore
// + join families ALSO need selector tabs (List / Pick samples for
// the link/segment selector) PLUS Record actions (optional trace to
// drive the page through filters / pagination before extracting), so
// they're handled by per-stage computeds below, NOT by this set.
const TOOLBAR_ONLY_RECORD_STAGES = new Set([
  'fetch',
])
// fetch-only: pure navigation stage. Record actions is the only useful
// mode in the picker; selector tabs would be dead UI.
const pickerOriginIsFetch = computed(() => pickerOriginStage.value === 'fetch')
// True while the picker is being used to select FIELDS (not the row
// selector): either the bulk "🎯 Pick fields" (__fields_multi__) or
// the per-field 🎯 (__field_selector__:N). In this phase the row /
// segment selector is ALREADY fixed, so the row-selecting tabs
// (📋 List · 📍 Pick samples) make no sense — they'd re-pick the row
// and switch the picker out of the field-relative mode. Only field-
// relevant tools belong here (the in-page multi-field clicking + Ask
// AI to describe fields).
const pickerIsFieldSelection = computed(() => {
  const t = pickerTargetArgName.value
  return typeof t === 'string' &&
    (t === '__fields_multi__' || t.indexOf('__field_selector__:') === 0)
})
const pickerOriginIsTraceCapable = computed(() => {
  const idx = pickerTargetStageIdx.value
  if (idx == null || !wizPipeline.value[idx]) return false
  return TOOLBAR_ONLY_RECORD_STAGES.has(wizPipeline.value[idx].stage)
})
// Stage name of the picker origin, or null. Drives per-stage tab
// visibility — different stage families need different selector modes.
const pickerOriginStage = computed(() => {
  const idx = pickerTargetStageIdx.value
  if (idx == null || !wizPipeline.value[idx]) return null
  return wizPipeline.value[idx].stage || null
})
// flatSelect: 2-step flow (segment selector first, then per-field
// selectors). The user picks the row via "Repeating" sampling, then
// uses the dedicated "Pick fields" / "AI suggest" buttons. Single +
// Record actions are NOT useful here.
const pickerOriginIsFlatSelect = computed(() => pickerOriginStage.value === 'flatSelect')
// extract: per-field selectors. Bulk picking via the "🎯 Pick fields"
// button on the stage row (multi-field mode); the picker toolbar only
// surfaces "🪄 Ask AI" as a tab (the selector-single mode used for
// per-arg fine-tuning is reachable via the small 🎯 icon next to a
// single arg input, programmatically — not as a tab choice).
const pickerOriginIsExtract = computed(() => pickerOriginStage.value === 'extract')
// Gate for the in-picker "🎯 Select fields" tab. extract can arm field
// selection on any page; flatSelect needs its row/segment selector set
// FIRST (field selectors are captured relative to it — picking before
// produces selectors that don't resolve at runtime).
const fieldSelectionReady = computed(() => {
  const idx = pickerTargetStageIdx.value
  if (idx == null || !wizPipeline.value[idx]) return false
  const row = wizPipeline.value[idx]
  if (row.stage === 'flatSelect') return flatSelectSegmentReady(row)
  return true
})
// iextract: natural-language prompt only — the stage takes a `prefix`
// + a free-text intent. No CSS selectors are clicked here, the picker
// only exposes "🪄 Ask AI" so the LLM can help draft / refine the
// prompt. Kept separate from extract because their UX is different
// even though they look similar in the catalog.
const pickerOriginIsIextract = computed(() => pickerOriginStage.value === 'iextract')
// explore family: every variant picks a repeating link/card selector
// to follow. Tabs: List + Pick samples + optional Record actions.
// Variants are aliases / strategy-specific implementations — same
// picker UX for all of them.
const pickerOriginIsExplore = computed(() => {
  const s = pickerOriginStage.value
  return s === 'explore'
      || s === 'wgetExplore'
      || s === 'visitExplore'
      || s === 'intelligentExplore'
      || s === 'intelligentWgetExplore'
})
// join family: same shape as explore — pick a link selector to
// follow + (optionally) record a trace to drive the page before
// extracting. Variants ('join' is the generic base, 'wgetJoin' /
// 'visitJoin' bind a fetch strategy, 'intelligentJoin' /
// 'intelligentWgetJoin' add LLM nav inference). Same picker UX for
// all of them — List + Pick samples + Record + Ask AI.
const pickerOriginIsJoin = computed(() => {
  const s = pickerOriginStage.value
  return s === 'join'
      || s === 'wgetJoin'
      || s === 'visitJoin'
      || s === 'intelligentJoin'
      || s === 'intelligentWgetJoin'
})
// visitExplore / visitJoin: you pick the link-to-follow as a SELECTOR; the
// browser-visit transport is fixed, so there is NO per-stage action trace to
// record → hide "⏺ Record actions" for these. (Generic explore/join keep it —
// they default to a visit/wget transport that the trace can drive.)
const pickerOriginIsVisitDrill = computed(() =>
  pickerOriginStage.value === 'visitExplore' || pickerOriginStage.value === 'visitJoin')
const tracableStages = computed(() => {
  return wizPipeline.value
    .map((row, idx) => ({ idx, stage: row.stage }))
    .filter(s => isTraceCapableStage(s.stage))
})

// "Apply this trace to <selected stage>" — uses committedActions
// (post-send), not the live staged queue. Called from the panel that
// only appears AFTER a successful Send round-trip.
//
// Side effect: if the target stage's first positional arg (the URL
// for fetch/visit) is still empty, seed it with the URL the picker
// opened on. Without this the YAML emits `args: []` and the runtime
// has nowhere to navigate before replaying the trace.
function applyCommittedTrace() {
  const idx = applyTraceStageIdx.value
  if (idx == null || !wizPipeline.value[idx]) return
  // Require AT LEAST one of: committed actions (full trace apply) or a
  // loaded picker URL (URL-only apply). The bare empty case shouldn't
  // happen because the panel is hidden when both are absent.
  if (!committedActions.value.length && !pickerOpenedUrl.value) return
  const row = wizPipeline.value[idx]
  // Only overwrite the stage trace when we actually have new actions to
  // commit — opening the picker just to retarget the URL must not blow
  // away an existing trace the user spent time building earlier.
  //
  // Filter same as the /cmf/step send: in non-captcha mode keep only
  // Click / Type / Scroll (the YAML emitter set). In captcha mode keep
  // everything (raw mouse + keys + Hover all needed for HITL replay
  // against the CMP fingerprint). Defensive — the send-time filter in
  // sendStagedActionsToCamoufox already prevents non-trace events from
  // landing in committedActions in non-captcha mode, but if the user
  // mixed a captcha-era session with a normal one, we still strip the
  // leftover raw events here so the saved row._trace stays clean.
  if (committedActions.value.length) {
    if (antiBotDetected.value) {
      row._trace = committedActions.value.slice()
    } else {
      const traceTypes = new Set(['Click', 'Type', 'Scroll'])
      row._trace = committedActions.value.filter(a => a && a.type && traceTypes.has(a.type))
    }
  }
  const spec = findStageSpec(row.stage)
  const firstArg = (spec && spec.arg_schema || [])[0]
  if (firstArg) {
    if (!row.args) row.args = {}
    // URL to seed the stage's first arg depends on what the user did:
    //
    //   - Trace recorded (Click/Type/Scroll): the trace MUST replay
    //     from the ORIGINAL URL the picker opened on, because each
    //     action references DOM state of that seed page. So:
    //       args[url] = pickerOpenedUrl   (immutable opened URL)
    //
    //   - No trace recorded (URL-only apply): the user navigated the
    //     mirror to whatever final page they care about, then pressed
    //     "✅ Use this URL". Save the FINAL URL — they want that page
    //     fetched directly, no actions needed:
    //       args[url] = pickerLoadedUrl   (current URL after nav)
    //
    // Always overwrite — the user pressing Apply is an explicit
    // intent to set this URL, regardless of any previous value. The
    // earlier "only if empty" guard caused the field to stay stale
    // after recording a trace on a stage with a pre-seeded URL.
    const targetUrl = committedActions.value.length
      ? pickerOpenedUrl.value
      : (pickerLoadedUrl.value || pickerOpenedUrl.value)
    if (targetUrl) {
      row.args[firstArg.name] = targetUrl
    }
  }
  wizPipeline.value = [...wizPipeline.value]
  const seededUrl = firstArg && row.args && row.args[firstArg.name]
  const urlNote = seededUrl ? ` — ${firstArg.name}=${seededUrl}` : ''
  const traceNote = committedActions.value.length
    ? `Trace (${committedActions.value.length} actions) applied`
    : `URL applied (no actions recorded)`
  wizStatus.value = { kind: 'ok', text: `${traceNote} to ${row.stage} (stage ${idx + 1})${urlNote}.` }
  // Close the modal — the trace is saved on the stage row, picker job
  // is done. closePicker() also DELETE's the Camoufox session; the
  // sibling "💾 Apply & keep session for next stage →" is the path
  // that preserves it instead.
  closePicker()
}

// Legacy hook from openTraceRecorder — keep but route through the new
// committed-action store so the behaviour matches what the new
// dropdown applies.
function applyRecordingToStageTrace() {
  if (pickerTargetStageIdx.value == null) return
  const idx = pickerTargetStageIdx.value
  const src = committedActions.value.length ? committedActions.value : pickerActions.value
  wizPipeline.value[idx]._trace = src.slice()
  wizPipeline.value = [...wizPipeline.value]
  closePicker()
}

// Save the recorded trace to the target stage AND park the live
// Camoufox tab so the user can reopen the picker later (next stage)
// and resume from the same page. closePicker() would DELETE the
// session — explicitly avoid that. The paused session lives in
// pausedCmfSession; the resume banner picks it up.
function applyRecordingAndPauseSession() {
  if (pickerStrategy.value !== 'cmf' || !cmfSessionId.value) {
    // Defensive: nothing to keep — fall back to the normal apply.
    applyRecordingToStageTrace()
    return
  }
  // Prefer the committed log (post-send actions) — that's what really
  // shaped the parked page; staged queue is a draft.
  const src = committedActions.value.length ? committedActions.value : pickerActions.value
  const idx = pickerTargetStageIdx.value != null
    ? pickerTargetStageIdx.value
    : (applyTraceStageIdx.value != null ? applyTraceStageIdx.value : null)
  if (idx == null) {
    wizStatus.value = { kind: 'error', text: 'Pick the target stage in the Apply panel first.' }
    return
  }
  const targetRow = wizPipeline.value[idx]
  targetRow._trace = src.slice()
  // Same URL-seeding logic as applyCommittedTrace — keep them in sync.
  const spec = findStageSpec(targetRow.stage)
  const firstArg = (spec && spec.arg_schema || [])[0]
  if (firstArg && pickerOpenedUrl.value) {
    if (!targetRow.args) targetRow.args = {}
    const current = targetRow.args[firstArg.name]
    if (current == null || String(current).trim() === '') {
      targetRow.args[firstArg.name] = pickerOpenedUrl.value
    }
  }
  wizPipeline.value = [...wizPipeline.value]
  pausedCmfSession.value = {
    sessionId: cmfSessionId.value,
    html:      pickerHtml.value,
    url:       pickerLoadedUrl.value,
    savedAt:   Date.now(),
  }
  // Tear down modal state WITHOUT the closePicker() DELETE.
  pickerOpen.value          = false
  pickerLoadedUrl.value     = null
  pickerSelected.value      = null
  pickerActions.value       = []
  committedActions.value    = []
  pickerTargetStageIdx.value = null
  pickerTargetArgName.value  = null
  pickerHtml.value          = ''
  cmfSessionId.value        = null   // ref only — server session stays alive
  wizStatus.value = {
    kind: 'ok',
    text: 'Trace saved. Camoufox session parked — reopen the picker to resume on the same page.',
  }
}

// Rebind the modal to the previously parked session: pretend /cmf/open
// just returned, no network call. The 5-min idle reaper on the server
// will reclaim it if the user takes too long.
function resumePausedSession() {
  const p = pausedCmfSession.value
  if (!p) return
  pickerStrategy.value  = 'cmf'
  cmfSessionId.value    = p.sessionId
  pickerHtml.value      = p.html
  pickerLoadedUrl.value = p.url
  pickerLoadError.value = null
  pausedCmfSession.value = null
  cmfReloadKey.value++   // refresh iframe :src so it reattaches to the parked session
}

// User wants a fresh start instead — release the server-side session
// and clear the banner.
async function discardPausedSession() {
  const p = pausedCmfSession.value
  if (!p) return
  pausedCmfSession.value = null
  try {
    await authenticatedDemoFetch(
      `${API_BASE_URL}/api/webrobot/api/demo/wizard/cmf/${p.sessionId}`,
      { method: 'DELETE' }
    )
  } catch (_) { /* idle reaper will handle it */ }
}
function yamlScalar(v) {
  if (typeof v === 'number') return String(v)
  const s = String(v)
  if (/^-?\d+(\.\d+)?$/.test(s)) return s
  if (/^(true|false)$/i.test(s)) return s.toLowerCase()
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}
// Stages that NativeFetchStage / NativeVisitStage / NativeWgetStage
// accept a trace for. The Scala parser expects the trace as the
// SECOND positional arg of `args:`, not a sibling `trace:` block —
// see NativeFetchStage.scala in the ETL runtime.
const FETCH_LIKE_STAGES = new Set(['fetch', 'visit', 'wget'])

// Convert the wizard's internal trace action objects
// ({type, selector, text, ms, y, …}) into the action-map shape the
// runtime's ActionFactoryRegistry can consume:
//   { action: "click",  selector: "..." }
//   { action: "input",  selector: "...", text: "..." }
//   { action: "wait",   seconds: 1.0 }
//   { action: "scroll", direction: "down", pixels: 600 }
// Names match the actionName field of CustomActionFactories (ETL).
function traceActionToYamlMap(a) {
  if (!a || !a.type) return null
  if (a.type === 'Click'  && a.selector) {
    return `{ action: "click", selector: ${yamlScalar(a.selector)} }`
  }
  if (a.type === 'Type'   && a.selector) {
    return `{ action: "input", selector: ${yamlScalar(a.selector)}, text: ${yamlScalar(a.text || '')} }`
  }
  if (a.type === 'Wait') {
    const seconds = ((a.ms != null ? Number(a.ms) : 1000) / 1000)
    return `{ action: "wait", seconds: ${seconds} }`
  }
  if (a.type === 'Scroll') {
    const pixels = Math.abs(Number(a.y || 600))
    const direction = (Number(a.y || 0) < 0) ? 'up' : 'down'
    return `{ action: "scroll", direction: "${direction}", pixels: ${pixels} }`
  }
  return null
}

// Emit the embedded trace as the second positional `args` entry
// (a nested list of action maps). Called from inside the args:
// block for fetch / visit / wget stages.
function emitEmbeddedTraceActions(row, lines, indent) {
  const t = Array.isArray(row._trace) ? row._trace : []
  const entries = t.map(traceActionToYamlMap).filter(Boolean)
  if (entries.length === 0) return false
  lines.push(`${indent}-`)
  for (const e of entries) lines.push(`${indent}  - ${e}`)
  return true
}

function buildYamlFromPipeline(pipeline, catalog) {
  if (!pipeline || pipeline.length === 0) return '(add at least one stage)'
  const findSpec = (n) => catalog.find(s => s.stage_name === n || (s.aliases || []).includes(n))
  const lines = []
  // Python extensions: split into the two backend-recognized shapes:
  //   1. row_transform / dataframe_transform → top-level python_extensions
  //      block, KEY = function name (MAP, not LIST), with `function:` as
  //      the field carrying the FULL `def NAME(args): …` source (the
  //      runtime's extractFunctionBodyFromCrewAI strips the def header).
  //   2. sql_query → first-class pipeline stage at the end of pipeline[]
  //      with the SQL string as args[0]. NOT a python_extension.
  // See PySparkCodeGenerator.processPythonExtensions for the canonical
  // schema this targets.
  const allExts = (wizPythonExtensions.value || [])
    .filter(e => (e.name || '').trim() && (e.functionBody || '').trim())
  const pyExts  = allExts.filter(e => e.type === 'row_transform' || e.type === 'dataframe_transform')
  const sqlExts = allExts.filter(e => e.type === 'sql_query')
  if (pyExts.length) {
    lines.push('python_extensions:')
    lines.push('  stages:')
    for (const ext of pyExts) {
      const argSig = ext.type === 'dataframe_transform' ? 'df, spark' : 'row'
      lines.push(`    ${ext.name}:`)
      lines.push(`      type: ${ext.type}`)
      // `function:` field MUST contain the full def header — the runtime
      // (PySparkCodeGenerator) extracts the body from it. Auto-prepend
      // `def NAME(args):` so the user only has to type the body in the
      // textarea while the YAML stays canonical.
      lines.push('      function: |')
      lines.push(`        def ${ext.name}(${argSig}):`)
      for (const ln of String(ext.functionBody).split('\n')) {
        lines.push('            ' + ln)
      }
    }
  }
  lines.push('pipeline:')
  for (const row of pipeline) {
    // ── Structured stages: extract + flatSelect ────────────────
    // extract.args = list of {selector, as, method}
    // flatSelect.args = [segmentSelector, [{selector, as, method}, …]]
    const fields = Array.isArray(row._fields) ? row._fields.filter(f => (f.selector || '').trim() !== '') : []

    // AUTO-DECISION (generator-side): the user builds a flatSelect, but if ANY
    // field was picked OUTSIDE the segment (a parallel sibling list with no
    // common per-row wrapper — e.g. avatar block + comment body), the rows are
    // SPLIT, so flatSelect can't group them. Emit parallelSelect instead:
    // page-rooted columns zipped BY INDEX (cardinality join). The user never
    // had to choose the stage.
    const flatSplit = row.stage === 'flatSelect' && fields.some(f => f._parallel)
    lines.push(`  - stage: ${flatSplit ? 'parallelSelect' : row.stage}`)

    if (flatSplit) {
      const seg = (row.args && (row.args.segmentSelector || row.args.selector)) || ''
      lines.push('    # auto: rows split across parallel sibling lists → parallelSelect (zipped by index)')
      lines.push('    args:')
      lines.push('      -')
      for (const f of fields) {
        // parallel fields carry a page-rooted selector already; in-segment
        // fields are relative → compose with the segment so all columns are
        // page-rooted repeating selectors of equal cardinality.
        const sel = f._parallel ? f.selector : (seg ? `${seg} ${f.selector}` : f.selector)
        lines.push(`        - { selector: ${yamlScalar(sel)}, method: ${yamlScalar(f.method || 'text')}, as: ${yamlScalar(f.as || '')} }`)
      }
      continue
    }

    if (row.stage === 'extract') {
      if (fields.length === 0) {
        lines.push('    args: []')
      } else {
        lines.push('    args:')
        for (const f of fields) {
          lines.push(`      - { selector: ${yamlScalar(f.selector)}, method: ${yamlScalar(f.method || 'text')}, as: ${yamlScalar(f.as || '')} }`)
        }
      }
      // (no trace concept for extract)
      continue
    }
    if (row.stage === 'flatSelect') {
      // Catalog calls the first arg `segmentSelector`; the wizard
      // internals (PTA flow, picker target) historically wrote it as
      // `selector`. Read both, prefer the catalog name when present so
      // we honor a user edit on the catalog-driven input row.
      const seg = (row.args && (row.args.segmentSelector || row.args.selector)) || ''
      lines.push('    args:')
      lines.push(`      - ${yamlScalar(seg)}    # segment selector`)
      if (fields.length === 0) {
        lines.push('      - []    # extractors (empty)')
      } else {
        lines.push('      -')
        for (const f of fields) {
          lines.push(`        - { selector: ${yamlScalar(f.selector)}, method: ${yamlScalar(f.method || 'text')}, as: ${yamlScalar(f.as || '')} }`)
        }
      }
      // flatSelect doesn't fetch — trace is meaningless on it; drop.
      continue
    }

    // ── oddsSelect: deterministic multi-market odds extractor ─────
    // args is a single config map { markets:[…], enabled?:[…] }. The
    // ticked-subset is expressed by emitting ONLY enabled markets (the
    // checkbox IS the subset selector); each market carries its own
    // section/row/field selectors and an explicit label → market_type.
    if (row.stage === 'oddsSelect' || row.stage === 'odds_select') {
      const markets = (Array.isArray(row._markets) ? row._markets : [])
        .filter(m => m && m.enabled !== false)
        .filter(m => (m.sectionSelector || '').trim() &&
                     Array.isArray(m.fields) &&
                     m.fields.some(f => (f.selector || '').trim()))
      if (markets.length === 0) {
        lines.push('    args: []    # no enabled market with a section + fields yet')
        continue
      }
      lines.push('    args:')
      lines.push('      - markets:')
      markets.forEach((m, mi) => {
        const label = (m.label || '').trim() || `Market ${mi + 1}`
        lines.push(`          - label: ${yamlScalar(label)}`)
        lines.push(`            sectionSelector: ${yamlScalar(m.sectionSelector)}`)
        if ((m.rowSelector || '').trim()) {
          lines.push(`            rowSelector: ${yamlScalar(m.rowSelector)}`)
        }
        lines.push('            fields:')
        for (const f of m.fields.filter(f => (f.selector || '').trim())) {
          lines.push(`              - { selector: ${yamlScalar(f.selector)}, method: ${yamlScalar(f.method || 'text')}, as: ${yamlScalar(f.as || 'field')} }`)
        }
      })
      continue
    }

    // ── Generic stages: positional args from catalog arg_schema ───
    const spec = findSpec(row.stage)
    const orderedArgNames = (spec && spec.arg_schema || []).map(a => a.name)
    const filled = []
    for (const n of orderedArgNames) {
      if (row.args[n] != null && row.args[n] !== '') filled.push([n, row.args[n]])
    }
    const isFetchLike = FETCH_LIKE_STAGES.has(row.stage)
    const traceLen = isFetchLike && Array.isArray(row._trace) ? row._trace.length : 0
    if (filled.length === 0 && traceLen === 0) {
      lines.push('    args: []')
    } else {
      lines.push('    args:')
      for (const [n, v] of filled) lines.push(`      - ${yamlScalar(v)}    # ${n}`)
      // For fetch/visit/wget the runtime reads the trace as args[1]
      // (a list of {action, selector, ...} maps) — not as a sibling
      // trace: block. See NativeFetchStage.scala in the ETL runtime.
      if (isFetchLike && traceLen > 0) {
        emitEmbeddedTraceActions(row, lines, '      ')
      }
    }
  }
  // Python post-processing references: appended at the END of the
  // pipeline[] block in declaration order. row_transform / dataframe_transform
  // entries get a `python_<type>:<name>` shim stage; sql_query entries
  // get a first-class `sql_query` stage with the SQL as args[0].
  for (const ext of pyExts) {
    lines.push(`  - stage: python_${ext.type}:${ext.name}`)
    lines.push('    args: []')
  }
  for (const ext of sqlExts) {
    lines.push('  - stage: sql_query')
    lines.push('    args:')
    // Literal block style so multi-line SQL survives unchanged.
    lines.push('      - |')
    for (const ln of String(ext.functionBody).split('\n')) lines.push('        ' + ln)
  }
  lines.push('output:')
  lines.push('  format: parquet')
  lines.push('  mode: overwrite')
  // Pipeline-level metadata. requires_hitl marks the trace as needing
  // human-in-the-loop captcha resolution at replay. We emit it ONLY when
  // the HITL checkbox is actually on — the flag is the single source of
  // truth. Anti-bot detection during recording auto-checks the box, so a
  // genuine challenge still gets the metadata; but if the operator
  // unchecks it (e.g. a false-positive trip on a plain forum), we must
  // NOT leak requires_hitl/anti_bot_kinds into the YAML and silently
  // force pause-on-captcha at submit.
  const metaLines = []
  // Pipeline-level execution runtime (spark job vs ray actor). Emitted only
  // when non-default; metadata only for now — the executor reads it (Phase-4
  // elastic Ray). Default 'spark' is implicit, so we omit it to keep YAML clean.
  if (wizRuntime.value && wizRuntime.value !== 'spark') {
    metaLines.push(`  runtime: ${yamlScalar(wizRuntime.value)}`)
  }
  // Preferential geo zone → residential proxy pinned to this country
  // (DataImpulse __cr.<cc>). Omitted when empty (global rotating proxy).
  if (wizGeo.value && /^[a-z]{2}$/i.test(wizGeo.value)) {
    metaLines.push(`  geo: ${yamlScalar(wizGeo.value.toLowerCase())}`)
  }
  if (hitlAwait.value && pipeline.some(r => r && r._requires_hitl)) {
    metaLines.push('  requires_hitl: true')
    const kinds = pipeline
      .map(r => r && r._anti_bot_kind).filter(k => k)
    if (kinds.length) metaLines.push(`  anti_bot_kinds: [${kinds.map(yamlScalar).join(', ')}]`)
  }
  if (metaLines.length) {
    lines.push('metadata:')
    for (const ml of metaLines) lines.push(ml)
  }
  return lines.join('\n')
}

async function wizardSuggestFromIntent() {
  const intent = wizIntent.value.trim()
  if (!intent) {
    wizSuggesterError.value = 'Describe what you want to build (intent box above).'
    return
  }
  wizSuggesterLoading.value = true
  wizSuggesterError.value = null
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/suggest`, {
      method: 'POST',
      body: JSON.stringify({ intent }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'suggest failed')
    if (j.error) {
      wizSuggesterError.value = j.error
      wizSuggested.value = []
    } else {
      wizSuggested.value = j.suggested || []
      if (wizSuggested.value.length === 0) {
        wizSuggesterError.value = 'LLM did not return any usable stage names. Try a clearer intent.'
      }
    }
  } catch (e) {
    wizSuggesterError.value = 'Error: ' + (e.message || String(e))
    wizSuggested.value = []
  } finally {
    wizSuggesterLoading.value = false
  }
}

function addAllSuggested() {
  for (const name of wizSuggested.value) {
    addStageToPipeline(name)
  }
}

async function loadStageCatalog() {
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/catalog/stages`)
    if (!r.ok) throw new Error('catalog fetch failed: ' + r.status)
    const j = await r.json()
    wizCatalog.value = j.data || []
  } catch (e) {
    console.warn('wiz catalog load failed:', e)
  }
}

// Client-side validation. Reasons: surface missing required args before
// hitting Spark (where the error message is opaque), and gate the Save
// & Run button. Wizard never tries to "guess" defaults — if the catalog
// says required, the user must fill it.
const wizValidationErrors = computed(() => {
  const errs = []
  if (wizPipelineName.value.trim() === '') errs.push('Pipeline name is required.')
  if (wizPipeline.value.length === 0) errs.push('Add at least one stage.')
  // Structured stages keep their field list outside row.args (in
  // row._fields), so the generic "row.args[name] empty?" check would
  // always fail on them. List the arg names whose value actually comes
  // from _fields so we can route the requirement check separately.
  const FIELDS_ARG_ALIASES = new Set(['extractors', 'fields', 'columns'])
  // Some catalog arg names diverge from the internal storage key the
  // wizard writes via updateStageArg / the picker. Map them so the
  // generic check resolves to the right slot (instead of false-positiving
  // on a name the UI never populates). When you find a NEW divergence,
  // add the catalog name here — don't rename the wizard internals.
  const ARG_NAME_ALIASES = new Map([
    // flatSelect's first arg in the catalog is "segmentSelector" but the
    // picker writes to row.args.selector (riga 3514, updateStageArg ..., 'selector', ...).
    ['segmentSelector', 'selector'],
  ])
  const argSlot = (row, argName) => {
    if (row.args[argName] != null) return row.args[argName]
    const alias = ARG_NAME_ALIASES.get(argName)
    return alias ? row.args[alias] : undefined
  }
  for (let i = 0; i < wizPipeline.value.length; i++) {
    const row = wizPipeline.value[i]
    const spec = findStageSpec(row.stage)
    if (!spec) {
      errs.push(`Stage #${i + 1} "${row.stage}" is not in the live catalog.`)
      continue
    }
    const structuredFields = Array.isArray(row._fields)
      ? row._fields.filter(f => (f && f.selector || '').trim() !== '')
      : []
    for (const a of (spec.arg_schema || [])) {
      if (!a.required) continue
      // Field-list args (extract/flatSelect) — the wizard stores these
      // under row._fields. Require at least one row with a selector.
      if (FIELDS_ARG_ALIASES.has(a.name)) {
        if (structuredFields.length === 0) {
          errs.push(`Stage #${i + 1} "${row.stage}": pick at least one field (🎯 in the Fields panel).`)
        }
        continue
      }
      const v = argSlot(row, a.name)
      if (v == null || String(v).trim() === '') {
        errs.push(`Stage #${i + 1} "${row.stage}": required arg "${a.name}" is empty.`)
      }
    }
  }
  return errs
})
const wizValid = computed(() => wizValidationErrors.value.length === 0)
// Flip to true the first time wizardSubmit blocks on validation errors,
// so per-field red highlights + the Fix-before-saving banner only show
// up AFTER the user has tried to save. Newly-added stages start neutral
// instead of immediately screaming red. The watch below also clears
// the flag automatically as soon as everything is filled in, so the
// red goes away the moment the user types the last missing value.
const wizShowFieldErrors = ref(false)
watch(wizValid, (nowValid) => {
  if (nowValid) wizShowFieldErrors.value = false
})

// Detect whether the wizard YAML needs a CSV input dataset. Right
// now there's exactly one stage that consumes one — load_csv — but
// the regex is broad enough to catch aliases (loadCsv, load_dataset)
// if we add them later. When this is true, Save & Run pauses for the
// upload modal before kicking off the Spark job.
function pipelineNeedsInputCsv(yamlText) {
  return /\b(load_csv|loadCsv|load_dataset)\b/.test(yamlText || '')
}

async function wizardSubmit(execute, _skipVarGate = false) {
  if (!wizValid.value) {
    // First failed save attempt: unlock the per-field red highlight
    // + the "Fix before saving" banner so the user sees what's
    // missing. Stays on until they fix everything (wizValid becomes
    // true again — see the watch below).
    wizShowFieldErrors.value = true
    wizStatus.value = { kind: 'error', text: 'Fix the validation errors above first.' }
    return
  }
  // Validation passed at submit time — clear the highlight state so a
  // subsequent edit doesn't keep the residual red.
  wizShowFieldErrors.value = false
  // Launch-time variable gate: on Save & Run, detect parameterizable values
  // (search keyword / url) the user hasn't yet turned into a $variable. If
  // any, open the 🔗 Variabili modal and HALT — the launch resumes from
  // applyVariableBindings (apply) or skipVariableGate (skip). Only on
  // execute, and only when not already resuming (_skipVarGate).
  if (execute && !_skipVarGate) {
    const gated = await maybeOpenVariableGate()
    if (gated) return
  }
  const name = wizPipelineName.value.trim()
  const yamlText = wizYamlPreview.value

  // If the user pressed Save & Run AND the pipeline declares a
  // load_csv-style stage, we need an input dataset before executing.
  // Save the pipeline as a draft first (so an agent exists for the
  // upload endpoint to attach the dataset to), then funnel into the
  // existing dataset-upload modal — that flow already handles CSV
  // upload, auto-generated single-row mode, and execute.
  if (execute && pipelineNeedsInputCsv(yamlText)) {
    await wizardSaveThenOpenDatasetModal(name, yamlText)
    return
  }

  wizStatus.value = { kind: 'info', text: execute ? 'Saving + submitting…' : 'Saving as draft…' }
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/save-generated-pipeline`, {
      method: 'POST',
      body: JSON.stringify({ pipeline_name: name, pipeline_yaml: yamlText, execute })
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Save failed')
    if (execute) {
      const execId = j.execution && j.execution.execution_id
      const dsId   = j.execution && j.execution.output_dataset_id
      // Surface backend execution_error verbatim instead of pretending
      // we're "running" — the user would otherwise stare at an empty
      // Execution panel forever.
      //
      // Special case: when the backend rejects because the pipeline
      // wants an input dataset that the wizard didn't attach, route
      // to the existing dataset-upload modal (CSV upload or
      // auto-trigger). Save already succeeded — the agent is in
      // the selector — so we can reuse the curated-demo "Run" path.
      if (j.execution_error && /input dataset is required/i.test(j.execution_error)) {
        wizStatus.value = {
          kind: 'info',
          text: 'Pipeline saved. Choose a dataset (or skip with auto-trigger) to start the run.'
        }
        await loadPipelines()
        selectedPipeline.value = name
        if (typeof onPipelineSelected === 'function') onPipelineSelected()
        handleExecutePipeline()   // opens the existing upload modal
        return
      }
      if (j.execution_error) {
        wizStatus.value = { kind: 'error', text: 'Saved but execution failed: ' + j.execution_error }
      } else if (execId) {
        attachToExecution(execId, name, dsId)
        wizStatus.value = {
          kind: 'success',
          text: '✅ Saved + submitted. Scrolling to the Execution status panel…'
        }
        // The exec-panel sits above the wizard in the DOM. After a
        // bottom-of-page Save & Run the user would never see it
        // without scrolling — do it for them.
        await nextTick()
        const el = execPanelEl.value
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      } else {
        wizStatus.value = {
          kind: 'error',
          text: 'Saved but no execution_id returned by the backend — check Jersey logs.'
        }
      }
    } else {
      wizStatus.value = {
        kind: 'success',
        text: `✅ Pipeline "${name}" saved as draft. Look in the demo selector above (it'll be flagged "draft").`
      }
    }
    // Refresh demo selector so the new pipeline appears.
    loadPipelines()
  } catch (e) {
    wizStatus.value = { kind: 'error', text: 'Error: ' + (e.message || String(e)) }
  }
}

// load_csv-needing pipelines: save as draft first (so /upload-dataset
// has an agent to attach to), refresh the demo list, auto-select the
// draft in the existing pipeline selector, and trigger the dataset
// upload modal. From there the existing handleExecutePipeline path
// uploads the CSV and submits the Spark job — no duplicated UI.
async function wizardSaveThenOpenDatasetModal(name, yamlText) {
  wizStatus.value = { kind: 'info', text: 'Saving draft so the input dataset can be attached…' }
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/save-generated-pipeline`, {
      method: 'POST',
      body: JSON.stringify({ pipeline_name: name, pipeline_yaml: yamlText, execute: false })
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Save failed')
    await loadPipelines()
    // Auto-select the just-saved draft so handleExecutePipeline picks
    // it up. selectedPipeline = the id the selector uses (pipeline_name).
    selectedPipeline.value = name
    if (typeof onPipelineSelected === 'function') onPipelineSelected()
    wizStatus.value = {
      kind: 'success',
      text: `✅ Saved as draft. Please choose a CSV (or skip for auto-generated input) in the upload modal that just opened.`
    }
    // Open the existing upload modal — same UX used for curated demos.
    handleExecutePipeline()
  } catch (e) {
    wizStatus.value = { kind: 'error', text: 'Error: ' + (e.message || String(e)) }
  }
}
function wizardSaveAndRun()  { return wizardSubmit(true) }
function wizardSaveAsDraft() { return wizardSubmit(false) }

// ── Validate-selectors modal ──────────────────────────────────────
// Browser-automation preview: POSTs the current YAML to
// /wizard/validate, which opens a Camoufox session, replays the
// fetch trace, then samples up to 5 records from flatSelect /
// extract stages. The user sees the same DOM the Spark runtime
// would see — no jsoup, no static HTTP — before committing.
const validateOpen   = ref(false)
const validateState  = ref({ kind: 'idle', text: '' })
const validateResult = ref(null)
const validateColumns = computed(() => {
  const recs = validateResult.value && validateResult.value.records
  if (!Array.isArray(recs) || !recs.length) return []
  const cols = []
  const seen = new Set()
  for (const r of recs) {
    if (r && typeof r === 'object') {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) { seen.add(k); cols.push(k) }
      }
    }
  }
  return cols
})
function truncate(v) {
  if (v == null) return ''
  const s = String(v)
  return s.length > 80 ? s.slice(0, 77) + '…' : s
}
function openValidate() {
  if (!wizValid.value) {
    wizStatus.value = { kind: 'error', text: 'Fix the validation errors above first.' }
    return
  }
  validateOpen.value = true
  validateState.value = { kind: 'idle', text: '' }
  validateResult.value = null
}
function closeValidate() {
  validateOpen.value = false
}

// ───────── Variabili: parameterize pipeline values → $col binding ─────────
// Launch-time "🔗 Variables" flow. The LLM (DemoService.inferVariables) scans
// the YAML for parameterizable literals (search keyword in a fetch url or in a
// trace Type/input action's text). The user binds each to an input-dataset
// column → the literal is rewritten to `$column`, resolved per-row at runtime
// (parameter sweep). See project_pipeline_variables_wizard memory + the ETL
// $col interpolation in TextInput/InputFactory + NativeFetchStage.toExtractor.
const varDetectOpen    = ref(false)
const varDetectLoading = ref(false)
const varDetectError   = ref(null)
const varDetectRan     = ref(false)
const varDetectResults = ref([])      // [{ stage, path, current, suggested_name, kind, suggested_column, question }]
const varDetectColumns = ref('')      // comma-separated dataset columns (optional)
const varBindings      = ref([])      // parallel to results: [{ mode:'column'|'literal', column }]
// When true the modal is gating a Save & Run launch (wizard in-memory path):
// apply/skip resume the launch; cancel aborts it. Null/false = opened manually.
const varGateExecute   = ref(false)
// Non-null when gating the Upload & Execute path on a SAVED pipeline. Holds
// { datasetId } so apply/skip can resume the run after rewriting+persisting.
const varGateSaved     = ref(null)
// Either gate active → the modal shows "…e lancia" actions instead of Apply.
const varGateActive    = computed(() => varGateExecute.value || !!varGateSaved.value)

// Question shown on each candidate card. Generated CLIENT-SIDE from the
// structured fields (not the LLM) so the wizard text is stable and matches
// the rest of the (English) demo UI regardless of what the model returns.
function varQuestion(v) {
  const cur = v && v.current ? `«${v.current}»` : 'questo valore'
  if (v && v.kind === 'search_term') return `Make the search term ${cur} a variable?`
  if (v && v.kind === 'url')         return `Make the URL ${cur} a variable?`
  return `Make ${cur} a variable?`
}

// Default binding for a detected variable: column-bind when we have a
// suggested/known column, else literal. Shared by the manual flow + the
// launch gate so both pre-fill the same way.
function defaultBindingFor(v) {
  // The variable name = a dataset column the user picks. The LLM may suggest
  // WHICH column (suggested_column, chosen from the real column list); we
  // never use an invented name. Pre-select the suggested column if it's in
  // the list, else the first available column, else leave literal.
  const sugg = (v.suggested_column && varColumnList.value.includes(v.suggested_column))
    ? v.suggested_column
    : (varColumnList.value[0] || '')
  return { mode: sugg ? 'column' : 'literal', column: sugg }
}

const varColumnList = computed(() =>
  varDetectColumns.value.split(',').map(s => s.trim()).filter(Boolean))
const varBoundCount = computed(() =>
  varBindings.value.filter(b => b && b.mode === 'column' && (b.column || '').trim()).length)

function openVariableDetect() {
  if (!wizValid.value) {
    wizStatus.value = { kind: 'error', text: 'Fix the validation errors above first.' }
    return
  }
  varGateExecute.value = false   // manual open — never auto-launches
  varDetectOpen.value = true
  varDetectError.value = null
  varDetectRan.value = false
  varDetectResults.value = []
  varBindings.value = []
  // Pre-fill dataset columns from a previously uploaded demo dataset if present.
  if (!varDetectColumns.value && demoUploadResult.value && Array.isArray(demoUploadResult.value.columns)) {
    varDetectColumns.value = demoUploadResult.value.columns.join(', ')
  }
}
function closeVariableDetect() {
  varDetectOpen.value = false
  // Cancelling the modal while it was gating a launch = abort the launch.
  if (varGateExecute.value) {
    varGateExecute.value = false
    wizStatus.value = { kind: 'info', text: 'Launch cancelled. No variables applied.' }
  }
  // Saved-pipeline gate cancel: abort the run, leave the upload modal open so
  // the user can retry or close it themselves.
  if (varGateSaved.value) {
    varGateSaved.value = null
  }
}

// Launch gate: called from Save & Run before submitting. Detects
// parameterizable values; if any are not already a $variable, opens the
// modal and returns true (caller must halt — the launch resumes from
// applyVariableBindings / skipVariableGate). Returns false to proceed
// straight to launch (no candidates, or detection failed — never block a
// run on a detection hiccup).
async function maybeOpenVariableGate() {
  try {
    wizStatus.value = { kind: 'info', text: 'Checking variables…' }
    const cols = (demoUploadResult.value && Array.isArray(demoUploadResult.value.columns))
      ? demoUploadResult.value.columns : []
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-variables`, {
      method: 'POST',
      body: JSON.stringify({ pipeline_yaml: wizYamlPreview.value, dataset_columns: cols }),
    })
    const j = await r.json()
    if (!r.ok) return false
    const vars = (Array.isArray(j.variables) ? j.variables : [])
      .filter(v => v && typeof v.current === 'string' && !v.current.trim().startsWith('$'))
    if (!vars.length) return false
    varDetectColumns.value = cols.join(', ')
    varDetectResults.value = vars
    varBindings.value = vars.map(defaultBindingFor)
    varDetectRan.value = true
    varDetectError.value = null
    varGateExecute.value = true
    varDetectOpen.value = true
    wizStatus.value = { kind: 'info', text: 'Variables detected — choose how to handle them before launch.' }
    return true
  } catch (e) {
    return false
  }
}

// Skip the gate: launch without converting anything to a variable.
function skipVariableGate() {
  varDetectOpen.value = false
  // Saved-pipeline gate: execute the saved pipeline as-is with the dataset.
  if (varGateSaved.value) {
    const dsId = varGateSaved.value.datasetId
    varGateSaved.value = null
    closeUploadModal()
    if (dsId != null) executePipeline(dsId)
    return
  }
  // Wizard in-memory gate: resume Save & Run.
  varGateExecute.value = false
  wizardSubmit(true, true)
}

async function runVariableDetect() {
  varDetectLoading.value = true
  varDetectError.value = null
  varDetectRan.value = false
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-variables`, {
      method: 'POST',
      body: JSON.stringify({
        pipeline_yaml: wizYamlPreview.value,
        dataset_columns: varColumnList.value,
      }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'infer-variables failed')
    const vars = Array.isArray(j.variables) ? j.variables : []
    varDetectResults.value = vars
    varBindings.value = vars.map(defaultBindingFor)
    varDetectRan.value = true
  } catch (e) {
    varDetectError.value = 'Errore: ' + (e.message || String(e))
  } finally {
    varDetectLoading.value = false
  }
}

// Apply one detected variable's column binding to the in-memory pipeline by
// rewriting the matched literal to `$column`. Uses the LLM's `path`
// (pipeline[i].url | pipeline[i].trace[j].text) as a hint, falling back to a
// value match so index drift (python/sql shim stages) can't misfire.
function applyOneVariable(v, token) {
  const pipe = wizPipeline.value
  const cur = v.current
  // trace text: pipeline[i].trace[j].text
  const mTrace = /pipeline\[(\d+)\]\.trace\[(\d+)\]\.text/.exec(v.path || '')
  if (mTrace) {
    const i = +mTrace[1], j = +mTrace[2]
    const row = pipe[i]
    if (row && Array.isArray(row._trace) && row._trace[j] && row._trace[j].text === cur) {
      row._trace[j].text = token; return true
    }
  }
  if (/\.trace\[/.test(v.path || '') || v.kind === 'text') {
    for (const row of pipe) {
      if (!Array.isArray(row._trace)) continue
      const hit = row._trace.find(a => a && a.type === 'Type' && a.text === cur)
      if (hit) { hit.text = token; return true }
    }
  }
  // stage arg (url or other): pipeline[i].<arg>
  const mArg = /pipeline\[(\d+)\]\.([A-Za-z_][\w]*)/.exec(v.path || '')
  if (mArg) {
    const i = +mArg[1], arg = mArg[2]
    const row = pipe[i]
    if (row && row.args && row.args[arg] === cur) { row.args[arg] = token; return true }
  }
  // value-match fallback across all rows' args
  for (const row of pipe) {
    if (!row.args) continue
    for (const k of Object.keys(row.args)) {
      if (row.args[k] === cur) { row.args[k] = token; return true }
    }
  }
  return false
}

function applyVariableBindings() {
  // Saved-pipeline gate (Upload & Execute): rewrite the YAML string +
  // persist on the backend, then run. Different from the wizard in-memory
  // path below which mutates wizPipeline.
  if (varGateSaved.value) { return applyVariableBindingsSaved() }
  let applied = 0
  const names = []
  varDetectResults.value.forEach((v, vi) => {
    const b = varBindings.value[vi]
    if (!b || b.mode !== 'column') return
    const col = (b.column || '').trim().replace(/^\$+/, '')
    if (!col) return
    if (applyOneVariable(v, '$' + col)) { applied++; names.push('$' + col) }
  })
  if (applied > 0) {
    // A $col only resolves if the input-dataset rows DRIVE the pipeline.
    // A fetch-first pipeline self-seeds from its literal URL (PipelineEngine
    // build basePlan=None → blank row, no $col column), so the dataset is
    // ignored. Prepend a load_csv reading ${INPUT_CSV_PATH} so the uploaded
    // dataset's rows feed the fetch and $col resolves per row. No-op if a
    // loader already exists.
    const addedLoader = ensureInputLoader()
    wizPipeline.value = [...wizPipeline.value]
    wizStatus.value = {
      kind: 'success',
      text: `🔗 ${applied} variable(s) applied (${names.join(', ')})`
        + (addedLoader ? ' + input load_csv prepended.' : '.'),
    }
  } else {
    wizStatus.value = { kind: 'info', text: 'No variables applied.' }
  }
  // If the modal was gating a Save & Run, resume the launch now (with the
  // rewritten $col YAML). _skipVarGate=true so we don't re-detect/loop.
  const wasGating = varGateExecute.value
  varDetectOpen.value = false
  varGateExecute.value = false
  if (wasGating) wizardSubmit(true, true)
}

// Ensure the pipeline has an input loader so $col references resolve from
// the uploaded dataset's rows. Prepends `load_csv ${INPUT_CSV_PATH}` when no
// load_* stage is present. Returns true if it added one.
function ensureInputLoader() {
  const pipe = wizPipeline.value
  // Recognise ANY load* loader (load_csv/parquet/json/postgres/union/…,
  // also camelCase loadCsv) — don't double-add if data already enters.
  const hasLoader = pipe.some(r => r && typeof r.stage === 'string'
    && /^load/i.test(r.stage))
  if (hasLoader) return false
  const loader = { stage: 'load_csv', args: { path_or_spec: '${INPUT_CSV_PATH}' } }
  wizPipeline.value = [loader, ...pipe]
  return true
}

async function runValidation() {
  validateState.value = { kind: 'running', text: 'Opening Camoufox session and replaying trace…' }
  validateResult.value = null
  try {
    const yamlText = wizYamlPreview.value
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/validate`, {
      method: 'POST',
      // Reuse the designer's LIVE Camoufox session (page already loaded) so the
      // validator skips the slow re-navigate (+ its 30s DCL timeout / SSL hiccups
      // on heavy sites via the proxy). Backend falls back to opening fresh if the
      // session is gone.
      // include_snapshot:true → the backend returns the full-page html_snapshot for the iframe preview
      // below. (Default is OFF so MCP/agent callers don't get the huge HTML; the picker UI opts in.)
      body: JSON.stringify({ yaml: yamlText, session_id: cmfSessionId.value || null, include_snapshot: true })
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Validation request failed')
    validateResult.value = j
    if (j.valid) {
      validateState.value = {
        kind: 'success',
        text: `✓ Validation OK — ${j.record_count} record(s) extracted via Camoufox.`
      }
    } else {
      validateState.value = {
        kind: 'error',
        text: 'Validation failed — see steps below.'
      }
    }
  } catch (e) {
    validateState.value = { kind: 'error', text: 'Error: ' + (e.message || String(e)) }
  }
}

// Clone the currently-selected demo pipeline into the wizard editor.
// Uses /demo/list's pre-parsed `stages` array (server-side YAML parse)
// so we don't need a YAML lib in the browser. Positional args get
// mapped back to named via the catalog's arg_schema order.
// Convert an action map from the runtime YAML format
// ({action, selector, text, seconds, pixels, direction}) back into
// the wizard's internal trace action shape ({type, selector, text, ms, y}).
// Mirror of traceActionToYamlMap() — keep these two in sync.
function actionMapToTrace(m) {
  if (!m || typeof m !== 'object') return null
  const action = String(m.action || m.factory || '').toLowerCase()
  if (action === 'click') {
    return m.selector ? { type: 'Click', selector: String(m.selector) } : null
  }
  if (action === 'input' || action === 'type' || action === 'fill') {
    if (!m.selector) return null
    return { type: 'Type', selector: String(m.selector), text: String(m.text != null ? m.text : (m.value || '')) }
  }
  if (action === 'wait' || action === 'sleep') {
    const sec = m.seconds != null ? Number(m.seconds) : (m.ms != null ? Number(m.ms) / 1000 : 1)
    return { type: 'Wait', ms: Math.round(sec * 1000) }
  }
  if (action === 'scroll') {
    const pixels = Math.abs(Number(m.pixels != null ? m.pixels : (m.y != null ? m.y : 600)))
    const dir = String(m.direction || 'down').toLowerCase()
    return { type: 'Scroll', y: (dir === 'up' ? -pixels : pixels) }
  }
  return null
}

function cloneToWizard() {
  if (!selectedPipelineInfo.value) return
  if (wizPipeline.value.length > 0) {
    if (!window.confirm('This will replace your current pipeline draft. Continue?')) return
  }
  const stages = selectedPipelineInfo.value.stages || []
  const next = []
  for (const s of stages) {
    const argsObj = {}
    let fields = null   // structured field list for extract / flatSelect
    let trace  = null   // recorded actions for fetch / visit / wget

    if (s.stage === 'extract') {
      // YAML: args = [{selector, method, as}, …] — every positional
      // entry is a field map. Push them all into _fields; leave
      // args empty so the structured panel is the only data source.
      if (Array.isArray(s.args)) {
        fields = s.args.filter(a => a && typeof a === 'object').map(a => ({
          selector: String(a.selector || ''),
          method:   String(a.method || 'text'),
          as:       String(a.as || ''),
        }))
      }
    } else if (s.stage === 'flatSelect') {
      // YAML: args = [segmentSelector, [{selector, method, as}, …]]
      // First positional is the container; second is the field list.
      if (Array.isArray(s.args)) {
        if (s.args.length > 0) argsObj.selector = String(s.args[0] || '')
        if (s.args.length > 1 && Array.isArray(s.args[1])) {
          fields = s.args[1].filter(a => a && typeof a === 'object').map(a => ({
            selector: String(a.selector || ''),
            method:   String(a.method || 'text'),
            as:       String(a.as || ''),
          }))
        }
      }
    } else if (Array.isArray(s.args) && (s.stage === 'fetch' || s.stage === 'visit' || s.stage === 'wget')) {
      // YAML: args = [url, [{action, selector, text, …}, …]]
      // First positional is the URL — map by catalog arg_schema.
      const spec = findStageSpec(s.stage)
      const argNames = (spec && spec.arg_schema || []).map(a => a.name)
      if (s.args.length > 0 && argNames.length > 0) {
        argsObj[argNames[0]] = s.args[0]
      }
      // Second positional, if present and a list, is the embedded
      // trace. Convert back to {type, selector, text, ms, y}.
      if (s.args.length > 1 && Array.isArray(s.args[1])) {
        trace = s.args[1].map(actionMapToTrace).filter(Boolean)
      }
    } else {
      // Generic stages — positional → named via catalog order.
      const spec = findStageSpec(s.stage)
      const argNames = (spec && spec.arg_schema || []).map(a => a.name)
      if (Array.isArray(s.args)) {
        for (let i = 0; i < s.args.length && i < argNames.length; i++) {
          argsObj[argNames[i]] = s.args[i]
        }
      } else if (s.args && typeof s.args === 'object') {
        Object.assign(argsObj, s.args)
      }
    }

    const row = { stage: s.stage, args: argsObj }
    if (fields && fields.length) row._fields = fields
    if (trace  && trace.length)  row._trace  = trace
    next.push(row)
  }
  wizPipeline.value = next
  wizPipelineName.value = (selectedPipelineInfo.value.id || 'cloned') + '-edit'
  wizStatus.value = {
    kind: 'info',
    text: `Cloned from "${selectedPipelineInfo.value.name}". Edit and Save & Run when ready.`
  }
  // The "Edit in wizard" button lives inside the dataset upload
  // modal. Once the user committed to editing, that modal has done
  // its job — close it so they actually see the wizard panel they
  // were sent to.
  if (typeof showUploadModal !== 'undefined' && showUploadModal.value) {
    closeUploadModal()
  }
  // Scroll the wizard into view so the user sees the result.
  setTimeout(() => {
    const el = document.querySelector('.wizard-card')
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

function wizardReset() {
  wizPipeline.value = []
  wizPythonExtensions.value = []
  wizPipelineName.value = ''
  wizIntent.value = ''
  wizStatus.value = { kind: null, text: '' }
}

// Private Demo Authentication
// API base URL - can be configured via environment variable or use production default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.webrobot.eu'

async function authenticate() {
  if (!authConfig.value.apiKey.trim()) return
  
  isAuthenticating.value = true
  authError.value = null
  
  try {
    // Step 1: Validate API key and get user information
    // Using the new /api/webrobot/api/auth/me endpoint to get user info including organization_id
    const authResponse = await fetch(`${API_BASE_URL}/api/webrobot/api/auth/me`, {
      method: 'GET',
      headers: {
        'X-API-Key': authConfig.value.apiKey.trim(),
        'Content-Type': 'application/json'
      }
    })
    
    if (!authResponse.ok) {
      if (authResponse.status === 401) {
        authError.value = 'Invalid API key. Please check your credentials.'
      } else if (authResponse.status === 403) {
        authError.value = 'API key does not have required permissions.'
      } else {
        authError.value = `Authentication failed: ${authResponse.statusText}`
      }
      isAuthenticating.value = false
      return
    }
    
    // Parse user information from response
    const userInfo = await authResponse.json()
    const organizationId = userInfo.organizationId || null
    const userId = userInfo.userId || 'unknown'
    const role = userInfo.role || 'authenticated'
    const scopes = userInfo.scopes || []
    
    // Store organization_id for demo filtering
    authenticatedOrganizationId.value = organizationId
    
    // Build user object
    const user = {
      name: `User ${userId}`,
      email: '',
      userId: userId,
      role: role,
      organizationId: organizationId,
      scopes: scopes,
      demos: [] // Will be filtered based on organization_id
    }
    
    // Helper function to check if a demo is available for the user's organization
    const isDemoAvailableForOrg = (demoOrgId, userOrgId) => {
      // If demo has no organization restriction (null), it's available to all
      if (demoOrgId === null || demoOrgId === undefined) {
        return true
      }
      
      // If user has no organization_id, only show demos available to all
      if (userOrgId === null || userOrgId === undefined) {
        return false
      }
      
      // If demo.organizationId is an array, check if user's org is in the list
      if (Array.isArray(demoOrgId)) {
        return demoOrgId.includes(userOrgId)
      }
      
      // If demo.organizationId is a string, compare directly
      if (typeof demoOrgId === 'string') {
        return demoOrgId === userOrgId
      }
      
      // Fallback: demo not available
      return false
    }
    
    // Filter demos based on organization_id
    // Each demo's organizationId can be:
    // - null/undefined: available to all organizations
    // - string: available only to that specific organization_id
    // - array: available to multiple organization_ids listed in the array
    const filteredDemos = availablePrivateDemos.value.filter(demo => {
      return isDemoAvailableForOrg(demo.organizationId, organizationId)
    })
    
    // Update user demos list
    user.demos = filteredDemos.map(demo => demo.id)
    
      isAuthenticated.value = true
      authenticatedUser.value = user
    
    // Store API key and organization_id in sessionStorage
    sessionStorage.setItem('webrobot_api_key', authConfig.value.apiKey.trim())
    if (organizationId) {
      sessionStorage.setItem('webrobot_org_id', organizationId)
    }
    
  } catch (error) {
    console.error('Authentication error:', error)
    authError.value = 'Network error. Please check your connection and try again.'
  } finally {
    isAuthenticating.value = false
  }
}

function logout() {
  isAuthenticated.value = false
  authenticatedUser.value = null
  authenticatedOrganizationId.value = null
  authConfig.value.apiKey = ''
  selectedPrivateDemo.value = null
  eanUploadResult.value = null
  eanResults.value = null
  sessionStorage.removeItem('webrobot_api_key')
  sessionStorage.removeItem('webrobot_org_id')
}

function selectPrivateDemo(demo) {
  if (demo.status === 'available') {
    selectedPrivateDemo.value = demo
    // Reset demo-specific state
    eanUploadResult.value = null
    eanResults.value = null
    eanImagesList.value = null
    eanError.value = null
  }
}

function handleImageError(event) {
  // Fallback to URL if base64 fails
  const img = event.target
  if (img.src && img.src.startsWith('data:')) {
    // Try to get URL from parent data attributes or fallback
    const url = img.getAttribute('data-url')
    if (url) {
      img.src = url
    }
  }
}

// EAN Plugin Methods
const canUploadEAN = computed(() => {
  return eanConfig.value.country && eanConfig.value.file
})

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file) {
    eanConfig.value.file = file
  }
}

async function uploadEANDataset() {
  if (!canUploadEAN.value) return
  
  isUploading.value = true
  eanError.value = null
  
  try {
    const apiKey = getAuthenticatedApiKey()
    if (!apiKey) {
      throw new Error('Not authenticated. Please log in first.')
    }
    
    // Prepare multipart form data
    const formData = new FormData()
    formData.append('file', eanConfig.value.file)
    
    // Call upload endpoint
    const response = await fetch(`${API_BASE_URL}/api/webrobot/ean-image-sourcing/${eanConfig.value.country}/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey
        // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
      },
      body: formData
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Upload failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    eanUploadResult.value = result
    
  } catch (error) {
    console.error('Upload error:', error)
    eanError.value = error.message || 'Failed to upload dataset'
  } finally {
    isUploading.value = false
  }
}

async function executeEANJob() {
  if (!eanUploadResult.value) return
  
  isExecutingEAN.value = true
  eanError.value = null
  
  try {
    const apiKey = getAuthenticatedApiKey()
    if (!apiKey) {
      throw new Error('Not authenticated. Please log in first.')
    }
    
    // Prepare request body
    const requestBody = {}
    if (eanUploadResult.value.datasetId) {
      requestBody.datasetId = eanUploadResult.value.datasetId
    }
    if (eanConfig.value.cloudCredentialId) {
      requestBody.cloudCredentialId = eanConfig.value.cloudCredentialId
    }
    
    // Call execute endpoint
    const response = await authenticatedFetch(`/api/webrobot/ean-image-sourcing/${eanConfig.value.country}/execute`, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Execution failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    // Update upload result with execution info
    eanUploadResult.value = {
      ...eanUploadResult.value,
      ...result,
      executionStatus: 'started'
    }
    
    alert(`Job execution started successfully!\nJob ID: ${result.jobId || 'N/A'}\nOutput Dataset ID: ${result.outputDatasetId || 'N/A'}`)
    
  } catch (error) {
    console.error('Execution error:', error)
    eanError.value = error.message || 'Failed to execute job'
  } finally {
    isExecutingEAN.value = false
  }
}

async function queryEANResults() {
  if (!eanConfig.value.query.trim()) return
  
  isQueryingEAN.value = true
  eanError.value = null
  
  try {
    const apiKey = getAuthenticatedApiKey()
    if (!apiKey) {
      throw new Error('Not authenticated. Please log in first.')
    }
    
    // Parse EAN codes from query (can be comma-separated or one per line)
    const eanCodes = eanConfig.value.query
      .split(/[,\n]/)
      .map(code => code.trim())
      .filter(code => code.length > 0)
    
    if (eanCodes.length === 0) {
      throw new Error('Please provide at least one EAN code')
    }
    
    // Call query endpoint
    const response = await authenticatedFetch(`/api/webrobot/ean-image-sourcing/${eanConfig.value.country}/query`, {
      method: 'POST',
      body: JSON.stringify({
        eanCodes: eanCodes
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Query failed: ${response.statusText}`)
    }
    
    const results = await response.json()
    eanResults.value = results
    
    // Extract table columns from first result if available
    if (results && results.length > 0) {
      eanTableColumns.value = Object.keys(results[0])
    } else {
      eanTableColumns.value = []
    }
    
  } catch (error) {
    console.error('Query error:', error)
    eanError.value = error.message || 'Failed to query results'
    eanResults.value = null
  } finally {
    isQueryingEAN.value = false
  }
}

// Function to get images list matched with EAN codes
async function getEANImagesList() {
  if (!eanConfig.value.query.trim()) return
  
  isFetchingImages.value = true
  eanError.value = null
  
  try {
    const apiKey = getAuthenticatedApiKey()
    if (!apiKey) {
      throw new Error('Not authenticated. Please log in first.')
    }
    
    // Parse EAN codes from query
    const eanCodes = eanConfig.value.query
      .split(/[,\n]/)
      .map(code => code.trim())
      .filter(code => code.length > 0)
    
    if (eanCodes.length === 0) {
      throw new Error('Please provide at least one EAN code')
    }
    
    // Call images endpoint (simplified format)
    const response = await authenticatedFetch(`/api/webrobot/ean-image-sourcing/${eanConfig.value.country}/images`, {
      method: 'POST',
      body: JSON.stringify({
        eanCodes: eanCodes,
        limit: 10 // Max 10 images per EAN
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Failed to fetch images: ${response.statusText}`)
    }
    
    const imagesList = await response.json()
    eanImagesList.value = imagesList
    
  } catch (error) {
    console.error('Images fetch error:', error)
    eanError.value = error.message || 'Failed to fetch images'
    eanImagesList.value = null
  } finally {
    isFetchingImages.value = false
  }
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...'
  return value
}

// Helper function to get authenticated API key for API requests
function getAuthenticatedApiKey() {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('webrobot_api_key')
}

// Helper function to make authenticated API requests
async function authenticatedFetch(url, options = {}) {
  const apiKey = getAuthenticatedApiKey()
  if (!apiKey) {
    throw new Error('Not authenticated. Please log in first.')
  }
  
  const headers = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  return fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers
  })
}

// Load pipelines and check for existing session on mount
if (typeof window !== 'undefined') {
  // Load available pipelines from backend
  loadPipelines()
  
  const storedKey = sessionStorage.getItem('webrobot_api_key')
  const storedOrgId = sessionStorage.getItem('webrobot_org_id')
  if (storedKey) {
    authConfig.value.apiKey = storedKey
    if (storedOrgId) {
      authenticatedOrganizationId.value = storedOrgId
    }
    // Authenticate automatically if API key is stored
    authenticate().catch(err => {
      console.error('Auto-authentication failed:', err)
      // Clear invalid stored keys
      sessionStorage.removeItem('webrobot_api_key')
      sessionStorage.removeItem('webrobot_org_id')
      authConfig.value.apiKey = ''
      authenticatedOrganizationId.value = null
    })
  }
}
</script>

<style scoped>
.demo-app {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 0 2rem;
  box-sizing: border-box;
}

.demo-section {
  margin-bottom: 3rem;
  padding: 2rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
}

.demo-section h2 {
  font-size: 1.5rem;
  margin-bottom: 0.75rem;
  margin-top: 0;
}

.demo-section > p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.pipeline-selector-card,
.generation-card {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--vp-c-divider);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.hint {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  font-weight: normal;
}

.pipeline-select,
.text-input,
.textarea-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  transition: border-color 0.2s;
}

.pipeline-select:focus,
.text-input:focus,
.textarea-input:focus {
  outline: none;
  border-color: #667eea;
}

.textarea-input {
  resize: vertical;
  min-height: 120px;
}

.pipeline-info {
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
  border-left: 4px solid #667eea;
}

.pipeline-info h3 {
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
}

.pipeline-description {
  color: var(--vp-c-text-2);
  margin-bottom: 1rem;
}

.pipeline-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.badge-link {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-brand-text);
  text-decoration: none;
  transition: opacity 0.2s;
}

.badge-link:hover {
  opacity: 0.8;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  background: var(--vp-c-divider);
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-secondary {
  /* Fixed light bg + dark text so the label stays legible in BOTH
     VitePress light and dark themes. Previously this used
     var(--vp-c-bg-soft) which goes dark in dark-mode and made the
     pinned #111 text invisible. */
  background: #f3f4f6;
  color: #111;
  font-weight: 600;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
  color: #000;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  color: var(--vp-c-text-2);
}

.loading-state .loading-spinner {
  border-color: var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
}

.results-card {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 2rem;
  margin-top: 1.5rem;
  border: 1px solid var(--vp-c-divider);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.results-header h3 {
  margin: 0;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.running {
  background: #d1ecf1;
  color: #0c5460;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.result-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.result-preview {
  margin-top: 1.5rem;
}

.result-preview h4 {
  margin-bottom: 0.75rem;
}

.polling-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  background: var(--vp-c-yellow-soft, #fff8e1);
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
  border-left: 3px solid var(--vp-c-yellow, #facc15);
}

.no-dataset-info {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  background: var(--vp-c-bg-alt, #f6f6f7);
  border-left: 3px solid var(--vp-c-brand-1, #3b82f6);
}

.no-dataset-info code {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--vp-c-default-soft, #efefef);
  font-size: 0.9em;
}

.polling-banner.polling-done {
  background: var(--vp-c-green-soft, #e6f7ec);
  border-left-color: var(--vp-c-green, #10b981);
}

.polling-spinner {
  display: inline-block;
  animation: polling-spin 1.4s linear infinite;
}

@keyframes polling-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.code-block {
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1.5rem;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
}

.yaml-block {
  max-height: 500px;
  overflow-y: auto;
}

.error-content {
  color: #721c24;
}

.error-message {
  background: #f8d7da;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #dc3545;
}

.generated-yaml {
  margin-bottom: 1.5rem;
}

.generation-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* API guide section — bottom of the demo page */
.api-guide { border-left: 4px solid #6366f1; }
.api-guide > p { color: var(--vp-c-text-2, #4b5563); }
.api-guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.api-guide-card {
  background: var(--vp-c-bg, #ffffff);
  border: 1px solid var(--vp-c-divider, #e5e7eb);
  border-radius: 8px;
  padding: 14px 16px;
}
.api-guide-card h4 {
  margin: 0 0 8px 0;
  font-size: 0.96em;
  color: var(--vp-c-text-1, #111827);
}
.code-block-sm {
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 6px;
  padding: 10px 12px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 11.5px;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre;
  margin: 0;
}
.api-guide-hint {
  margin: 8px 0 0 0;
  font-size: 0.82em;
  color: var(--vp-c-text-2, #6b7280);
  line-height: 1.45;
}
.api-guide-pointers {
  margin-top: 18px;
  padding: 12px 14px;
  background: var(--vp-c-bg-soft, #f3f4f6);
  border-radius: 6px;
  font-size: 0.88em;
}
.api-guide-pointers p { margin: 4px 0; }
.api-guide-pointers code { background: transparent; padding: 0; }

/* Private Demo Styles */
.auth-card {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--vp-c-divider);
}

.auth-header {
  margin-bottom: 1.5rem;
}

.auth-header h3 {
  margin-bottom: 0.5rem;
}

.auth-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--vp-c-bg-soft);
  padding: 1rem 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid var(--vp-c-divider);
}

.auth-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.auth-label {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.auth-value {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.badge-success {
  background: #d4edda;
  color: #155724;
}

.badge-info {
  background: #d1ecf1;
  color: #0c5460;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.private-demos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.private-demo-card {
  background: var(--vp-c-bg-soft);
  border: 2px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.private-demo-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.private-demo-card.demo-active {
  border-color: #667eea;
  background: var(--vp-c-bg);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.demo-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.private-demo-card h3 {
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
}

.demo-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}

.feature-tag {
  padding: 0.25rem 0.75rem;
  background: var(--vp-c-bg);
  border-radius: 12px;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.demo-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.available {
  background: #28a745;
}

.status-indicator.coming-soon {
  background: #ffc107;
}

.private-demo-interface {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 2rem;
  margin-top: 2rem;
  border: 1px solid var(--vp-c-divider);
}

.demo-interface-header {
  margin-bottom: 2rem;
}

.demo-interface-header h3 {
  margin-bottom: 0.5rem;
}

.ean-workflow {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.workflow-step {
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid #667eea;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  font-weight: 600;
}

.step-content {
  margin-left: 3rem;
}

.upload-result {
  background: var(--vp-c-bg-soft);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.upload-result p {
  margin: 0.5rem 0;
}

.file-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px dashed var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  cursor: pointer;
}

.file-hint {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  margin-top: 0.5rem;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--vp-c-bg);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--vp-c-text-1);
}

.modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: var(--vp-c-text-2);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.modal-close:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
}

.csv-format-hint {
  background: var(--vp-c-bg-soft);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  line-height: 1.5;
}

.input-mode-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-bg-soft);
}

.toggle-btn.active {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-brand);
  color: white;
}

.input-hint {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  font-style: italic;
}

.csv-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 150px;
}

.csv-textarea:focus {
  outline: none;
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 3px rgba(var(--vp-c-brand-rgb), 0.1);
}

.csv-preview {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.csv-preview strong {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--vp-c-text-1);
}

.csv-preview-text {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
}

.pipeline-stages-section {
  margin: 1.5rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.stages-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.stages-section-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.stages-content {
  padding: 1rem;
}

.stage-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
}

.stage-number {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-brand);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.875rem;
}

.stage-details {
  flex: 1;
  min-width: 0;
}

.stage-name {
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.stage-name code {
  background: var(--vp-c-bg-alt);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--vp-c-brand);
}

.stage-args {
  margin-top: 0.5rem;
}

.stage-args strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
}

.stage-args-block {
  max-height: 200px;
  overflow-y: auto;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

.pipeline-yaml-section {
  margin: 1.5rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.yaml-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.yaml-section-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.yaml-section-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
}

.yaml-content {
  padding: 1rem;
}

.file-name {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  font-style: italic;
}

.ean-results {
  margin-top: 2rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 2rem;
  border: 1px solid var(--vp-c-divider);
}

.results-table-container {
  overflow-x: auto;
  margin-top: 1rem;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.results-table th,
.results-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--vp-c-divider);
}

.results-table th {
  background: var(--vp-c-bg);
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.results-table tr:hover {
  background: var(--vp-c-bg);
}

.demo-coming-soon {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 4rem 2rem;
  text-align: center;
  border: 1px solid var(--vp-c-divider);
}

.coming-soon-content h3 {
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .result-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .generation-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
  
  .pipeline-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .private-demos-grid {
    grid-template-columns: 1fr;
  }

  .auth-status-bar {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .step-content {
    margin-left: 0;
  }

  .results-table {
    font-size: 0.8rem;
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}

/* EAN Images List Styles */
.ean-images-list {
  margin-top: 2rem;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}

.ean-images-group {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid var(--vp-c-divider);
}

.ean-images-group:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.ean-images-group h4 {
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
  font-size: 1.1rem;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.image-card {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.image-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.product-image {
  width: 100%;
  height: 200px;
  object-fit: contain;
  background: var(--vp-c-bg-alt);
  display: block;
}

.image-info {
  padding: 0.75rem;
  text-align: center;
}

.image-score {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vp-c-brand);
}

.image-link {
  display: inline-block;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.2s;
}

.image-link:hover {
  color: var(--vp-c-brand);
}

.no-images {
  color: var(--vp-c-text-2);
  font-style: italic;
  margin: 1rem 0;
}

.button-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* ─── Scope banner ─────────────────────────────────────────── */
/* Captcha / HITL notification bell — pinned top-right of the demo
   pane, dropdown surfaces the list of blocked sessions. */
.cmf-notif-bell-wrap {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 1000;
}
.cmf-notif-bell {
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  animation: cmf-notif-pulse 2s ease-in-out infinite;
}
.cmf-notif-bell:hover { background: #b91c1c; }
.cmf-notif-badge {
  background: white;
  color: #dc2626;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.85rem;
  min-width: 22px;
  text-align: center;
}
@keyframes cmf-notif-pulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4); }
  50%      { box-shadow: 0 4px 22px rgba(220, 38, 38, 0.7); }
}
.cmf-notif-dropdown {
  position: absolute;
  top: 52px;
  right: 0;
  min-width: 340px;
  max-width: 420px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.16);
  overflow: hidden;
}
.cmf-notif-header {
  background: #fef2f2;
  color: #991b1b;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #fecaca;
}
.cmf-notif-close {
  background: transparent;
  border: none;
  color: #991b1b;
  cursor: pointer;
  font-size: 1rem;
}
.cmf-notif-item {
  padding: 10px 14px;
  border-bottom: 1px solid #f3f4f6;
}
.cmf-notif-item:last-child { border-bottom: none; }
.cmf-notif-meta {
  font-size: 0.9rem;
  color: #1f2937;
  margin-bottom: 8px;
  word-break: break-all;
}
.cmf-notif-since { color: #6b7280; font-size: 0.8rem; }
.cmf-notif-actions {
  display: flex;
  gap: 8px;
}

/* HITL pause-on-captcha toggle — sits under ByocModeSelector inside
   the demo execution panel. Subtle styling so it doesn't compete with
   the BYOC selector but stays clearly distinguishable. */
.hitl-opt-wrap {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #4f46e5;
  border-radius: 6px;
}
.hitl-opt-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  color: #1f2937;
}
.hitl-opt-label input[type="checkbox"] {
  margin-top: 3px;
  cursor: pointer;
  accent-color: #4f46e5;
}
.hitl-opt-label strong {
  font-weight: 600;
  color: #1f2937;
}
.hitl-opt-hint {
  display: block;
  color: #4b5563;
  font-size: 0.82rem;
  font-weight: 400;
  margin-top: 2px;
  line-height: 1.4;
}
.hitl-opt-timeout {
  margin-top: 8px;
  padding-left: 28px;
  font-size: 0.85rem;
  color: #1f2937;
}
.hitl-opt-timeout-input {
  width: 60px;
  display: inline-block;
  margin: 0 6px;
  padding: 2px 6px;
}
.hitl-opt-hint-small {
  display: block;
  color: #6b7280;
  font-size: 0.75rem;
  margin-top: 2px;
}

.scope-banner {
  /* Opaque pale-amber instead of near-transparent purple — the
     previous rgba(102,126,234,0.08) on top of the demo page's
     gradient background made the text barely visible. */
  background: #fff8e1;
  border: 1px solid #f6c065;
  color: #1f2937;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}
.scope-banner strong { color: #111827; }
/* Dark mode (VitePress class toggle) — keep contrast on a slate
   background instead of trying to invert the amber. */
.dark .scope-banner {
  background: #2a2417;
  border-color: #f59e0b;
  color: #fde68a;
}
.dark .scope-banner strong { color: #fef3c7; }

/* Design banner — sibling of scope-banner but cooler/blue palette
   so the two chips don't visually merge into one yellow strip. */
.design-banner {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  color: #1e3a8a;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}
.design-banner strong { color: #1e40af; }
.dark .design-banner {
  background: #172033;
  border-color: #3b82f6;
  color: #bfdbfe;
}
.dark .design-banner strong { color: #dbeafe; }

/* Sovereignty banner — second chip, violet palette so it stands
   apart from the amber/blue/green narrative chips. Communicates
   EU data residency, a recurring procurement / GDPR question. */
.sovereignty-banner {
  background: #f5f3ff;
  border: 1px solid #c4b5fd;
  color: #4c1d95;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}
.sovereignty-banner strong { color: #5b21b6; }
.dark .sovereignty-banner {
  background: #221a3a;
  border-color: #8b5cf6;
  color: #ddd6fe;
}
.dark .sovereignty-banner strong { color: #ede9fe; }

/* Perf banner — fourth chip, green palette to read as a positive
   "tip" rather than another advisory. */
.perf-banner {
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}
.perf-banner strong { color: #047857; }
.dark .perf-banner {
  background: #18302a;
  border-color: #10b981;
  color: #a7f3d0;
}
.dark .perf-banner strong { color: #d1fae5; }

/* ─── Live execution panel ─────────────────────────────────── */
.exec-panel {
  border-left: 4px solid #2196f3;
}
.exec-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.exec-panel-header h2 { margin: 0; }
.exec-panel-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.exec-summary {
  color: var(--vp-c-text-2);
  line-height: 1.7;
  margin-bottom: 12px;
}
.status-pill {
  display: inline-block;
  color: white;
  font-size: 0.8em;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  margin: 0 4px;
}
.exec-error {
  margin-top: 8px;
  color: #b00020;
}
.exec-error code {
  background: #fff0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
.exec-phase {
  margin-top: 10px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #fff7e6 0%, #fffaf0 100%);
  border: 1px solid #f5c06b;
  border-radius: 8px;
  font-size: 0.92em;
  color: #4a3a1f;
}
.exec-phase-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.exec-phase-icon { font-size: 1.15em; }
.exec-phase-label { color: #222; font-size: 1em; }
.exec-phase-detail { color: #6b5a3a; font-size: 0.9em; }
.exec-phase-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(245, 192, 107, 0.4);
  border-top-color: #d97706;
  border-radius: 50%;
  animation: exec-phase-spin 0.9s linear infinite;
}
@keyframes exec-phase-spin { to { transform: rotate(360deg); } }
.exec-phase-pods {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.88em;
  color: #4a3a1f;
}
.exec-phase-pill {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.82em;
  font-weight: 600;
  margin-left: 4px;
}
.exec-phase-pill.ready   { background: #d1fae5; color: #065f46; }
.exec-phase-pill.pending { background: #fef3c7; color: #92400e; }
.exec-phase-node { color: #6b7280; font-size: 0.85em; margin-left: 4px; }
.exec-output { margin-top: 18px; }
.exec-output h3 { margin: 0 0 6px 0; }
.exec-output-meta {
  color: #888;
  font-size: 0.85em;
  margin-bottom: 8px;
}
.exec-output-table-wrap {
  overflow-x: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
}
.exec-output-table {
  width: 100%;
  border-collapse: collapse;
}
.exec-output-table th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafbfc;
  font-size: 0.85em;
  color: #555;
}
.exec-output-table td {
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.85em;
  color: #333;
  vertical-align: top;
}
.exec-output-empty {
  padding: 12px;
  color: #888;
}
.exec-logs-title {
  margin-top: 18px;
}
.exec-logs {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px;
  border-radius: 8px;
  max-height: 320px;
  overflow-y: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.exec-logs-panel { margin-top: 16px; }
.exec-logs-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.exec-logs-controls .exec-logs-title {
  margin: 0 auto 0 0;
  /* h3 inherited an off-tone in light mode and disappeared on dark
     mode; pin it to the theme primary so it reads on both. */
  color: var(--vp-c-text-1, #111827);
  font-size: 1.05em;
  font-weight: 600;
}
.text-input-sm {
  padding: 4px 8px;
  font-size: 0.85em;
  height: auto;
  width: auto;
  /* Selects/inputs inherited browser default + theme conflicts: the
     dropdown text was washing out to light gray against the soft
     section background. Pin explicit white bg + near-black text so
     it reads no matter what theme is loaded. Options inside the
     dropdown also need explicit colors — browsers respect them on
     <option> when set here on the parent select. */
  background: #ffffff;
  color: #111827;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}
.text-input-sm option {
  background: #ffffff;
  color: #111827;
}
.text-input-sm:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.dark .text-input-sm {
  background: #1f2937;
  color: #f9fafb;
  border-color: #374151;
}
.dark .text-input-sm option {
  background: #1f2937;
  color: #f9fafb;
}
.exec-logs-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85em;
  /* Was a hardcoded #555 — invisible in dark mode. */
  color: var(--vp-c-text-2, #4b5563);
}
.exec-logs-stream {
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 8px;
  max-height: 460px;
  overflow-y: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  padding: 10px 12px;
}
.exec-logs-empty {
  background: #1e1e1e;
  color: #888;
  padding: 14px;
  border-radius: 8px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  font-style: italic;
}
.exec-logs-line {
  display: flex;
  gap: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.45;
}
.exec-logs-line:hover { background: rgba(255, 255, 255, 0.05); }
.exec-logs-ts    { color: #6e7681; flex-shrink: 0; min-width: 170px; }
.exec-logs-level { flex-shrink: 0; min-width: 60px; font-weight: 600; }
.exec-logs-line.level-error   .exec-logs-level { color: #ff7b72; }
.exec-logs-line.level-warn    .exec-logs-level { color: #f0b429; }
.exec-logs-line.level-info    .exec-logs-level { color: #79c0ff; }
.exec-logs-line.level-debug   .exec-logs-level { color: #8b949e; }
.exec-logs-line.level-trace   .exec-logs-level { color: #6e7681; }
.exec-logs-line.level-fatal   .exec-logs-level { color: #ff4757; }
.exec-logs-line.level-error   { color: #ffa198; }
.exec-logs-msg { flex: 1; word-break: break-word; }
.exec-logs-footer {
  margin-top: 6px;
  font-size: 0.75em;
  color: #888;
}

/* ─── Pipeline wizard ──────────────────────────────────────── */
.wizard-card {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 20px;
}
.wizard-meta {
  display: grid;
  gap: 15px;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 20px;
}
@media (max-width: 720px) { .wizard-meta { grid-template-columns: 1fr; } }
.wizard-cols {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  margin-bottom: 20px;
}
@media (max-width: 720px) { .wizard-cols { grid-template-columns: 1fr; } }
/* Mobile designer tab bar — hidden on desktop (panes show side-by-side). */
.wizard-mobile-tabs { display: none; }
.wizard-mtab {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.wizard-mtab.active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
}
@media (max-width: 720px) {
  .wizard-mobile-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
  .wiz-pane-hidden-mobile { display: none; }
  /* Single pane visible → no inter-pane grid gap needed. */
  .wizard-cols { gap: 0; }
}
.wizard-pane {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 15px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
}
.wizard-pane h4 {
  margin: 0 0 10px 0;
  color: var(--vp-c-text-1);
}
.wizard-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.wizard-filters .text-input { flex: 1; min-width: 120px; }
.wizard-catalog-list,
.wizard-editor {
  max-height: 380px;
  overflow-y: auto;
  border-top: 1px solid #eee;
  padding-top: 10px;
}
.wizard-empty {
  color: #888;
  font-size: 0.9em;
  font-style: italic;
}
.wizard-catalog-row {
  padding: 8px 10px;
  margin-bottom: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
/* Category group heading inside the stage catalog list. Sticky-ish
 * separator: stays compact, doesn't grab clicks, slight typographic
 * lift so the user can scan by category. */
.wizard-catalog-group-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 14px 0 6px 0;
  padding: 6px 10px;
  font-size: 0.78em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #4b5563;
  background: linear-gradient(90deg, #f3f4f6, transparent);
  border-left: 3px solid #9ca3af;
  user-select: none;
}
.wizard-catalog-group-head:first-child { margin-top: 4px; }
.wizard-catalog-group-count {
  background: #e5e7eb;
  color: #374151;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 0.85em;
  font-weight: 600;
}
.wizard-catalog-row:hover {
  border-color: #2196f3;
}
.wizard-catalog-row-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.wizard-catalog-row-tag {
  font-size: 0.75em;
  color: #888;
}
.wizard-catalog-row-desc {
  color: #666;
  font-size: 0.9em;
  margin-top: 4px;
}
.wizard-editor-row {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}
.wizard-editor-row-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.wizard-editor-row-actions {
  display: flex;
  gap: 4px;
}
.wizard-editor-arg {
  margin-top: 6px;
}
.wizard-editor-arg label {
  font-size: 0.85em;
  color: var(--vp-c-text-2);
  display: block;
  margin-bottom: 3px;
}
.wizard-arg-type {
  color: var(--vp-c-text-3);
  font-weight: normal;
}
.wizard-arg-desc {
  color: #6b7280;
  font-weight: normal;
  font-size: 0.92em;
  margin-left: 4px;
}
.wizard-arg-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.9em;
}
.wizard-pipeline-settings {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 12px 14px;
  margin-bottom: 12px;
  background: #f7f8fc;
  border: 1px solid #e6e8ef;
  border-radius: 10px;
}
.wizard-setting {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
}
.wizard-setting select { min-width: 180px; }
.wizard-setting-hint {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.78rem;
  color: #6b7280;
  font-weight: 400;
}
.wizard-setting-warn {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.82rem;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 8px 10px;
}
.wizard-yaml {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px;
  border-radius: 8px;
  max-height: 260px;
  overflow-y: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  margin: 0 0 15px 0;
}
.wizard-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.wizard-status {
  margin-left: 8px;
  font-size: 0.9em;
}
.wizard-status-error   { color: #ef4444; }
.wizard-status-success { color: #22c55e; }
.wizard-status-info    { color: var(--vp-c-text-2); }

/* ─── ✨ Auto body-selector suggestion banner ─────────────── */
.body-suggestion {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-left: 3px solid var(--vp-c-brand-1, #3b82f6);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 0.88em;
}
.body-suggestion-head   { font-weight: 600; margin-bottom: 4px; }
.body-suggestion-conf   { color: var(--vp-c-text-2); font-weight: 400; }
.body-suggestion-paywall{
  margin: 4px 0; padding: 6px 8px; border-radius: 6px;
  background: rgba(239, 68, 68, 0.1); color: #ef4444;
}
.body-suggestion-sel    { margin: 4px 0; }
.body-suggestion-sel code { font-size: 0.95em; }
.body-suggestion-method { margin-left: 8px; color: var(--vp-c-text-2); }
.body-suggestion-why    { color: var(--vp-c-text-2); margin: 4px 0; font-style: italic; }
.body-suggestion-actions{ margin-top: 8px; display: flex; gap: 8px; }

/* ─── TEMP collaudo gate (remove when done) ─── */
.demo-gate {
  position: fixed; inset: 0; z-index: 100000;
  background: var(--vp-c-bg, #fff);
  display: flex; align-items: center; justify-content: center;
}
.demo-gate-box {
  max-width: 380px; width: 90%; text-align: center; padding: 30px;
  border: 1px solid var(--vp-c-divider, #e2e2e2); border-radius: 14px;
  background: var(--vp-c-bg-soft, #f6f6f6); box-shadow: 0 8px 30px rgba(0,0,0,.08);
}
.demo-gate-title { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
.demo-gate-msg { color: var(--vp-c-text-2, #666); font-size: 14px; margin-bottom: 18px; }
.demo-gate-input { width: 100%; box-sizing: border-box; margin-bottom: 12px; }
.demo-gate-error { color: #e53935; font-size: 13px; margin-top: 12px; }

.picker-phase-ai { display: flex; gap: 8px; margin-top: 10px; width: 100%; flex-wrap: wrap; }
.picker-phase-ai .text-input { flex: 1; min-width: 220px; }

/* ─── Small / ghost / danger button variants ──────────────── */
.btn-sm  { padding: 6px 12px; font-size: 0.85rem; }
.btn-xs  { padding: 2px 8px;  font-size: 0.8rem; }
.btn-ghost {
  background: #eee;
  /* Was #333 — washed out on the soft gray background. Bump to near-
     black so the label is legible on both light and dark sections. */
  color: #111;
  font-weight: 600;
}
.btn-ghost:hover { background: #ddd; color: #000; }
.btn-danger {
  background: #c0392b;
  color: white;
}
.btn-danger:hover { background: #a83227; }
.btn-danger:disabled { background: #d0d0d0; cursor: not-allowed; }

.text-input {
  width: 100%;
  padding: 8px 12px;
  border: 2px solid var(--vp-c-divider);
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.95rem;
  /* Theme-aware: was a fixed `background:white` with no color, which left
     VitePress's light text on white = invisible in dark mode. */
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.text-input:focus {
  border-color: var(--vp-c-brand-1);
  outline: none;
}

/* ─── Wizard: suggestion chips, validation, missing-arg highlight ─── */
.wizard-empty-state {
  color: #888;
  font-size: 0.9em;
  font-style: italic;
}
.wizard-chips {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.wizard-chips-label {
  color: #888;
  font-size: 0.8em;
  margin-right: 4px;
}
.wizard-chip {
  background: rgba(102, 126, 234, 0.10);
  color: #2c4cb0;
  border: 1px solid rgba(102, 126, 234, 0.25);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.78em;
  cursor: pointer;
  transition: background 0.15s ease;
}
.wizard-chip:hover {
  background: rgba(102, 126, 234, 0.20);
}
.wizard-field-chips {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}
.wizard-field-chips-label {
  color: #888;
  font-size: 0.76em;
  margin-right: 2px;
}
.wizard-field-chip {
  background: rgba(46, 160, 67, 0.10);
  color: #1a7f37;
  border: 1px solid rgba(46, 160, 67, 0.30);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.76em;
  cursor: pointer;
  transition: background 0.15s ease;
}
.wizard-field-chip:hover {
  background: rgba(46, 160, 67, 0.20);
}
.wizard-field-chip.active {
  background: #1a7f37;
  color: #fff;
  border-color: #1a7f37;
}
.wizard-arg-required {
  color: #b00020;
  font-weight: 600;
  margin-left: 2px;
}
.wizard-arg-missing {
  border-color: #f0a0a0 !important;
  background: #fff7f7 !important;
}
.wizard-validation {
  background: #fff5f5;
  border: 1px solid #f0c0c0;
  border-radius: 6px;
  padding: 10px 14px;
  color: #8a1f1f;
  font-size: 0.88em;
  margin: 12px 0;
}
.wizard-validation ul {
  margin: 6px 0 0 18px;
  padding: 0;
}
.wizard-validation li {
  margin: 2px 0;
}
.wizard-validation-hint {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 6px;
  padding: 10px 14px;
  color: #614700;
  font-size: 0.85em;
  margin: 12px 0;
}
.wizard-validation-hint ul {
  margin: 6px 0 0 18px;
  padding: 0;
}
.wizard-validation-hint li {
  margin: 2px 0;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* ─── Wizard: AI suggester ─────────────────────────────────── */
.wizard-intent-row {
  display: flex;
  gap: 8px;
}
.wizard-intent-row .text-input { flex: 1; }
.wizard-suggest-btn { white-space: nowrap; }
.wizard-suggested {
  background: rgba(102, 126, 234, 0.06);
  border: 1px solid rgba(102, 126, 234, 0.25);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 18px;
}
.wizard-suggested-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.wizard-suggested-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.wizard-suggested-arrow {
  color: #888;
  font-weight: 600;
}
.wizard-chip-ai {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.18), rgba(118, 75, 162, 0.18));
  color: #2c4cb0;
  border-color: rgba(102, 126, 234, 0.45);
  font-weight: 600;
}
.wizard-chip-ai:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.30), rgba(118, 75, 162, 0.30));
}
.wizard-suggested-hint {
  color: #888;
  font-size: 0.75em;
  margin-top: 6px;
}
.wizard-suggested-err {
  color: #b00020;
  font-size: 0.9em;
}

/* ─── Picker modal (selector + action recorder) ────────────── */
.wizard-arg-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.wizard-arg-input-row .wizard-arg-input { flex: 1; }
.wizard-pick-btn { white-space: nowrap; }

.picker-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.picker-modal {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border-radius: 12px;
  /* Use most of the screen — sites like ebay/amazon don't fit in 1100px
     and force their own horizontal scroll that the picker can't see. */
  width: min(95vw, 1600px);
  /* Use ~full viewport so action-record panel (with "Use this URL" CTA at
     the bottom) is never pushed below the fold.  Previously capped at
     900px which caused an outer scrollbar on common laptop displays. */
  height: min(98vh, 1280px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  position: relative; /* anchor for the absolute loading overlay */
}
.picker-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafbfc;
  flex-wrap: wrap;
}
.picker-mode-tabs {
  display: flex;
  gap: 6px;
  flex: 1;
  justify-content: center;
}
.picker-tab {
  background: #eee;
  /* Tab labels were inheriting the VitePress grey text — illegible on
     the soft-grey tab bg. Force near-black; the active tab inverts to
     white on a gradient bg so it stays distinguishable. */
  color: #111;
  font-weight: 600;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.85em;
  cursor: pointer;
}
.picker-tab:hover:not(.active) { background: #ddd; color: #000; }
.picker-tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: #667eea;
}
.picker-modal-url {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
}
.picker-modal-url .text-input { flex: 1; }
.picker-modal-body {
  flex: 1;
  position: relative;
  background: #f5f5f5;
  min-height: 0;
  /* Allow the modal body itself to scroll both axes when the iframe is
     wider/taller than the available space. The iframe renders at a
     fixed desktop viewport (see .picker-iframe) so target sites like
     ebay/amazon get the layout they were designed for. */
  overflow: auto;
}
.picker-iframe {
  /* Render at a typical desktop viewport so site CSS doesn't collapse
     to mobile mode. The modal body scrolls when this exceeds the modal
     width — gives the user the horizontal scrollbar that was missing. */
  width: 1440px;
  min-width: 100%;
  height: 100%;
  min-height: 700px;
  border: 0;
  display: block;
}
.picker-empty {
  padding: 32px;
  text-align: center;
  color: #888;
  font-style: italic;
}
/* Mirror hint banner shown once per session above the iframe. */
.picker-mirror-hint {
  padding: 8px 14px;
  background: #fffbe6;
  border-bottom: 1px solid #ffe58f;
  color: #614700;
  font-size: 0.85em;
  line-height: 1.4;
}
/* Resume banner — shown when a previous stage parked the Camoufox tab. */
.picker-resume-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: #e8f1ff;
  border-bottom: 1px solid #b6d4fe;
  color: #103a78;
  font-size: 0.9em;
}
.picker-resume-banner code {
  background: rgba(255,255,255,0.5);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.92em;
}
.picker-resume-age { color: #5878a8; font-size: 0.85em; margin-left: 6px; }
.picker-resume-actions { display: flex; gap: 6px; flex-shrink: 0; }
/* "Address bar" — current URL of the live Camoufox tab + back button. */
.picker-address-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  background: #f8f9fa;
  border-bottom: 1px solid #e5e5e5;
  font-size: 0.85em;
  min-width: 0;
}
.picker-back-btn {
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 0.85em;
  cursor: pointer;
  color: #333;
}
.picker-back-btn:hover:not(:disabled) { background: #eef; border-color: #99b; }
.picker-back-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.picker-address-label { color: #888; flex-shrink: 0; }
.picker-address-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  color: #333;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
/* Step-in-progress overlay sitting on top of the iframe. Stays inside
   the .picker-modal-body so it scrolls with the body (sticky-ish via
   position:sticky) — but we use position:absolute pinned to viewport
   center for the card so it's visible even on long pages. */
.picker-overlay {
  position: absolute;
  inset: 0;
  background: rgba(245, 245, 245, 0.55);
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none; /* let the user still see the page; clicks are
                            blocked by the actual click forwarding being
                            queued. Avoids double-clicks while waiting. */
}
.picker-overlay-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px 18px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  display: flex;
  align-items: center;
  max-width: 460px;
  pointer-events: auto;
}
.picker-overlay-text {
  display: flex;
  flex-direction: column;
  font-size: 0.9em;
  color: #333;
}
.picker-overlay-elapsed {
  font-size: 0.75em;
  color: #888;
  margin-top: 2px;
}
.picker-action-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
}
.picker-stage-hint {
  background: #f0f7ff;
  border-left: 3px solid #2196f3;
  padding: 6px 10px;
  margin: 6px 0 8px;
  color: #14365b;
  font-size: 0.82em;
}
/* Phase-switch CTA: prominent enough that the user notices it as the
   next step but not jarring while they're navigating. */
/* Inline editor inside the multi-field picker modal. */
.picker-multi-fields-table {
  width: 100%;
  margin-top: 6px;
  border-collapse: collapse;
  font-size: 0.85em;
}
.picker-multi-fields-table thead th {
  text-align: left;
  color: #666;
  font-weight: 600;
  padding: 2px 6px;
  border-bottom: 1px solid #eee;
}
.picker-multi-fields-table td {
  padding: 3px 6px;
  vertical-align: middle;
  border-bottom: 1px solid #f4f4f4;
}
.picker-multi-fields-table td input.text-input {
  width: 100%;
  font-size: 0.9em;
  padding: 2px 6px;
}
.picker-multi-sel {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.78em;
  color: #555;
  background: #f5f5f5;
  padding: 1px 4px;
  border-radius: 3px;
}
.picker-multi-sample {
  color: #888;
  font-size: 0.82em;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-phase-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fff7ed;
  border-left: 4px solid #f59e0b;
  padding: 8px 12px;
  margin: 6px 0 8px;
  border-radius: 4px;
  font-size: 0.88em;
  color: #614700;
}
.picker-phase-cta strong { color: #5a3b00; }
/* Pre-Send drafted-but-not-replayed YAML uses a muted style so it
   doesn't compete with the post-Send commit panel below. */
.picker-actions-draft {
  opacity: 0.75;
  border-left: 3px solid #cbd5e1;
}
/* Post-Send commit panel — green border to signal "ready to save". */
.picker-committed-panel {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-left: 4px solid #16a34a;
  border-radius: 4px;
}
.picker-committed-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}
.picker-committed-head strong { color: #14532d; }
.picker-committed-hint { color: #4d7059; font-size: 0.82em; }
.picker-apply-trace {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.picker-apply-trace label { color: #14532d; font-size: 0.9em; }
.picker-apply-select { max-width: 260px; }
.picker-empty-small {
  padding: 8px 14px;
  color: #888;
  font-size: 0.85em;
}
.picker-result {
  border-top: 1px solid var(--vp-c-divider);
  padding: 10px 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  max-height: 200px;
  overflow-y: auto;
}
/* Action-record panel needs full visibility for the staged-actions list +
 * the "Use this URL" / "Apply & continue" CTA at the bottom — capping at
 * 200px would hide the button behind an inner scrollbar.  Bigger min so the
 * panel is always prominent (matches the "view sotto piu grande" ask).
 * The picker-modal-body iframe (flex: 1) auto-shrinks to fit. */
.picker-result.picker-result-tall {
  max-height: none;
  overflow-y: visible;
  min-height: 220px;
}

/* Visual emphasis on "▶ Send to Camoufox" when an anti-bot challenge is
 * active. The CMP (DataDome / Cloudflare / etc.) validates mouse trace
 * timing — the user must finish gesturing inside the iframe then press
 * Send so we ship the full mousemove/down/up/key buffer in ONE call.
 * Pulse draws the eye without being obnoxious; box-shadow ring keeps it
 * legible against any modal background. */
@keyframes wr-antibot-pulse {
  0%   { box-shadow: 0 0 0 0  rgba(220, 38, 38, 0.55); }
  60%  { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
  100% { box-shadow: 0 0 0 0  rgba(220, 38, 38, 0); }
}

/* Step warnings modal — shown when /cmf/step returned 200 with a list of
 * skipped actions.  Sized smaller than the picker modal (it's a notice,
 * not a workspace) and stacks on top so the picker iframe stays intact
 * behind it. */
.step-warn-backdrop { z-index: 2100; }
.step-warn-modal {
  width: min(80vw, 800px) !important;
  height: auto !important;
  max-height: 80vh;
}
.step-warn-body { padding: 14px 18px; overflow: auto; flex: 1; }
.step-warn-intro { font-size: 0.9em; color: #4d5057; margin: 0 0 14px 0; line-height: 1.5; }
.step-warn-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
.step-warn-table th, .step-warn-table td {
  text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee;
  color: #1f2937;   /* near-black; was inheriting VitePress muted-grey */
}
.step-warn-table th { background: #fafbfc; color: #374151; font-weight: 600; }
.step-warn-table .mono {
  font-family: 'Menlo','Monaco','Courier New',monospace; font-size: 0.92em;
  color: #111827;   /* explicit dark for readability against white bg */
}
.step-warn-table .ellipsis {
  max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.step-warn-err { color: #b91c1c; font-size: 0.85em; }
.step-warn-err-block {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 10px 12px;
  border-radius: 4px;
  font-family: 'Menlo','Monaco','Courier New',monospace;
  font-size: 0.82em;
  margin: 0 0 12px 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
}
.step-warn-footer {
  padding: 10px 18px; border-top: 1px solid #e0e0e0;
  background: #fafbfc; text-align: right;
}
.btn.btn-antibot-pulse {
  animation: wr-antibot-pulse 1.6s cubic-bezier(0.66, 0, 0, 1) infinite;
  background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
  border-color: #b91c1c !important;
  color: #fff !important;
  font-weight: 700;
}
.btn.btn-antibot-pulse:disabled {
  animation: none;
  opacity: 0.65;
}
.picker-result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.picker-selector {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: 'Menlo','Monaco','Courier New',monospace;
  font-size: 0.85em;
}
.picker-matches {
  color: #555;
  font-size: 0.85em;
}
.picker-sample {
  color: #444;
  font-size: 0.85em;
  margin-bottom: 6px;
  font-style: italic;
}
.picker-actions {
  display: flex;
  gap: 8px;
}
.picker-actions-yaml {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 10px;
  border-radius: 6px;
  max-height: 140px;
  overflow-y: auto;
  font-family: 'Menlo','Monaco','Courier New',monospace;
  font-size: 12px;
  margin: 6px 0;
  white-space: pre-wrap;
}

/* ─── AI Magic panel ────────────────────────────────────────── */
.picker-ai {
  max-height: 320px;
}
.picker-ai-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.picker-ai-mode { flex: 0 0 180px; }
.picker-ai-row .text-input:not(.picker-ai-mode) { flex: 1; min-width: 200px; }
.picker-ai-err {
  color: #b00020;
  font-size: 0.85em;
  margin-bottom: 6px;
}
.picker-ai-flat-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.picker-ai-flat-seg {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.85rem;
  color: #1e3a8a;
}
.picker-ai-flat-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 0.85rem;
}
.picker-ai-flat-table th {
  text-align: left;
  background: #f3f4f6;
  padding: 4px 8px;
  color: #1f2937;
  font-weight: 600;
}
.picker-ai-flat-table td {
  padding: 4px 8px;
  border-top: 1px solid #e5e7eb;
  color: #1f2937;
}
.picker-ai-flat-table code {
  font-size: 0.8rem;
  background: #f9fafb;
  padding: 1px 4px;
  border-radius: 3px;
}
.picker-ai-flat-sample {
  color: #6b7280;
  font-size: 0.8rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-ai-flat-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.picker-ai-section {
  margin-top: 8px;
  padding: 8px;
  border-radius: 6px;
  background: #fafbfc;
  border: 1px solid #eee;
}
.picker-ai-tag {
  display: inline-block;
  font-size: 0.75em;
  padding: 2px 8px;
  border-radius: 999px;
  margin-bottom: 6px;
  font-weight: 700;
}
.picker-ai-tag.algo   { background: #fef3c7; color: #92400e; }
.picker-ai-tag.llm    { background: #d1fae5; color: #065f46; }
.picker-ai-tag.refine { background: #dbeafe; color: #1e40af; }
.picker-ai-card {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 6px 8px;
  margin: 4px 0;
}
.picker-ai-card-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 3px;
}
.picker-ai-card code {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.78em;
}
.picker-ai-conf {
  color: #888;
  font-size: 0.75em;
}
.picker-ai-why {
  color: #555;
  font-size: 0.78em;
  margin-bottom: 4px;
}
.picker-ai-refine {
  background: #eff6ff;
  border-color: #bfdbfe;
}

/* ─── Structured fields editor (extract / flatSelect) ──────── */
.wizard-fields-block {
  margin-top: 10px;
  padding: 8px 10px;
  background: #f7fafc;
  border: 1px solid #e0e6ee;
  border-radius: 6px;
}
.wizard-fields-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.wizard-fields-actions {
  display: flex;
  gap: 6px;
}
.wizard-fields-warn {
  margin: 6px 0;
  padding: 8px 10px;
  background: #fff8e1;
  border: 1px solid #f6c065;
  border-left: 4px solid #b45309;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1f2937;
  line-height: 1.45;
}
.wizard-fields-warn strong { color: #92400e; }

/* Python post-processing block — pinned visually under the pipeline
   stages list (matches the runtime semantics: always runs last). */
.wizard-python-block {
  margin-top: 18px;
  padding: 12px 14px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  border-left: 4px solid #b45309;
}
.wizard-python-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.wizard-python-head strong { color: #78350f; font-size: 0.95rem; }
.wizard-python-hint { color: #92400e; font-size: 0.82rem; flex: 1 1 100%; }
.wizard-python-entry {
  margin-top: 10px;
  padding: 8px 10px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid #fcd34d;
  border-radius: 6px;
}
.wizard-python-entry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.wizard-python-type {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: ui-monospace, monospace;
}
.wizard-python-type-row_transform       { background: #dbeafe; color: #1e3a8a; }
.wizard-python-type-dataframe_transform { background: #dcfce7; color: #14532d; }
.wizard-python-type-sql_query           { background: #fce7f3; color: #831843; }
.wizard-python-name { flex: 1; font-family: ui-monospace, monospace; }
.wizard-python-aimagic {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.wizard-python-aimagic .text-input { flex: 1; }
.wizard-python-body {
  width: 100%;
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 0.82rem;
  line-height: 1.4;
  color: #1f2937;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 8px;
  resize: vertical;
}
.wizard-python-err {
  margin-top: 6px;
  color: #b91c1c;
  font-size: 0.8rem;
  background: #fee2e2;
  border-radius: 4px;
  padding: 4px 8px;
}
.wizard-fields-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
}
.wizard-fields-table th {
  text-align: left;
  padding: 4px 6px;
  font-size: 0.75em;
  color: #777;
  font-weight: 600;
}
.wizard-fields-table td {
  padding: 4px 6px;
  vertical-align: middle;
}
.wizard-fields-table .text-input {
  padding: 4px 6px;
  font-size: 0.85em;
}
.wizard-field-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
/* One-click resolver/attribute chips under the method dropdown. */
.wizard-attr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
}
.wizard-attr-chip {
  font-size: 0.72em;
  line-height: 1;
  padding: 3px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  white-space: nowrap;
}
.wizard-attr-chip:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-text-1); }
.wizard-attr-chip.active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
}
.wizard-field-sample {
  color: #888;
  font-size: 0.75em;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wizard-trace-badge {
  background: #1f2937;
  color: white;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.7em;
  font-weight: 600;
  margin-left: 6px;
}
.wizard-trace-block {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #1f2937;
  border-radius: 4px;
}
.wizard-trace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.wizard-trace-head strong { color: #1f2937; font-size: 0.9em; }
.wizard-trace-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.wizard-trace-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  font-size: 0.85em;
}
.wizard-trace-action code {
  flex: 1;
  background: transparent;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.wizard-trace-del { color: #94a3b8; }
.wizard-trace-del:hover { color: #dc2626; }

/* ─── Multi-field picker panel ─────────────────────────────── */
.picker-multi {
  background: #fff7ed;
  border-top: 1px solid #fed7aa;
}
.picker-multi-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 6px;
}
.picker-multi-target {
  color: #555;
  font-size: 0.85em;
}
.picker-multi-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.picker-multi-row .text-input { flex: 1; min-width: 200px; }
.picker-multi-hint {
  color: #888;
  font-size: 0.78em;
}

.picker-strategy-tabs {
  display: flex;
  gap: 4px;
  margin: 0 8px;
}
.picker-tab-small {
  background: #eee;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 0.72em;
  cursor: pointer;
  color: #555;
}
.picker-tab-small.active {
  background: #1f2937;
  color: white;
  border-color: #1f2937;
}
.picker-tab-small:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Validate-selectors modal ─────────────────────────────────── */
/* 🔗 Variabili modal */
.vardetect-modal { width: min(92vw, 720px); max-height: 88vh; }
.vardetect-body { padding: 16px 18px; overflow-y: auto; }
.vardetect-intro { font-size: 0.9em; color: #374151; margin: 0 0 14px; line-height: 1.5; }
.vardetect-cols { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.vardetect-cols label { width: 100%; font-size: 0.85em; color: #4b5563; font-weight: 600; }
.vardetect-cols .text-input { flex: 1; min-width: 220px; }
.vardetect-empty { font-size: 0.9em; color: #6b7280; padding: 10px 0; }
.vardetect-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: #fafafa; }
.vardetect-q { font-weight: 600; color: #111827; margin-bottom: 6px; }
.vardetect-meta { font-size: 0.8em; color: #6b7280; margin-bottom: 8px; }
.vardetect-meta code { background: #eef2ff; padding: 1px 5px; border-radius: 4px; }
.vardetect-choice { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 0.9em; }
.vardetect-choice .text-input { min-width: 180px; padding: 4px 8px; }
.vardetect-actions { display: flex; gap: 10px; margin-top: 8px; }
.vardetect-note { font-size: 0.78em; color: #9ca3af; margin-top: 12px; line-height: 1.5; }
.validate-modal { width: min(95vw, 1500px); height: min(92vh, 880px); }
.validate-modal-header strong { flex: 1; color: #111827; font-size: 1.02em; }
.validate-close-btn { white-space: nowrap; }
.validate-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid #e0e0e0;
  background: #fafbfc;
}
.validate-footer-summary { flex: 1; color: #374151; font-size: 0.88em; }
.validate-footer-ok { color: #166534; }
.validate-footer-ko { color: #b91c1c; }
.validate-body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
  gap: 0;
  overflow: hidden;
}
.validate-left {
  padding: 14px 16px;
  overflow-y: auto;
  border-right: 1px solid #e0e0e0;
  background: #fafbfc;
}
.validate-right {
  padding: 14px 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.validate-status {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.9em;
  margin-bottom: 12px;
  background: #eef2f6;
  color: #374151;
}
.validate-status-running { background: #fff7ed; color: #9a3412; }
.validate-status-success { background: #ecfdf5; color: #166534; }
.validate-status-error   { background: #fef2f2; color: #b91c1c; }
.validate-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.validate-took { color: #6b7280; font-size: 0.85em; }
.validate-steps h5,
.validate-records h5,
.validate-right h5 { margin: 4px 0 8px 0; font-size: 0.95em; color: #1f2937; }
.validate-steps ol {
  margin: 0 0 14px 0;
  padding-left: 18px;
  font-size: 0.86em;
  line-height: 1.45;
}
.validate-steps li { margin-bottom: 3px; }
.validate-step-running { color: #9a3412; }
.validate-step-ok      { color: #166534; }
.validate-step-skipped { color: #6b7280; }
.validate-step-error   { color: #b91c1c; }
.validate-step-status { margin: 0 6px; font-size: 0.78em; color: inherit; opacity: 0.85; }
.validate-step-msg { color: #374151; }
.validate-records-scroll { max-height: 280px; overflow: auto; border: 1px solid #e0e0e0; border-radius: 6px; background: #ffffff; }
.validate-records-table { width: 100%; border-collapse: collapse; font-size: 0.82em; background: #ffffff; color: #111827; }
.validate-records-table th,
.validate-records-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: top;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
}
.validate-records-table th { background: #f3f4f6; font-weight: 600; color: #1f2937; position: sticky; top: 0; }
.validate-records-table td { color: #111827; }
.validate-error { margin-top: 12px; padding: 10px 12px; background: #fef2f2; color: #b91c1c; border-radius: 6px; font-size: 0.88em; }
.validate-iframe-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.9em;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
}
.validate-iframe { flex: 1; width: 100%; border: 1px solid #e0e0e0; border-radius: 6px; background: white; }
.validate-final-url { font-size: 0.78em; color: #6b7280; margin-top: 6px; word-break: break-all; }

/* ──────────────────────────────────────────────────────────────
 * Mobile responsiveness pass (≤768px = tablet portrait, ≤480px = phone)
 *
 * The custom CSS above this point was authored for desktop and the
 * existing 768px block at line ~6032 only covers a handful of
 * selectors. This block sweeps the high-impact layouts so the demo
 * is actually usable on a phone:
 *   - any responsive grid collapses to a single column;
 *   - flex rows wrap or stack vertically;
 *   - buttons stretch to full width and group as columns;
 *   - tables get horizontal scroll instead of overflowing the body;
 *   - code blocks force-wrap so curl examples don't push the
 *     viewport wider than the screen;
 *   - sticky elements (exec-panel, modal) shrink to fit.
 * ──────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  /* Section spacing — give back horizontal room */
  .demo-app { padding: 0 0.75rem; }           /* was 0 2rem — 64px stolen on a phone */
  .demo-section { padding: 1rem; margin: 1rem 0; }
  .demo-section h2 { font-size: 1.2rem; }
  .demo-section > p { font-size: 0.9rem; }

  /* ── Pipeline designer: stop it rendering "too wide" on phones ──
     The two-pane catalog|editor grid already collapses to 1 column at
     720px, but the panes kept desktop padding + an inner 380px scroll
     box, and long YAML / arg tokens could push the page wider than the
     viewport. Tighten padding, let grid children shrink (min-width:0),
     drop the nested scroll so the page scrolls naturally, and force
     long unbreakable strings to wrap instead of overflowing. */
  .wizard-card { padding: 14px; max-width: 100%; overflow-x: hidden; }
  .wizard-cols, .wizard-meta { min-width: 0; }
  .wizard-pane { padding: 12px; min-width: 0; }
  .wizard-catalog-list, .wizard-editor { max-height: none; }
  .wizard-yaml { overflow-x: auto; overflow-wrap: anywhere; word-break: break-word; }
  .wizard-catalog-row-desc, .wizard-arg-desc, .wizard-chip { overflow-wrap: anywhere; }

  /* All multi-column auto-fill grids → single column */
  .demo-grid,
  .private-demos-grid,
  .pipelines-grid,
  .results-grid,
  .images-grid,
  .demos-grid,
  .wizard-cols,
  .wizard-meta,
  .auth-tabs-content {
    grid-template-columns: 1fr !important;
    gap: 0.75rem;
  }

  /* Pipeline / dataset / job cards — full width, shorter padding */
  .pipeline-card,
  .private-demo-card,
  .demo-card,
  .stat-item {
    width: 100%;
    padding: 0.75rem;
  }

  /* Common flex rows: wrap, then stack */
  .pipeline-meta,
  .pipeline-actions,
  .result-stats,
  .generation-actions,
  .exec-meta,
  .exec-actions,
  .auth-status-bar,
  .auth-form-row,
  .api-guide-header,
  .picker-toolbar,
  .picker-ai-row,
  .picker-multi-row,
  .wizard-actions,
  .wizard-filters,
  .demo-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  /* Buttons full-width inside stacked rows */
  .btn,
  .btn-primary,
  .btn-secondary,
  .btn-success,
  .btn-danger,
  .btn-icon {
    width: 100%;
    justify-content: center;
    min-height: 40px; /* easier tap target */
  }
  /* But keep inline icon buttons inside rows compact */
  .picker-toolbar .btn-icon,
  .wizard-actions .btn-icon,
  .exec-actions .btn-icon {
    width: auto;
    min-width: 40px;
  }

  /* Tables: horizontal scroll inside their wrapper, smaller font */
  .results-table-wrapper,
  .columns-table-wrapper,
  .preview-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .results-table,
  .columns-table,
  .preview-table {
    font-size: 0.78rem;
    min-width: 480px; /* let horizontal scroll kick in */
  }

  /* Execution panel — kill the sticky/full-width behaviour */
  .exec-panel {
    position: relative;
    top: auto;
    width: 100%;
  }
  .exec-phase-row { flex-wrap: wrap; }
  .exec-phase-pods { flex-direction: column; align-items: flex-start; }

  /* Logs viewer: shrink ts column, allow content to wrap */
  .exec-logs-line { flex-wrap: wrap; }
  .exec-logs-ts    { min-width: 0; font-size: 0.7rem; }
  .exec-logs-level { min-width: 0; }
  .exec-logs-body { white-space: pre-wrap; word-break: break-word; }

  /* Code blocks (curl examples) — wrap aggressively */
  .code-block,
  pre.code-block,
  .api-guide pre {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    font-size: 0.78rem;
    padding: 0.6rem;
  }

  /* Modal / picker — fit the screen */
  .picker-modal,
  .picker-modal-content,
  .upload-modal,
  .auth-modal {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  .picker-iframe-wrapper { height: 60vh; }

  /* Pipeline meta tags / status pills — wrap so they don't overflow */
  .pipeline-tags,
  .pipeline-status,
  .exec-phase-pill { flex-wrap: wrap; }

  /* Hero / intro headlines lighter on mobile */
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.25rem; }
  h3 { font-size: 1.05rem; }
}

@media (max-width: 480px) {
  /* Extra-tight pass for phones in portrait */
  .demo-section { padding: 0.75rem; }
  .pipeline-card,
  .private-demo-card,
  .demo-card { padding: 0.6rem; }
  .results-table,
  .columns-table,
  .preview-table { font-size: 0.72rem; }
  .exec-logs-body { font-size: 0.72rem; }
  /* Stat values stay readable, labels shrink */
  .stat-label { font-size: 0.7rem; }
  .stat-value { font-size: 0.95rem; }
}

/* ────────────────────────────────────────────────────────────────
 * Mobile pass 2 — components added after the original responsive
 * sweep. Without these the new HITL bell, python extensions editor,
 * AI Magic flatSelect preview and picker tabs overflow on phones.
 * ──────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  /* Validate-selectors modal: the two-pane body is a fixed
     minmax(420px,420px) grid (~840px) that overflows a 100vw phone/
     tablet modal. Collapse to a single column and let it scroll
     vertically; swap the left pane's right-border to a bottom-border. */
  .validate-body { grid-template-columns: 1fr; overflow-y: auto; }
  .validate-left { border-right: 0; border-bottom: 1px solid var(--vp-c-divider); }
  /* Intent row: stack the input above its suggest button. */
  .wizard-intent-row { flex-direction: column; align-items: stretch; }
  .wizard-intent-row .btn { width: 100%; }
  /* HITL notification bell — pinned bottom-right on mobile so it
     doesn't overlap the VitePress sticky topbar / nav drawer that
     occupies the top edge on touch. */
  .cmf-notif-bell-wrap {
    top: auto;
    bottom: 20px;
    right: 16px;
  }
  .cmf-notif-bell { padding: 8px 12px; font-size: 1rem; }
  .cmf-notif-dropdown {
    /* Don't claim 340px on a 360px viewport — let it span almost the
       full width and anchor under the bell. */
    top: auto;
    bottom: 56px;
    right: 0;
    min-width: 0;
    width: calc(100vw - 32px);
    max-width: 360px;
  }

  /* Picker mode tabs (Single / List / Repeating / Record / AI Magic):
     wrap onto multiple rows, tighter padding, keep them legible. */
  .picker-modal-header { padding: 8px; gap: 6px; }
  .picker-mode-tabs    { flex-wrap: wrap; gap: 4px; justify-content: flex-start; }
  .picker-tab          { padding: 4px 8px; font-size: 0.78em; }
  .picker-strategy-tabs { flex-wrap: wrap; }

  /* Picker iframe: keep its 1440px desktop layout (sites expect it)
     but let the modal body scroll horizontally on small screens.
     Cap height so the action panel below the iframe stays in view. */
  .picker-iframe { min-height: 380px; height: 50vh; }
  .picker-iframe-wrapper, .picker-modal-body { max-height: 60vh; }

  /* Apply panel + committed panel + multi-field result panel — stack
     their flex rows so buttons aren't squeezed off-screen. */
  .picker-apply-trace { flex-direction: column; align-items: stretch; }
  .picker-apply-select { max-width: 100% !important; }
  .picker-committed-head { flex-wrap: wrap; }

  /* AI Magic flatSelect preview table — overflow scroll instead of
     squashing column widths to illegible. */
  .picker-ai-flat-head { flex-wrap: wrap; }
  .picker-ai-flat-seg  { max-width: 100%; word-break: break-all; white-space: normal; }
  .picker-ai-flat-table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    min-width: 0;
  }
  .picker-ai-flat-sample { max-width: 120px; }

  /* Python post-processing block — stack header, full-width buttons +
     full-width name input, code textarea fills the row. */
  .wizard-python-block { padding: 10px; }
  .wizard-python-head  { flex-direction: column; align-items: stretch; gap: 6px; }
  .wizard-python-head .btn { width: 100%; }
  .wizard-python-entry { padding: 8px; }
  .wizard-python-entry-head { flex-wrap: wrap; }
  .wizard-python-name  { width: 100%; flex: 1 0 100%; }
  .wizard-python-aimagic { flex-direction: column; gap: 6px; }
  .wizard-python-body  { font-size: 0.75rem; min-height: 160px; }

  /* Fields editor (extract / flatSelect): stack actions, smaller
     table fonts, allow horizontal scroll on the fields table. */
  .wizard-fields-head    { flex-direction: column; align-items: stretch; gap: 6px; }
  .wizard-fields-actions { flex-direction: column; gap: 6px; }
  .wizard-fields-actions .btn { width: 100%; }
  .wizard-fields-table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    font-size: 0.78rem;
  }

  /* Stage / arg input rows: stack the "[input] [🎯 Pick]" pair so the
     pick button doesn't squeeze the field. */
  .wizard-arg-input-row { flex-direction: column; align-items: stretch; gap: 4px; }
  .wizard-arg-input-row .btn { width: 100%; }

  /* Notification dropdown buttons — keep them inline ("Apri mirror" /
     "Ignora" pair), but constrain so they don't blow past the dropdown
     width on the smallest screens. */
  .cmf-notif-actions { flex-wrap: wrap; }
  .cmf-notif-actions .btn { flex: 1 1 auto; min-width: 0; }

  /* Trace YAML pre + wizard YAML preview wrap aggressively. */
  .picker-actions-yaml,
  .wizard-yaml { font-size: 0.72rem; padding: 6px; white-space: pre-wrap; word-break: break-word; }

  /* Banners at the top of the demo page: tighter padding, smaller
     font so they don't dominate the screen. */
  .scope-banner,
  .sovereignty-banner,
  .design-banner,
  .perf-banner { padding: 8px 10px; font-size: 0.78rem; margin-bottom: 0.75rem; line-height: 1.4; }
}

@media (max-width: 480px) {
  /* Phone-portrait extras for the new sections. */
  .cmf-notif-dropdown { max-width: 90vw; }
  .wizard-python-body { font-size: 0.72rem; min-height: 140px; }
  .picker-mode-tabs   { gap: 3px; }
  .picker-tab         { padding: 3px 6px; font-size: 0.72em; }
  .picker-iframe      { min-height: 320px; height: 45vh; }
  /* Variabili modal: let the column + per-field inputs go full-width
     instead of forcing their 220/180px min-width (which overflows
     two-up on a ~375px phone). */
  .vardetect-cols .text-input,
  .vardetect-choice .text-input { min-width: 0; width: 100%; }
  .vardetect-choice { flex-direction: column; align-items: stretch; }
}
</style>


