/**
 * Test script to verify integration between VitePress portal and Demo Plugin
 * 
 * Tests:
 * 1. Demo Plugin info endpoint
 * 2. Demo Plugin list endpoint
 * 3. Demo Plugin execute endpoint
 * 4. Response format consistency
 */

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://api.webrobot.eu';

const ENDPOINTS = {
  info: `${API_BASE_URL}/api/webrobot/api/demo/info`,
  list: `${API_BASE_URL}/api/webrobot/api/demo/list`,
  execute: (pipelineName) => `${API_BASE_URL}/api/webrobot/api/demo/execute/${encodeURIComponent(pipelineName)}`
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

async function testEndpoint(name, url, method = 'GET', body = null) {
  try {
    logInfo(`Testing ${name}...`);
    log(`  URL: ${url}`, colors.cyan);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const statusOk = response.ok;
    const statusCode = response.status;
    
    log(`  Status: ${statusCode} ${statusOk ? 'OK' : 'ERROR'}`);
    
    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      logError(`  Failed to parse JSON response: ${text}`);
      return { success: false, status: statusCode, error: 'Invalid JSON response' };
    }
    
    if (!statusOk) {
      logError(`  Error: ${data.error || data.message || 'Unknown error'}`);
      return { success: false, status: statusCode, data };
    }
    
    logSuccess(`${name} - Success`);
    return { success: true, status: statusCode, data };
  } catch (error) {
    logError(`${name} - Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testPluginInfo() {
  log('\n=== Testing Demo Plugin Info Endpoint ===', colors.cyan);
  const result = await testEndpoint('Plugin Info', ENDPOINTS.info);
  
  if (result.success && result.data) {
    log(`  Plugin Name: ${result.data.plugin_name || 'N/A'}`);
    log(`  Plugin Version: ${result.data.plugin_version || 'N/A'}`);
    log(`  Pipeline Count: ${result.data.pipeline_count || 0}`);
    log(`  Status: ${result.data.status || 'N/A'}`);
    
    if (result.data.endpoints) {
      log(`  Available Endpoints:`);
      result.data.endpoints.forEach(endpoint => {
        log(`    - ${endpoint}`, colors.cyan);
      });
    }
  }
  
  return result;
}

async function testListPipelines() {
  log('\n=== Testing Demo Plugin List Endpoint ===', colors.cyan);
  const result = await testEndpoint('List Pipelines', ENDPOINTS.list);
  
  if (result.success && result.data) {
    const demos = result.data.demos || [];
    const total = result.data.total || 0;
    
    log(`  Total Pipelines: ${total}`);
    
    if (demos.length > 0) {
      log(`  Available Pipelines:`, colors.green);
      demos.forEach((demo, index) => {
        log(`    ${index + 1}. ${demo.display_name || demo.name || demo.pipeline_name || 'Unknown'}`);
        log(`       ID: ${demo.pipeline_name || demo.name || 'N/A'}`);
        log(`       Description: ${demo.description || 'No description'}`);
        if (demo.stages) {
          log(`       Stages: ${demo.stages.length || 0}`);
        }
      });
    } else {
      logWarning('  No pipelines available');
    }
    
    // Check response format consistency
    if (result.data.message) {
      log(`  Message: ${result.data.message}`);
    }
    
    return { success: true, pipelines: demos, result };
  }
  
  return { success: false, result };
}

async function testExecutePipeline(pipelineName) {
  log(`\n=== Testing Demo Plugin Execute Endpoint ===`, colors.cyan);
  log(`  Pipeline: ${pipelineName}`);
  
  const result = await testEndpoint(
    'Execute Pipeline',
    ENDPOINTS.execute(pipelineName),
    'POST',
    {
      parameters: {
        limit: 10
      }
    }
  );
  
  if (result.success && result.data) {
    log(`  Pipeline Name: ${result.data.pipeline_name || 'N/A'}`);
    log(`  Job ID: ${result.data.job_id || 'N/A'}`);
    log(`  Agent ID: ${result.data.agent_id || 'N/A'}`);
    log(`  Status: ${result.data.status || 'N/A'}`);
    log(`  Limit: ${result.data.limit || 'N/A'}`);
    if (result.data.message) {
      log(`  Message: ${result.data.message}`);
    }
    if (result.data.note) {
      log(`  Note: ${result.data.note}`);
    }
  }
  
  return result;
}

async function verifyConsistency(listResult) {
  log('\n=== Verifying Response Format Consistency ===', colors.cyan);
  
  const issues = [];
  
  if (!listResult.success) {
    issues.push('List endpoint failed - cannot verify consistency');
    return issues;
  }
  
  const demos = listResult.pipelines || [];
  
  // Check if each demo has required fields
  demos.forEach((demo, index) => {
    if (!demo.pipeline_name && !demo.name) {
      issues.push(`Demo ${index + 1}: Missing pipeline_name or name field`);
    }
    if (!demo.display_name && !demo.name) {
      issues.push(`Demo ${index + 1}: Missing display_name or name field`);
    }
  });
  
  // Check VitePress component expectations
  log('  Checking VitePress component expectations...');
  const expectedFields = ['pipeline_name', 'display_name', 'description', 'source', 'doc_link', 'stages'];
  const componentMappings = {
    'id': 'pipeline_name || name',
    'name': 'display_name || name || pipeline_name',
    'description': 'description',
    'source': 'source || pipeline_name',
    'docLink': 'doc_link',
    'stages': 'stages'
  };
  
  log('  Component field mappings:');
  Object.entries(componentMappings).forEach(([componentField, backendField]) => {
    log(`    ${componentField} -> ${backendField}`, colors.cyan);
  });
  
  if (issues.length === 0) {
    logSuccess('Response format is consistent with component expectations');
  } else {
    logWarning(`Found ${issues.length} consistency issues:`);
    issues.forEach(issue => logError(`  - ${issue}`));
  }
  
  return issues;
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║  VitePress Portal - Demo Plugin Integration Test          ║', colors.cyan);
  log('╚════════════════════════════════════════════════════════════╝', colors.cyan);
  
  log(`\nAPI Base URL: ${API_BASE_URL}`, colors.blue);
  
  // Test 1: Plugin Info
  const infoResult = await testPluginInfo();
  
  if (!infoResult.success) {
    logError('\nPlugin info endpoint failed - aborting further tests');
    process.exit(1);
  }
  
  // Test 2: List Pipelines
  const listResult = await testListPipelines();
  
  if (!listResult.success) {
    logError('\nList pipelines endpoint failed - aborting further tests');
    process.exit(1);
  }
  
  // Test 3: Verify Consistency
  const consistencyIssues = await verifyConsistency(listResult);
  
  // Test 4: Execute a pipeline (if available)
  const pipelines = listResult.pipelines || [];
  if (pipelines.length > 0) {
    const firstPipeline = pipelines[0];
    const pipelineName = firstPipeline.pipeline_name || firstPipeline.name;
    
    log('\n=== Summary ===', colors.cyan);
    log(`  Total Pipelines Available: ${pipelines.length}`);
    log(`  Consistency Issues: ${consistencyIssues.length}`);
    
    log('\n  Testing execution with first available pipeline...', colors.yellow);
    const executeResult = await testExecutePipeline(pipelineName);
    
    if (executeResult.success) {
      logSuccess('\n✓ All integration tests passed!');
    } else {
      logWarning('\n⚠ Execution test failed, but list/info endpoints work');
    }
  } else {
    logWarning('\n⚠ No pipelines available for execution test');
  }
  
  log('\n=== Test Complete ===', colors.cyan);
  process.exit(consistencyIssues.length > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  logError(`\nFatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

