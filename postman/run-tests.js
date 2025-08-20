#!/usr/bin/env node

/**
 * Newman test runner for LexMind API
 * Runs comprehensive API tests and generates reports
 */

const newman = require('newman');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
  collection: path.join(__dirname, 'LexMind_API_Collection.json'),
  environment: path.join(__dirname, 'LexMind_Environment_Local.json'),
  setupCollection: path.join(__dirname, 'test-data-setup.json'),
  reportsDir: path.join(__dirname, 'reports'),
  baseUrl: process.env.API_BASE_URL || 'http://localhost:8000'
};

// Ensure reports directory exists
if (!fs.existsSync(config.reportsDir)) {
  fs.mkdirSync(config.reportsDir, { recursive: true });
}

async function runCollection(collectionPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${description}...`);
    
    newman.run({
      collection: collectionPath,
      environment: config.environment,
      reporters: ['cli', 'json'],
      reporter: {
        json: {
          export: path.join(config.reportsDir, `${description.replace(/\s+/g, '-').toLowerCase()}-results.json`)
        }
      },
      insecure: true, // For local testing with self-signed certs
      timeout: 30000,
      delayRequest: 100, // Small delay between requests
    }, (err, summary) => {
      if (err) {
        console.error(`❌ ${description} failed:`, err);
        reject(err);
      } else {
        const stats = summary.run.stats;
        console.log(`✅ ${description} completed:`);
        console.log(`   Tests: ${stats.tests.total} (${stats.tests.passed} passed, ${stats.tests.failed} failed)`);
        console.log(`   Assertions: ${stats.assertions.total} (${stats.assertions.passed} passed, ${stats.assertions.failed} failed)`);
        console.log(`   Requests: ${stats.requests.total} (avg ${Math.round(stats.requests.average)}ms)`);
        
        resolve(summary);
      }
    });
  });
}

async function checkApiHealth() {
  console.log('\n🏥 Checking API health...');
  
  try {
    const response = await fetch(`${config.baseUrl}/health`);
    if (response.ok) {
      console.log('✅ API is healthy');
      return true;
    } else {
      console.log(`❌ API health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Cannot connect to API: ${error.message}`);
    console.log(`   Make sure the API is running at ${config.baseUrl}`);
    return false;
  }
}

async function generateHtmlReport(summaries) {
  const reportPath = path.join(config.reportsDir, 'test-report.html');
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>LexMind API Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
    .summary { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .success { color: #27ae60; }
    .error { color: #e74c3c; }
    .stats { display: flex; gap: 20px; margin: 10px 0; }
    .stat { background: white; padding: 10px; border-radius: 5px; border-left: 4px solid #3498db; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛡️ LexMind API Test Report</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
`;

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  summaries.forEach((summary, index) => {
    const stats = summary.run.stats;
    totalTests += stats.tests.total;
    totalPassed += stats.tests.passed;
    totalFailed += stats.tests.failed;

    const collectionName = index === 0 ? 'Test Data Setup' : 'Main API Tests';
    
    html += `
  <div class="summary">
    <h2>${collectionName}</h2>
    <div class="stats">
      <div class="stat">
        <strong>Tests:</strong> ${stats.tests.total}<br>
        <span class="success">✅ ${stats.tests.passed}</span> |
        <span class="error">❌ ${stats.tests.failed}</span>
      </div>
      <div class="stat">
        <strong>Requests:</strong> ${stats.requests.total}<br>
        <strong>Avg Response:</strong> ${Math.round(stats.requests.average)}ms
      </div>
      <div class="stat">
        <strong>Assertions:</strong> ${stats.assertions.total}<br>
        <span class="success">✅ ${stats.assertions.passed}</span> |
        <span class="error">❌ ${stats.assertions.failed}</span>
      </div>
    </div>
  </div>`;
  });

  html += `
  <div class="summary">
    <h2>📊 Overall Results</h2>
    <div class="stats">
      <div class="stat">
        <strong>Total Tests:</strong> ${totalTests}<br>
        <span class="success">Passed: ${totalPassed}</span><br>
        <span class="error">Failed: ${totalFailed}</span>
      </div>
      <div class="stat">
        <strong>Success Rate:</strong><br>
        ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%
      </div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(reportPath, html);
  console.log(`\n📊 HTML report generated: ${reportPath}`);
}

async function main() {
  console.log('🧪 LexMind API Test Suite');
  console.log('==========================');

  // Check if API is running
  if (!(await checkApiHealth())) {
    process.exit(1);
  }

  try {
    const summaries = [];

    // 1. Setup test data
    summaries.push(await runCollection(config.setupCollection, 'Test Data Setup'));

    // 2. Run main test suite
    summaries.push(await runCollection(config.collection, 'Main API Tests'));

    // 3. Generate reports
    await generateHtmlReport(summaries);

    const totalFailed = summaries.reduce((acc, summary) => acc + summary.run.stats.tests.failed, 0);
    
    if (totalFailed === 0) {
      console.log('\n🎉 All tests passed! API is working correctly.');
      process.exit(0);
    } else {
      console.log(`\n⚠️  Some tests failed. Check the reports for details.`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Handle CLI execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runCollection, checkApiHealth };