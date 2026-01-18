<template>
  <div class="demo-app">

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
            <option 
              v-for="pipeline in availablePipelines" 
              :key="pipeline.id"
              :value="pipeline.id"
            >
              {{ pipeline.name }}
            </option>
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

        <button 
          class="btn btn-primary"
          :disabled="!selectedPipeline || isExecuting"
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
              
              <div class="form-group">
                <label for="demo-csv-file-modal">CSV File:</label>
                <input 
                  type="file"
                  id="demo-csv-file-modal"
                  accept=".csv"
                  @change="handleDemoFileSelect"
                  class="file-input"
                />
                <p v-if="demoUploadFile" class="file-name">{{ demoUploadFile.name }}</p>
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
                :disabled="!demoUploadFile || isUploadingDemoDataset"
                @click="uploadAndExecute"
              >
                <span v-if="isUploadingDemoDataset" class="loading-spinner"></span>
                {{ isUploadingDemoDataset ? 'Uploading...' : (demoUploadResult ? 'Execute Pipeline' : 'Upload & Execute') }}
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Pipeline execution state
const selectedPipeline = ref('')
const selectedPipelineInfo = ref(null)
const isExecuting = ref(false)
const executionResult = ref(null)
const loadingPipelines = ref(false)
const pipelinesError = ref(null)

// CSV upload state for demo pipelines
const demoUploadFile = ref(null)
const isUploadingDemoDataset = ref(false)
const demoUploadResult = ref(null)
const demoUploadError = ref(null)
const showUploadModal = ref(false)

// JWT authentication state for demo endpoints
const demoJwtToken = ref(null)
const isAuthenticatingDemo = ref(false)
const demoAuthError = ref(null)

// Demo credentials
const DEMO_EMAIL = 'demo@webrobot.eu'
const DEMO_PASSWORD = 'demo2026'
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || 'https://strapi.webrobot.eu'

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
})

// Computed properties
const canGenerate = computed(() => {
  return generationConfig.value.apiKey.trim() !== '' && 
         generationConfig.value.prompt.trim() !== ''
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
      csvFormatDescription: demo.csv_format_description || null
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

async function uploadDemoDataset() {
  if (!demoUploadFile.value || !selectedPipeline.value) return
  
  isUploadingDemoDataset.value = true
  demoUploadError.value = null
  
  try {
    const token = await getDemoJwtToken()
    const formData = new FormData()
    formData.append('file', demoUploadFile.value)
    
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
      showUploadModal.value = true
      // Reset upload state
      demoUploadFile.value = null
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
  demoUploadFile.value = null
  demoUploadResult.value = null
  demoUploadError.value = null
}

async function uploadAndExecute() {
  if (!demoUploadFile.value) return
  
  // First upload the dataset
  await uploadDemoDataset()
  
  // If upload successful, execute pipeline
  if (demoUploadResult.value && demoUploadResult.value.datasetId) {
    closeUploadModal()
    executePipeline()
  }
}

async function executePipeline() {
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
    
    // If pipeline requires input dataset and we have upload result, include datasetId
    if (selectedPipelineInfo.value && selectedPipelineInfo.value.requiresInputDataset && demoUploadResult.value && demoUploadResult.value.datasetId) {
      requestBody.parameters.datasetId = demoUploadResult.value.datasetId
    }
    
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
    
    // Format result for display
    executionResult.value = {
      status: result.status || 'success',
      jobId: result.job_id,
      agentId: result.agent_id,
      recordsProcessed: result.record_limit || 10,
      executionTime: result.execution_time || 0,
      message: result.message || 'Pipeline executed successfully',
      preview: result.preview || [],
      note: result.note || ''
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

async function generatePipeline() {
  if (!canGenerate.value) return
  
  isGenerating.value = true
  generatedPipeline.value = null
  
  try {
    // Call backend API to generate pipeline from natural language
    const response = await fetch(`${API_BASE_URL}/api/webrobot/api/demo/generate-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': generationConfig.value.apiKey.trim()
      },
      body: JSON.stringify({
        prompt: generationConfig.value.prompt,
        provider: generationConfig.value.provider
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Generation failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    // Extract pipeline YAML from result
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
  
  try {
    const apiKey = getAuthenticatedApiKey()
    if (!apiKey) {
      alert('Please authenticate first to save and execute pipelines.')
      return
    }
    
    // Extract pipeline name from YAML or generate one
    const pipelineName = `generated-pipeline-${Date.now()}`
    
    // Call backend API to save the generated pipeline
    const response = await authenticatedFetch(`/api/webrobot/api/demo/save-generated-pipeline`, {
      method: 'POST',
      body: JSON.stringify({
        pipeline_name: pipelineName,
        pipeline_yaml: generatedPipeline.value
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Failed to save pipeline: ${response.statusText}`)
    }
    
    const result = await response.json()
    alert(`Pipeline saved successfully!\nPipeline Name: ${result.pipeline_name || pipelineName}\nAgent ID: ${result.agent_id || 'N/A'}`)
    
    // Optionally reload pipelines list to show the new one
    await loadPipelines()
    
  } catch (error) {
    console.error('Save error:', error)
    alert(error instanceof Error ? error.message : 'Failed to save pipeline')
  }
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
</style>


