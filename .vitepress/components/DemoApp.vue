<template>
  <div class="demo-app">

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

        <div class="wizard-cols">
          <!-- Catalog browser -->
          <div class="wizard-pane">
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
              <div
                v-for="s in wizFilteredCatalog"
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
            </div>
          </div>

          <!-- Pipeline editor -->
          <div class="wizard-pane">
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
                    <button v-if="!isStructuredFieldsStage(row.stage)"
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
                                ? 'Open the picker in multi-field mode — click each field on the page'
                                : 'flatSelect: imposta prima il selettore di riga (segmentSelector/selector) qui sotto, poi torna qui per i fields'"
                              @click="openMultiFieldPicker(idx)">🎯 Pick fields</button>
                      <button class="btn btn-primary btn-xs"
                              :disabled="!flatSelectSegmentReady(row)"
                              :title="flatSelectSegmentReady(row)
                                ? 'Open the picker and describe the fields you want — LLM fills the table'
                                : 'flatSelect: imposta prima il selettore di riga'"
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
                              :title="flatSelectSegmentReady(row) ? 'Add an empty field row' : 'flatSelect: imposta prima il selettore di riga'"
                              @click="addField(idx)">+ Add empty</button>
                    </div>
                  </div>
                  <!-- flatSelect 2-step flow guard: the field selectors below
                       are RELATIVE to the row segment, so picking fields
                       before the segment selector is set produces selectors
                       that don't resolve at runtime. Surface this loudly. -->
                  <div v-if="row.stage === 'flatSelect' && !flatSelectSegmentReady(row)"
                       class="wizard-fields-warn">
                    ⚠️ <strong>Prima imposta il selettore di riga</strong>
                    ({{ flatSelectSegmentArgName(row) }}) qui sotto — i field selectors
                    di questa tabella saranno relativi ad ogni riga matched. Senza un
                    segment selector valido, "Pick fields" + "AI suggest" sono disabilitati.
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
                          <select class="text-input" :value="f.method" @change="updateFieldProp(idx, fIdx, 'method', $event.target.value)">
                            <option value="text">text</option>
                            <option value="html">html</option>
                            <option value="attr:href">attr:href</option>
                            <option value="attr:src">attr:src</option>
                            <option value="attr:title">attr:title</option>
                            <option value="attr:alt">attr:alt</option>
                          </select>
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
                <div v-if="(findStageSpec(row.stage) && findStageSpec(row.stage).arg_schema || []).length === 0" class="wizard-empty">
                  no args defined for this stage
                </div>
                <div
                  v-for="a in (findStageSpec(row.stage) && findStageSpec(row.stage).arg_schema || [])"
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
                      :class="['text-input', 'wizard-arg-input', wizShowFieldErrors && a.required && (row.args[a.name] == null || String(row.args[a.name]).trim() === '') ? 'wizard-arg-missing' : '']"
                      @input="updateStageArg(idx, a.name, $event.target.value)"
                    />
                    <button
                      v-if="isSelectorArg(a)"
                      class="btn btn-secondary btn-xs wizard-pick-btn"
                      :title="pickModeFor(row.stage) === 'multi-sample'
                        ? 'Click 2+ examples of the repeating link/card you want to follow (different product cards, pagination items, …). The picker intersects them and produces a CSS selector that matches every sibling.'
                        : 'Open the page in the picker and click an element to get a CSS selector'"
                      @click="openPicker(idx, a.name, pickModeFor(row.stage))"
                    >🎯 {{ pickModeFor(row.stage) === 'multi-sample' ? 'Pick (multi)' : 'Pick' }}</button>
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

        <h4>📄 YAML preview</h4>
        <pre class="wizard-yaml">{{ wizYamlPreview }}</pre>

        <!-- Required-arg / shape validation. The banner + per-field
             red highlight only appear after the user has tried to
             save once — until then we trust them to fill the form. -->
        <div v-if="wizShowFieldErrors && wizValidationErrors.length" class="wizard-validation">
          <strong>Fix before saving:</strong>
          <ul>
            <li v-for="(err, i) in wizValidationErrors" :key="i">{{ err }}</li>
          </ul>
        </div>

        <div class="wizard-actions">
          <button class="btn btn-primary" :disabled="!wizValid" @click="wizardSaveAndRun">Save &amp; Run</button>
          <button class="btn btn-secondary" :disabled="!wizValid" @click="wizardSaveAsDraft" title="Save without running — appears in the selector above">Save (draft)</button>
          <button class="btn btn-secondary"
                  :disabled="!wizValid || validateOpen"
                  @click="openValidate"
                  title="Run the pipeline on a real Camoufox session and preview up to 5 records before launching the Spark job">🔬 Validate selectors</button>
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
            <!-- When the picker was opened from a fetch / visit / explore
                 (trace-capable) stage, the only useful mode is action
                 recording — selectors live on extract/flatSelect/etc.
                 Hide the other tabs there to reduce visual noise. -->
            <template v-if="!pickerOriginIsTraceCapable">
              <button :class="['picker-tab', pickerMode === 'selector-single' && 'active']" @click="setPickerMode('selector-single')">🎯 Single</button>
              <button :class="['picker-tab', pickerMode === 'selector-list'   && 'active']" @click="setPickerMode('selector-list')">📋 List</button>
              <button :class="['picker-tab', pickerMode === 'multi-sample'    && 'active']"
                      title="Click 2+ examples of the repeating link/card you want the crawler to follow. The picker generalises a CSS selector that matches all of them — meant for explore-stage args."
                      @click="setPickerMode('multi-sample')">📍 Repeating</button>
            </template>
            <button :class="['picker-tab', pickerMode === 'action-record'   && 'active']" @click="setPickerMode('action-record')">⏺ Record actions</button>
            <button v-if="!pickerOriginIsTraceCapable" :class="['picker-tab', pickerMode === 'ai-magic' && 'active']" @click="setPickerMode('ai-magic')">🪄 AI Magic</button>
          </div>
          <div class="picker-strategy-tabs" title="wget = fast HTTP (static sites). Camoufox = real browser (JS-heavy / Cloudflare-protected). Required for Record actions.">
            <button :class="['picker-tab-small', pickerStrategy === 'wget' && 'active']"
                    :disabled="pickerMode === 'action-record'"
                    @click="setPickerStrategy('wget')">wget</button>
            <button :class="['picker-tab-small', pickerStrategy === 'cmf' && 'active']"
                    @click="setPickerStrategy('cmf')">Camoufox</button>
          </div>
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
          <button class="btn btn-primary btn-sm" @click="loadPickerUrl">Load page</button>
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
          <div v-else-if="pickerLoadError" class="picker-empty" style="color:#b00020;">
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
            <input v-model="aiIntent" type="text" class="text-input" placeholder="describe the fields (e.g. name, price, rating, link)"
              @keyup.enter="runAutoSuggestFields">
            <button class="btn btn-primary btn-sm" :disabled="aiLoading || !aiIntent.trim()" @click="runAutoSuggestFields">
              <span v-if="aiLoading" class="loading-spinner"></span>
              {{ aiLoading ? 'Thinking…' : '🪄 Auto-suggest fields' }}
            </button>
            <button class="btn btn-secondary btn-sm"
                    :disabled="suggestNamesLoading || !((currentStageFields).length)"
                    @click="suggestFieldNamesFromModal">
              <span v-if="suggestNamesLoading" class="loading-spinner"></span>
              🪄 Suggest names
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
            </select>
            <input
              v-model="aiIntent"
              type="text"
              class="text-input"
              :placeholder="aiMode === 'actions' ? 'e.g. search for laptops and click submit' : 'e.g. the next-page link at the bottom of the catalogue'"
              @keyup.enter="runAiMagic"
            />
            <button class="btn btn-primary btn-sm" :disabled="aiLoading || !pickerLoadedUrl" @click="runAiMagic">
              <span v-if="aiLoading" class="loading-spinner"></span>
              {{ aiLoading ? 'Thinking…' : '🪄 Suggest' }}
            </button>
          </div>
          <div v-if="aiError" class="picker-ai-err">{{ aiError }}</div>

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
        <div v-if="pickerMode === 'action-record'" class="picker-result">
          <div class="picker-result-row">
            <strong>
              <span v-if="pickerStrategy === 'cmf'">📥 Staged actions: {{ pickerActions.length }}</span>
              <span v-else>Recorded actions: {{ pickerActions.length }}</span>
            </strong>
            <div class="picker-action-buttons">
              <button v-if="pickerStrategy === 'cmf'"
                      class="btn btn-primary btn-sm"
                      :disabled="pickerLoading || pickerActions.length === 0"
                      @click="sendStagedActionsToCamoufox"
                      title="Replay the whole queue on the live Camoufox tab, then refresh the iframe">
                ▶ Send to Camoufox ({{ pickerActions.length }})
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
          </div>
          <!-- Pre-Send draft view: just lets the user see WHAT is queued
               and clear it. No "Apply to trace" here — that would
               freeze a draft that hasn't been replayed yet and could
               easily mismatch the live Camoufox tab. -->
          <pre v-if="pickerActionsYaml" class="picker-actions-yaml picker-actions-draft">{{ pickerActionsYaml }}</pre>
          <div v-if="pickerActionsYaml" class="picker-actions">
            <button class="btn btn-ghost btn-sm" @click="pickerActions = []">Clear staged</button>
          </div>

          <!-- Apply panel: appears as soon as we have either a loaded
               URL (URL-only commit) OR committed actions (trace + URL
               commit). Lets the user save just the URL onto the fetch
               stage even when they didn't record any picker action —
               useful when the wizard is opened only to pick the target
               URL for a fetch/visit stage. -->
          <div v-if="committedActions.length || pickerOpenedUrl" class="picker-committed-panel">
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
    
    // Debug: log pipeline data to check requires_input_dataset
    console.log('Loaded demos:', demos)
    demos.forEach(demo => {
      console.log(`Pipeline: ${demo.pipeline_name}, requires_input_dataset: ${demo.requires_input_dataset}, csv_format: ${demo.csv_format_description}`)
    })
    
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
    closeUploadModal()
    // Execute with the saved datasetId
    executePipeline(datasetId)
  }
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
const wizPipelineName  = ref('')
const wizIntent        = ref('')
const wizPluginFilter  = ref('')
const wizSearch        = ref('')
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
const pickerStrategy      = ref('wget')       // 'wget' | 'cmf'
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
const aiMode         = ref('selector')   // 'selector' | 'actions'
const aiLoading      = ref(false)
const aiError        = ref(null)
const aiAlgoResults  = ref([])           // [{selector|type, confidence, why}]
const aiLlmResults   = ref([])           // same shape, second tier
const aiPickedRefined = ref(null)        // LCA refinement from picker click
const aiRawLlm       = ref(null)
const pickerProxySrc       = computed(() => {
  if (!pickerLoadedUrl.value) return ''
  return `${API_BASE_URL}/api/webrobot/api/demo/wizard/proxy?url=${encodeURIComponent(pickerLoadedUrl.value)}`
})

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
  setPickerMode(m)
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
  // Two-phase open: remember the requested mode but ENTER as
  // action-record so the user can navigate freely first. The
  // "📌 Start picking" CTA in the action-record panel promotes
  // pickerMode to pickerIntendedMode on demand.
  const requested = mode || 'selector-single'
  if (requested === 'action-record' || requested === 'ai-magic') {
    pickerIntendedMode.value = null
    pickerMode.value = requested
  } else {
    pickerIntendedMode.value = requested
    pickerMode.value = 'action-record'
  }
  pickerSelected.value = null
  pickerActions.value  = []
  pickerOpen.value = true
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
      body: JSON.stringify({ url }),
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
  } catch (e) {
    pickerLoadError.value = e.message || String(e)
    pickerHtml.value = ''
  } finally {
    pickerLoading.value = false
  }
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
async function sendStagedActionsToCamoufox() {
  if (pickerStrategy.value !== 'cmf' || !cmfSessionId.value) return
  // Flush pending Type inside the iframe; it'll bounce back a
  // webrobot-pick-actions with the final list, but to keep things
  // ordered we wait one tick and use what we already have plus what
  // arrives next.
  const ifr = document.getElementById('wr-picker-iframe')
  try { ifr && ifr.contentWindow && ifr.contentWindow.postMessage({ type: 'webrobot-picker-flush-queue' }, '*') } catch (_) {}
  await new Promise(r => setTimeout(r, 50))
  const queue = pickerActions.value.slice()
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
function pushBlockStateToIframe() {
  const ifr = document.getElementById('wr-picker-iframe')
  if (!ifr || !ifr.contentWindow) return
  try {
    if (cmfBlock.value) {
      ifr.contentWindow.postMessage({ type: 'webrobot-picker-block', block: cmfBlock.value }, '*')
    } else {
      ifr.contentWindow.postMessage({ type: 'webrobot-picker-block-clear' }, '*')
    }
  } catch (_) {}
}

// User clicked "Resolved, resume" in the iframe banner. POST /cmf/{sid}/resume —
// the backend re-runs the detector. If 200, the block is cleared and the
// trace can continue; if 409, the challenge widget is still on screen
// and the user must try again.
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
  if (cmfBlock.value) {
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
    const committable = batch.filter(a => a && a.type && a.type !== 'Back')
    if (committable.length) {
      committedActions.value = [...committedActions.value, ...committable]
      // Default the apply-dropdown to the first trace-capable stage so
      // the user only has to click Apply, not also pick a target.
      if (applyTraceStageIdx.value == null && tracableStages.value.length) {
        applyTraceStageIdx.value = tracableStages.value[0].idx
      }
    }
  } catch (e) {
    pickerLoadError.value = 'step failed: ' + (e.message || String(e))
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
  // If the user manually flipped tabs to leave action-record, they've
  // told us "I'm done navigating" — drop the deferred-intent flag so
  // the navigate-first CTA doesn't keep reappearing.
  if (m !== 'action-record') {
    pickerIntendedMode.value = null
  }
  // Translate the parent's UI mode to one the iframe picker understands.
  // AI Magic uses selector-single under the hood (so click → LCA-refine works).
  const ifrMode = m === 'ai-magic' ? 'selector-single' : m
  const ifr = document.getElementById('wr-picker-iframe')
  try { ifr && ifr.contentWindow && ifr.contentWindow.postMessage({ type: 'webrobot-picker-mode', mode: ifrMode }, '*') } catch (_) {}
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
])
function pickModeFor(stage) {
  return LIST_PICK_STAGES.has(stage) ? 'multi-sample' : 'selector-single'
}

