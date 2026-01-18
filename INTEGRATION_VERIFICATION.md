# Demo Plugin Integration Verification

## Overview
This document verifies the consistency between the VitePress portal (`DemoApp.vue`) and the Demo Plugin (`DemoPlugin.java`).

## Endpoint Paths

### Plugin Java Endpoints
- `GET /webrobot/api/demo/info` - Get plugin info
- `GET /webrobot/api/demo/list` - List all available demo pipelines
- `POST /webrobot/api/demo/execute/{pipeline-name}` - Execute a demo pipeline
- `POST /webrobot/api/demo/generate-pipeline` - Generate pipeline from natural language
- `POST /webrobot/api/demo/save-generated-pipeline` - Save generated pipeline

### VitePress Component Calls
- `${API_BASE_URL}/api/webrobot/api/demo/list`
- `${API_BASE_URL}/api/webrobot/api/demo/execute/${pipelineName}`
- `${API_BASE_URL}/api/webrobot/api/demo/generate-pipeline`

**Status**: ✅ **Consistent**
- The extra `/api` prefix is added by the API gateway/proxy, which is correct.
- `API_BASE_URL` defaults to `https://api.webrobot.eu` (configurable via `VITE_API_BASE_URL`)

## Response Format - List Endpoint

### Backend Response (`listAllDemos()`)
```json
{
  "demos": [
    {
      "pipeline_name": "01-static-books",
      "agent_id": 123,
      "agent_name": "Demo: 01-static-books",
      "description": "Demo pipeline: 01-static-books",
      "has_pipeline_yaml": true
    }
  ],
  "total": 1,
  "message": "Demo pipelines are limited to 10 records for public demos"
}
```

