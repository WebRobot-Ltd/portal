<template>
  <div class="demo-app">

    <!-- Section 1: Execute Existing Pipelines -->
    <div class="demo-section">
      <h2>📋 Execute Example Pipelines</h2>
      <p>Run publicly available ETL pipelines from our documentation. Preview limited to 5-10 records.</p>
      
      <div class="pipeline-selector-card">
        <div class="form-group">
          <label for="pipeline-selector">Select a Pipeline:</label>
          <select 
            id="pipeline-selector" 
            v-model="selectedPipeline"
            @change="onPipelineSelected"
            class="pipeline-select"
          >
            <option value="">-- Choose a pipeline --</option>
            <option 
              v-for="pipeline in availablePipelines" 
              :key="pipeline.id"
              :value="pipeline.id"
            >
              {{ pipeline.name }}
            </option>
          </select>
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

        <button 
          class="btn btn-primary"
          :disabled="!selectedPipeline || isExecuting"
          @click="executePipeline"
        >
          <span v-if="isExecuting" class="loading-spinner"></span>
          {{ isExecuting ? 'Executing...' : 'Run Selected Pipeline' }}
        </button>
      </div>

      <!-- Execution Results -->
      <div v-if="executionResult" class="results-card">
        <div class="results-header">
          <h3>Execution Results</h3>
          <span :class="['status-badge', executionResult.status]">
            {{ executionResult.status }}
          </span>
        </div>
        <div v-if="executionResult.status === 'success'" class="results-content">
          <div class="result-stats">
            <div class="stat-item">
              <span class="stat-label">Records Processed:</span>
              <span class="stat-value">{{ executionResult.recordsProcessed }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Execution Time:</span>
              <span class="stat-value">{{ executionResult.executionTime }}s</span>
            </div>
          </div>
          <div class="result-preview">
            <h4>Preview Data ({{ executionResult.preview.length }} records):</h4>
            <pre class="code-block">{{ formatPreview(executionResult.preview) }}</pre>
          </div>
        </div>
        <div v-else-if="executionResult.status === 'error'" class="error-content">
          <p class="error-message">{{ executionResult.error }}</p>
        </div>
      </div>
    </div>

    <!-- Section 2: Generate Pipeline from Natural Language -->
    <div class="demo-section">
      <h2>🤖 Generate Pipeline from Natural Language</h2>
      <p>
        Describe what you want to scrape or extract, and our AI agent will generate a pipeline YAML for you.
        <strong>Note: Generated pipelines are not executed automatically.</strong>
      </p>

      <div class="generation-card">
        <div class="form-group">
          <label for="llm-provider">LLM Provider:</label>
          <select 
            id="llm-provider" 
            v-model="generationConfig.provider"
            class="pipeline-select"
          >
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="together">Together AI</option>
            <option value="google">Google (Gemini)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="api-key-input">
            Your API Key:
            <span class="hint">(Required, not saved)</span>
          </label>
          <input 
            type="password" 
            id="api-key-input"
            v-model="generationConfig.apiKey"
            placeholder="Enter your API key"
            class="text-input"
          />
        </div>

        <div class="form-group">
          <label for="nl-prompt">
            Describe what you want to extract:
          </label>
          <textarea 
            id="nl-prompt"
            v-model="generationConfig.prompt"
            placeholder="Example: Scrape product listings from an e-commerce site, extract product name, price, and image URL"
            class="textarea-input"
            rows="5"
          ></textarea>
        </div>

        <button 
          class="btn btn-primary"
          :disabled="!canGenerate || isGenerating"
          @click="generatePipeline"
        >
          <span v-if="isGenerating" class="loading-spinner"></span>
          {{ isGenerating ? 'Generating...' : 'Generate Pipeline' }}
        </button>
      </div>

      <!-- Generation Results -->
      <div v-if="generatedPipeline" class="results-card">
        <div class="results-header">
          <h3>Generated Pipeline YAML</h3>
          <button class="btn btn-secondary" @click="copyToClipboard">
            Copy YAML
          </button>
        </div>
        <div class="generated-yaml">
          <pre class="code-block yaml-block">{{ generatedPipeline }}</pre>
        </div>
        <div class="generation-actions">
          <button class="btn btn-secondary" @click="downloadYAML">
            Download YAML
          </button>
          <button class="btn btn-primary" @click="saveAndExecute">
            Save & Execute Pipeline
          </button>
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
                  <label for="ean-query">SQL Query:</label>
                  <textarea 
                    id="ean-query"
                    v-model="eanConfig.query"
                    placeholder="SELECT * FROM ean_results WHERE country = 'denmark' LIMIT 10"
                    class="textarea-input"
                    rows="4"
                  ></textarea>
                </div>
                <button 
                  class="btn btn-primary"
                  :disabled="!eanConfig.query.trim() || isQueryingEAN"
                  @click="queryEANResults"
                >
                  <span v-if="isQueryingEAN" class="loading-spinner"></span>
                  {{ isQueryingEAN ? 'Querying...' : 'Execute Query' }}
                </button>
              </div>
            </div>
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Pipeline execution state
const selectedPipeline = ref('')
const selectedPipelineInfo = ref(null)
const isExecuting = ref(false)
const executionResult = ref(null)

// Pipeline generation state
const generationConfig = ref({
  provider: 'openai',
  apiKey: '',
  prompt: ''
})
const isGenerating = ref(false)
const generatedPipeline = ref(null)

// Private demo authentication state
const authConfig = ref({
  apiKey: ''
})
const isAuthenticating = ref(false)
const isAuthenticated = ref(false)
const authError = ref(null)
const authenticatedUser = ref(null)
const selectedPrivateDemo = ref(null)

// Private demos available (extensible structure)
const availablePrivateDemos = ref([
  {
    id: 'ean-plugin',
    name: 'EAN Image Sourcing',
    icon: '🖼️',
    description: 'Upload EAN codes and extract product images from e-commerce sites',
    features: ['CSV Upload', 'Image Extraction', 'SQL Query', 'Multi-country'],
    status: 'available',
    plugin: 'ean-image-sourcing'
  }
  // Future demos can be added here:
  // {
  //   id: 'custom-plugin-1',
  //   name: 'Custom Plugin Demo',
  //   icon: '🔧',
  //   description: 'Description of custom plugin',
  //   features: ['Feature 1', 'Feature 2'],
  //   status: 'available',
  //   plugin: 'custom-plugin-1'
  // }
])

// EAN Plugin state
const eanConfig = ref({
  country: '',
  query: '',
  file: null
})
const isUploading = ref(false)
const isExecutingEAN = ref(false)
const isQueryingEAN = ref(false)
const eanUploadResult = ref(null)
const eanResults = ref(null)
const eanTableColumns = ref([])

// Available pipelines from documentation (matching Redocly structure)
const availablePipelines = ref([
  {
    id: 'llm-finetuning-dataset',
    name: 'LLM Fine-tuning Dataset',
    description: 'Scrape and prepare datasets for LLM fine-tuning from public domain sources',
    source: 'examples/pipelines/23-llm-finetuning-dataset.yaml',
    docLink: 'https://docs.webrobot.eu/guides/vertical-llm-finetuning',
    stages: ['load_csv', 'visit', 'iextract', 'store']
  },
  {
    id: 'price-comparison',
    name: 'Price Comparison (5 Sites)',
    description: 'Compare product prices across multiple e-commerce sites',
    source: 'examples/pipelines/19-price-comparison-5-sites.yaml',
    docLink: 'https://docs.webrobot.eu/guides/vertical-price-comparison',
    stages: ['visit', 'iextract', 'union_with', 'store']
  },
  {
    id: 'sports-betting',
    name: 'Sports Betting Surebet Detection',
    description: 'Detect arbitrage opportunities across multiple bookmakers',
    source: 'examples/pipelines/21-surebet-intelligent-extraction.yaml',
    docLink: 'https://docs.webrobot.eu/guides/vertical-sports-betting',
    stages: ['visit', 'iextract', 'store']
  },
  {
    id: 'real-estate',
    name: 'Real Estate Property Scraping',
    description: 'Extract property listings with intelligent extraction',
    source: 'examples/pipelines/22-real-estate-arbitrage-clustering.yaml',
    docLink: 'https://docs.webrobot.eu/guides/vertical-real-estate',
    stages: ['visit', 'iextract', 'propertyCluster', 'store']
  },
  {
    id: 'portfolio-management',
    name: 'Portfolio Management (90d Prediction)',
    description: 'Analyze portfolio data for 90-day predictions',
    source: 'examples/pipelines/24-portfolio-management-90d-prediction.yaml',
    docLink: 'https://docs.webrobot.eu/guides/vertical-portfolio-management',
    stages: ['load_csv', 'visit', 'iextract', 'store']
  }
])

// Computed properties
const canGenerate = computed(() => {
  return generationConfig.value.apiKey.trim() !== '' && 
         generationConfig.value.prompt.trim() !== ''
})

// Methods
function onPipelineSelected() {
  const pipeline = availablePipelines.value.find(p => p.id === selectedPipeline.value)
  selectedPipelineInfo.value = pipeline || null
  executionResult.value = null
}

function executePipeline() {
  if (!selectedPipeline.value) return
  
  isExecuting.value = true
  executionResult.value = null
  
  // Simulate API call (will be replaced with actual backend integration)
  setTimeout(() => {
    isExecuting.value = false
    executionResult.value = {
      status: 'success',
      recordsProcessed: 8,
      executionTime: 12.5,
      preview: [
        { id: 1, name: 'Product A', price: 29.99 },
        { id: 2, name: 'Product B', price: 49.99 },
        { id: 3, name: 'Product C', price: 19.99 }
      ]
    }
  }, 2000)
}

function generatePipeline() {
  if (!canGenerate.value) return
  
  isGenerating.value = true
  generatedPipeline.value = null
  
  // Simulate API call (will be replaced with actual backend integration)
  setTimeout(() => {
    isGenerating.value = false
    generatedPipeline.value = `# Generated Pipeline YAML
# Source: ${generationConfig.value.prompt}
# Provider: ${generationConfig.value.provider}

pipeline:
  name: generated-pipeline-${Date.now()}
  stages:
    - type: visit
      url: "https://example.com/products"
      waitFor: "body"
    
    - type: iextract
      attributes:
        - name: product_name
          selector: ".product-title"
        - name: price
          selector: ".price"
        - name: image_url
          selector: ".product-image img"
          attribute: "src"
    
    - type: store
      format: json
      path: "/output/products.json"
`
  }, 3000)
}

function formatPreview(preview) {
  return JSON.stringify(preview, null, 2)
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

function saveAndExecute() {
  alert('This will save the pipeline and execute it. Backend integration pending.')
}

// Private Demo Authentication
function authenticate() {
  if (!authConfig.value.apiKey.trim()) return
  
  isAuthenticating.value = true
  authError.value = null
  
  // Simulate API authentication (will be replaced with actual backend)
  setTimeout(() => {
    // Mock: Different API keys return different user profiles with different demos
    const mockUsers = {
      'ean-demo-key': {
        name: 'EAN Client',
        email: 'ean@example.com',
        demos: ['ean-plugin']
      },
      'premium-key': {
        name: 'Premium Client',
        email: 'premium@example.com',
        demos: ['ean-plugin', 'custom-plugin-1']
      }
    }
    
    const user = mockUsers[authConfig.value.apiKey] || {
      name: 'Standard Client',
      email: 'client@example.com',
      demos: ['ean-plugin']
    }
    
    isAuthenticating.value = false
    
    if (user) {
      isAuthenticated.value = true
      authenticatedUser.value = user
      // Filter demos based on user access
      availablePrivateDemos.value = availablePrivateDemos.value.filter(demo => 
        user.demos.includes(demo.id)
      )
      // Store API key in sessionStorage (not localStorage for security)
      sessionStorage.setItem('webrobot_api_key', authConfig.value.apiKey)
    } else {
      authError.value = 'Invalid API key. Please check your credentials.'
    }
  }, 1500)
}

function logout() {
  isAuthenticated.value = false
  authenticatedUser.value = null
  authConfig.value.apiKey = ''
  selectedPrivateDemo.value = null
  eanUploadResult.value = null
  eanResults.value = null
  sessionStorage.removeItem('webrobot_api_key')
}

function selectPrivateDemo(demo) {
  if (demo.status === 'available') {
    selectedPrivateDemo.value = demo
    // Reset demo-specific state
    eanUploadResult.value = null
    eanResults.value = null
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

function uploadEANDataset() {
  if (!canUploadEAN.value) return
  
  isUploading.value = true
  
  // Simulate upload (will be replaced with actual API call)
  setTimeout(() => {
    isUploading.value = false
    eanUploadResult.value = {
      country: eanConfig.value.country,
      datasetId: `ds-${Date.now()}`,
      datasetName: `EAN Image Sourcing - ${eanConfig.value.country} - ${new Date().toISOString().split('T')[0]}`,
      storagePath: `s3a://sparklogs-data/ean-sourcing/${eanConfig.value.country}/${Date.now()}-products.csv`,
      status: 'uploaded'
    }
  }, 2000)
}

function executeEANJob() {
  if (!eanUploadResult.value) return
  
  isExecutingEAN.value = true
  
  // Simulate execution (will be replaced with actual API call)
  setTimeout(() => {
    isExecutingEAN.value = false
    alert('Job execution started. Check status endpoint for progress.')
  }, 2000)
}

function queryEANResults() {
  if (!eanConfig.value.query.trim()) return
  
  isQueryingEAN.value = true
  
  // Simulate query (will be replaced with actual API call)
  setTimeout(() => {
    isQueryingEAN.value = false
    // Mock results
    eanResults.value = [
      { ean: '1234567890123', product_name: 'Product A', price: 29.99, image_url: 'https://example.com/img1.jpg', similarity: 0.95 },
      { ean: '1234567890124', product_name: 'Product B', price: 49.99, image_url: 'https://example.com/img2.jpg', similarity: 0.92 },
      { ean: '1234567890125', product_name: 'Product C', price: 19.99, image_url: 'https://example.com/img3.jpg', similarity: 0.88 }
    ]
    eanTableColumns.value = Object.keys(eanResults.value[0])
  }, 1500)
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...'
  return value
}

// Check for existing session on mount
if (typeof window !== 'undefined') {
  const storedKey = sessionStorage.getItem('webrobot_api_key')
  if (storedKey) {
    authConfig.value.apiKey = storedKey
    authenticate()
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
  margin-top: 2rem;
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
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.btn-secondary:hover {
  background: var(--vp-c-bg);
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
}
</style>