// postMessage listener for the proxied iframe.
function onPickerMessage(ev) {
  const d = ev.data
  if (!d || typeof d !== 'object') return
  if (d.type === 'webrobot-pick-selector') {
    pickerSelected.value = {
      selector: d.selector,
      matches: d.matches,
      sampleText: d.sampleText,
      sampleHtml: d.sampleHtml,
      mode: d.mode,
    }
    aiPickedRefined.value = d.refinedFromHighlight || null
    // Field-row picker (single click from a specific field's 🎯 Pick).
    // The target arg name is encoded as "__field_selector__:<idx>" so
    // we can route the pick back to the right row.
    if (typeof pickerTargetArgName.value === 'string' &&
        pickerTargetArgName.value.indexOf('__field_selector__:') === 0) {
      const fIdx = parseInt(pickerTargetArgName.value.split(':')[1], 10)
      if (!isNaN(fIdx) && pickerTargetStageIdx.value != null) {
        updateFieldProp(pickerTargetStageIdx.value, fIdx, 'selector', d.selector)
        closePicker()
      }
    }
  } else if (d.type === 'webrobot-pick-multi-field') {
    // Multi-field picker accumulates clicks. Each click appends a new
    // field row on the target stage.
    if (pickerTargetStageIdx.value != null) {
      const stageIdx = pickerTargetStageIdx.value
      const fields = ensureFieldsArray(stageIdx) || []
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
        if (/href/i.test(d.selector || '')) return 'attr:href'
        if (/img/i.test(d.selector || '')) return 'attr:src'
        return 'text'
      })()
      wizPipeline.value[stageIdx]._fields = [
        ...fields,
        { selector: d.selector, as: guess, method, _color: d.color, _sample: d.sampleText },
      ]
      wizPipeline.value = [...wizPipeline.value]
    }
  } else if (d.type === 'webrobot-picker-multi-warn') {
    // Surface the warning briefly (e.g. clicked outside flatSelect container).
    wizStatus.value = { kind: 'error', text: d.warn || 'click was outside the segment container' }
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
    // Auto-send from picker.js: the user clicked a non-editable target
    // (link, button, submit) which picker.js treats as the commit
    // gesture for the staged queue. Forward the batch and clear the
    // parent's mirror of the queue so the "▶ Send (N)" badge resets
    // immediately instead of waiting for the next pick-actions ping.
    if (cmfSessionId.value && (d.action || (Array.isArray(d.actions) && d.actions.length))) {
      pickerActions.value = []
      forwardStepToCamoufox(d.actions || d.action)
    }
  } else if (d.type === 'webrobot-pick-actions') {
    pickerActions.value = Array.isArray(d.actions) ? d.actions : []
  } else if (d.type === 'webrobot-picker-navigation') {
    // Page is reloading in action mode — buffer already received.
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
    try { ev.source && ev.source.postMessage({ type: 'webrobot-picker-mode', mode: ifrMode }, '*') } catch (_) {}
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
async function runAutoSuggestFields() {
  if (pickerTargetStageIdx.value == null) return
  if (!pickerLoadedUrl.value) {
    wizStatus.value = { kind: 'error', text: 'Load a target URL in the picker first.' }
    return
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

  const path = aiMode.value === 'actions' ? 'infer-actions' : 'infer-selector'
  try {
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/${path}`, {
      method: 'POST',
      body: JSON.stringify({ url: pickerLoadedUrl.value, intent, ...ctx }),
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
  pickerIntendedMode.value = 'selector-single'
  pickerMode.value = 'action-record'   // navigate first
  pickerSelected.value = null
  pickerOpen.value = true
  tryResumePausedSession()
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
        const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/infer-segment`, {
          method: 'POST',
          body: JSON.stringify({ url, segmentation_prompt: prompt }),
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
function openMultiFieldPicker(stageIdx) {
  pickerTargetStageIdx.value = stageIdx
  pickerTargetArgName.value  = '__fields_multi__'
  pickerIntendedMode.value = 'multi-field'
  pickerMode.value = 'action-record'   // navigate first, user promotes via CTA
  pickerOpen.value = true
  tryResumePausedSession()
  // If the stage is flatSelect AND has a segment selector set, push it
  // to picker.js so it constrains clicks to descendants of one segment
  // and produces RELATIVE selectors for the fields.
  const row = wizPipeline.value[stageIdx]
  if (row && row.stage === 'flatSelect' && row.args) {
    const segSel = row.args.segmentSelector || row.args.selector
    if (segSel) {
      setTimeout(() => {
        const ifr = document.getElementById('wr-picker-iframe')
        try { ifr && ifr.contentWindow && ifr.contentWindow.postMessage({ type: 'webrobot-picker-multi-config', containerSelector: segSel }, '*') } catch (_) {}
      }, 600)
    }
  }
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

// True when the picker was opened from a fetch / visit / explore stage —
// drives the toolbar to show only "Record actions" (the other tabs are
// for selector picking, which doesn't apply to trace-capable stages).
const pickerOriginIsTraceCapable = computed(() => {
  const idx = pickerTargetStageIdx.value
  if (idx == null || !wizPipeline.value[idx]) return false
  return isTraceCapableStage(wizPipeline.value[idx].stage)
})
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
  if (committedActions.value.length) {
    row._trace = committedActions.value.slice()
  }
  const spec = findStageSpec(row.stage)
  const firstArg = (spec && spec.arg_schema || [])[0]
  if (firstArg && pickerOpenedUrl.value) {
    if (!row.args) row.args = {}
    const current = row.args[firstArg.name]
    if (current == null || String(current).trim() === '') {
      row.args[firstArg.name] = pickerOpenedUrl.value
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
  const lines = ['pipeline:']
  for (const row of pipeline) {
    lines.push(`  - stage: ${row.stage}`)

    // ── Structured stages: extract + flatSelect ────────────────
    // extract.args = list of {selector, as, method}
    // flatSelect.args = [segmentSelector, [{selector, as, method}, …]]
    const fields = Array.isArray(row._fields) ? row._fields.filter(f => (f.selector || '').trim() !== '') : []
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
  lines.push('output:')
  lines.push('  format: parquet')
  lines.push('  mode: overwrite')
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

async function wizardSubmit(execute) {
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
async function runValidation() {
  validateState.value = { kind: 'running', text: 'Opening Camoufox session and replaying trace…' }
  validateResult.value = null
  try {
    const yamlText = wizYamlPreview.value
    const r = await authenticatedDemoFetch(`${API_BASE_URL}/api/webrobot/api/demo/wizard/validate`, {
      method: 'POST',
      body: JSON.stringify({ yaml: yamlText })
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
  max-width: 100%;
  margin: 2rem auto;
  padding: 0 2rem;
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
  background: var(--vp-c-bg-soft);
  /* Was var(--vp-c-text-1) — on the soft-grey button bg, VitePress
     resolves that to a mid-grey that's hard to read. Pin to near-black
     for legibility (also matches .btn-ghost). */
  color: #111;
  font-weight: 600;
  border: 1px solid var(--vp-c-divider);
}

.btn-secondary:hover {
  background: var(--vp-c-bg);
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
  color: #444;
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
  background: white;
  border: 1px solid #e0e0e0;
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
.wizard-pane {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  background: #fafbfc;
}
.wizard-pane h4 {
  margin: 0 0 10px 0;
  color: #333;
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
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease;
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
  background: white;
  border: 1px solid #e0e0e0;
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
  color: #555;
  display: block;
  margin-bottom: 3px;
}
.wizard-arg-type {
  color: #999;
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
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.9em;
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
.wizard-status-error   { color: #b00020; }
.wizard-status-success { color: #43a047; }
.wizard-status-info    { color: #444; }

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
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.95rem;
  background: white;
}
.text-input:focus {
  border-color: #2196f3;
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
  background: white;
  border-radius: 12px;
  /* Use most of the screen — sites like ebay/amazon don't fit in 1100px
     and force their own horizontal scroll that the picker can't see. */
  width: min(95vw, 1600px);
  height: min(95vh, 900px);
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
  border-top: 1px solid #e0e0e0;
  padding: 10px 14px;
  background: white;
  max-height: 200px;
  overflow-y: auto;
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
  background: white;
  border: 1px solid #e0e0e0;
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
  .demo-section { padding: 1rem; margin: 1rem 0; }
  .demo-section h2 { font-size: 1.2rem; }
  .demo-section > p { font-size: 0.9rem; }

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
</style>