### Frontend Mapping (`DemoApp.vue`)
```javascript
availablePipelines.value = demos.map((demo: any) => ({
  id: demo.pipeline_name || demo.name,                    // ✅ OK
  name: demo.display_name || demo.name || demo.pipeline_name,  // ⚠️ Uses fallback
  description: demo.description || 'No description available',  // ✅ OK
  source: demo.source || demo.pipeline_name,              // ⚠️ Uses fallback
  docLink: demo.doc_link || `https://docs.webrobot.eu`,  // ⚠️ Uses fallback
  stages: demo.stages || []                               // ⚠️ Uses fallback
}))
```

**Status**: ✅ **Works with fallbacks**
- Frontend correctly handles missing fields with appropriate fallbacks
- **Recommendation**: Backend could optionally include `display_name`, `source`, `doc_link`, `stages` for richer display

## Response Format - Execute Endpoint

### Backend Response (`executeDemo()`)
```json
{
  "pipeline_name": "01-static-books",
  "job_id": 456,
  "agent_id": 123,
  "output_dataset_id": 789,
  "output_path": "/path/to/output",
  "limit": 10,
  "limit_min": 5,
  "limit_max": 10,
  "status": "submitted",
  "execution_result": {...},
  "message": "Demo execution submitted (limited to 10 records)",
  "execution_type": "demo",
  "record_limit": 10,
  "record_limit_min": 5,
  "record_limit_max": 10,
  "note": "Job is executing. Check job status for completion."
}
```

### Frontend Mapping (`DemoApp.vue`)
```javascript
executionResult.value = {
  status: result.status || 'success',              // ✅ OK
  jobId: result.job_id,                            // ✅ OK
  agentId: result.agent_id,                        // ✅ OK
  recordsProcessed: result.record_limit || 10,     // ✅ OK
  executionTime: result.execution_time || 0,       // ⚠️ Uses fallback (not available)
  message: result.message || 'Pipeline executed successfully',  // ✅ OK
  preview: result.preview || [],                   // ⚠️ Uses fallback (not available)
  note: result.note || ''                          // ✅ OK
}
```

**Status**: ✅ **Works with fallbacks**
- Frontend correctly handles missing `execution_time` and `preview` with fallbacks
- **Recommendation**: Backend could optionally include `execution_time` (if synchronous) and `preview` (if results are immediately available)

## Field Mapping Summary

### List Endpoint
| Frontend Field | Backend Field | Status |
|----------------|---------------|--------|
| `id` | `pipeline_name` | ✅ Direct mapping |
| `name` | `display_name` or `name` or `pipeline_name` | ⚠️ Fallback chain |
| `description` | `description` | ✅ Direct mapping |
| `source` | `source` or `pipeline_name` | ⚠️ Fallback |
| `docLink` | `doc_link` or default URL | ⚠️ Fallback |
| `stages` | `stages` or `[]` | ⚠️ Fallback |

### Execute Endpoint
| Frontend Field | Backend Field | Status |
|----------------|---------------|--------|
| `status` | `status` | ✅ Direct mapping |
| `jobId` | `job_id` | ✅ Direct mapping |
| `agentId` | `agent_id` | ✅ Direct mapping |
| `recordsProcessed` | `record_limit` | ✅ Direct mapping |
| `executionTime` | `execution_time` | ⚠️ Not available, uses fallback `0` |
| `message` | `message` | ✅ Direct mapping |
| `preview` | `preview` | ⚠️ Not available, uses fallback `[]` |
| `note` | `note` | ✅ Direct mapping |

## Dataset Upload Functionality

### Current Status: ⚠️ **Limited Support**

**Public Demo ("Execute Example Pipelines"):**
- ❌ **NO** support for dataset upload after pipeline selection
- ❌ **NO** support for dataset creation/selection
- ✅ Pipelines execute with default/predefined data sources only
- ⚠️ Backend does not accept `datasetId` in parameters (only `limit` is supported)

**Private Demo (EAN Plugin):**
- ✅ **YES** - Full support for CSV upload
- ✅ Uploads create datasets automatically
- ✅ Dataset ID is passed to pipeline execution

### Dataset Upload Functionality

**Status**: ✅ **Implemented**

The public demo now supports:
1. ✅ Automatic detection of pipelines that require input datasets (via YAML analysis)
2. ✅ CSV format description for each pipeline that requires input
3. ✅ File upload form appears when a pipeline requires input dataset
4. ✅ CSV upload creates a dataset automatically
5. ✅ Dataset ID is automatically passed to pipeline execution

### Dataset Upload Implementation

**Implemented Solution**: Dataset Upload to Public Demo
- ✅ File upload form appears after pipeline selection (for pipelines that require input)
- ✅ CSV file uploads supported
- ✅ Dataset creation via demo plugin endpoint: `POST /webrobot/api/demo/upload-dataset/{pipeline-name}`
- ✅ `datasetId` automatically passed in execute parameters
- ✅ Automatic detection of pipelines requiring input (via YAML analysis for `load_csv`, `load_dataset`, or `input` stages)
- ✅ CSV format description extracted from YAML or shown with default message

**New Endpoints**:
- `POST /webrobot/api/demo/upload-dataset/{pipeline-name}` - Upload CSV file and create dataset
- `POST /webrobot/api/demo/execute/{pipeline-name}` - Now accepts `datasetId` in parameters

**New Response Fields in `/list` endpoint**:
- `requires_input_dataset` (boolean) - Whether pipeline requires input dataset
- `csv_format_description` (string, optional) - Description of required CSV format

## Recommendations

1. **Optional Backend Enhancements** (non-critical, fallbacks work):
   - Add `display_name` field to list response for better UI display
   - Add `source` field to list response
   - Add `doc_link` field to list response (or derive from pipeline name)
   - Add `stages` array to list response (extract from pipeline YAML)
   - Add `requires_input_dataset` boolean to list response (check YAML for input stages)
   - Consider adding `execution_time` to execute response if synchronous
   - Consider adding `preview` data to execute response if immediately available

2. **Dataset Upload Enhancement**: ✅ **Completed**
   - ✅ Added `datasetId` support to `executeDemo()` parameters
   - ✅ Created new endpoint: `POST /webrobot/api/demo/upload-dataset/{pipeline-name}` for public demo
   - ✅ Updated frontend to show upload form for pipelines that require input
   - ✅ Automatic detection of pipelines requiring input via YAML analysis
   - ✅ CSV format description extraction from YAML or default message

3. **Current Status**: ✅ **Integration is functional and consistent**
   - All required fields are mapped correctly
   - Fallbacks handle missing optional fields gracefully
   - Error handling is appropriate
   - ✅ Dataset upload functionality is implemented for public demo

## Testing

To test the integration, use the provided test script:
```bash
cd webrobot-vitepress-site
node test-demo-integration.js
```

Or manually test:
1. Start VitePress: `npm run dev`
2. Navigate to `/demo` page
3. Verify pipeline list loads correctly
4. Execute a pipeline and verify response formatting
5. ⚠️ Note: Dataset upload is not yet available for public demo pipelines

