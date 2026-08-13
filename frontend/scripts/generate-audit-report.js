const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure output dir exists
const outputDir = path.join(__dirname, '../audit-reports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🔍 Starting MAX FE Audit Process...');

// 1. Run npm audit
let auditData = { vulnerabilities: {}, summary: {} };
const projectRoot = path.join(__dirname, '..');

try {
  const auditRaw = execSync('npm audit --json', { cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  auditData = JSON.parse(auditRaw);
} catch (error) {
  if (error.stdout) {
    try {
      auditData = JSON.parse(error.stdout);
    } catch (e) {
      console.warn('⚠️ Could not parse npm audit JSON output.');
    }
  }
}

// 2. Run npm outdated
let outdatedData = {};
try {
  const outdatedRaw = execSync('npm outdated --json', { cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  outdatedData = JSON.parse(outdatedRaw);
} catch (error) {
  if (error.stdout) {
    try {
      outdatedData = JSON.parse(error.stdout);
    } catch (e) {
      console.warn('⚠️ Could not parse npm outdated JSON output.');
    }
  }
}

// Extract vulnerability stats
const vulns = auditData.vulnerabilities || {};
const auditSummary = auditData.metadata?.vulnerabilities || {
  info: 0,
  low: 0,
  moderate: 0,
  high: 0,
  critical: 0,
  total: 0
};

// Prepare rows for Outdated Packages
const outdatedRows = Object.keys(outdatedData).map(pkg => {
  const info = outdatedData[pkg];
  const repoUrl = `https://www.npmjs.com/package/${pkg}`;
  return {
    package: pkg,
    current: info.current || 'N/A',
    wanted: info.wanted || 'N/A',
    latest: info.latest || 'N/A',
    type: info.type || 'dependency',
    repoUrl
  };
});

// Prepare rows for Vulnerable Packages
const vulnRows = Object.keys(vulns).map(pkg => {
  const v = vulns[pkg];
  const repoUrl = `https://www.npmjs.com/package/${pkg}`;
  const severity = v.severity || 'unknown';
  const fixAvailable = v.fixAvailable ? (typeof v.fixAvailable === 'object' ? v.fixAvailable.name + '@' + v.fixAvailable.version : 'Yes') : 'Manual Review';
  
  return {
    package: pkg,
    severity,
    via: Array.isArray(v.via) ? v.via.map(item => typeof item === 'string' ? item : item.title).join(', ') : 'Direct/Indirect',
    range: v.range || 'N/A',
    fixAvailable,
    repoUrl
  };
});

// Generate HTML Report
const timestamp = new Date().toISOString();
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAX FE Audit Report</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --critical: #ef4444;
      --high: #f97316;
      --moderate: #eab308;
      --low: #3b82f6;
      --success: #22c55e;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #38bdf8;
    }
    .timestamp {
      color: var(--text-muted);
      font-size: 14px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-card .number {
      font-size: 32px;
      font-weight: bold;
      margin-top: 8px;
    }
    .stat-card.critical { border-top: 4px solid var(--critical); }
    .stat-card.critical .number { color: var(--critical); }
    .stat-card.high { border-top: 4px solid var(--high); }
    .stat-card.high .number { color: var(--high); }
    .stat-card.moderate { border-top: 4px solid var(--moderate); }
    .stat-card.moderate .number { color: var(--moderate); }
    .stat-card.low { border-top: 4px solid var(--low); }
    .stat-card.low .number { color: var(--low); }
    .stat-card.outdated { border-top: 4px solid #a855f7; }
    .stat-card.outdated .number { color: #a855f7; }

    section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    h2 {
      margin-top: 0;
      font-size: 18px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      text-align: left;
    }
    th, td {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    th {
      background: #0f172a;
      color: var(--text-muted);
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge.critical { background: rgba(239, 68, 68, 0.2); color: var(--critical); }
    .badge.high { background: rgba(249, 115, 22, 0.2); color: var(--high); }
    .badge.moderate { background: rgba(234, 179, 8, 0.2); color: var(--moderate); }
    .badge.low { background: rgba(59, 130, 246, 0.2); color: var(--low); }
    
    a {
      color: #38bdf8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>🛡️ MAX FE Audit Report</h1>
        <p style="margin:4px 0 0; color: var(--text-muted);">Generated automatically by Jenkins Pipeline</p>
      </div>
      <div class="timestamp">Generated: ${timestamp}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card critical">
        <div>Critical Vulnerabilities</div>
        <div class="number">${auditSummary.critical || 0}</div>
      </div>
      <div class="stat-card high">
        <div>High Vulnerabilities</div>
        <div class="number">${auditSummary.high || 0}</div>
      </div>
      <div class="stat-card moderate">
        <div>Moderate Vulnerabilities</div>
        <div class="number">${auditSummary.moderate || 0}</div>
      </div>
      <div class="stat-card low">
        <div>Low Vulnerabilities</div>
        <div class="number">${auditSummary.low || 0}</div>
      </div>
      <div class="stat-card outdated">
        <div>Outdated Libraries</div>
        <div class="number">${outdatedRows.length}</div>
      </div>
    </div>

    <section>
      <h2>⚠️ Vulnerable Dependencies (${vulnRows.length})</h2>
      ${vulnRows.length === 0 ? '<p style="color:var(--success);">✅ No known vulnerabilities found!</p>' : `
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Severity</th>
            <th>Vulnerability Issue / Via</th>
            <th>Affected Version Range</th>
            <th>Recommended Action / Fix</th>
            <th>Repository / Docs</th>
          </tr>
        </thead>
        <tbody>
          ${vulnRows.map(r => `
            <tr>
              <td><strong>${r.package}</strong></td>
              <td><span class="badge ${r.severity}">${r.severity}</span></td>
              <td>${r.via}</td>
              <td><code>${r.range}</code></td>
              <td>${r.fixAvailable}</td>
              <td><a href="${r.repoUrl}" target="_blank" rel="noopener">View Package ↗</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </section>

    <section>
      <h2>📦 Outdated Dependencies (${outdatedRows.length})</h2>
      ${outdatedRows.length === 0 ? '<p style="color:var(--success);">✅ All dependencies are up to date!</p>' : `
      <table>
        <thead>
          <tr>
            <th>Package Name</th>
            <th>Current Version</th>
            <th>Wanted Version</th>
            <th>Latest Version</th>
            <th>Type</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          ${outdatedRows.map(r => `
            <tr>
              <td><strong>${r.package}</strong></td>
              <td><code>${r.current}</code></td>
              <td><code>${r.wanted}</code></td>
              <td><strong style="color:#a855f7">${r.latest}</strong></td>
              <td>${r.type}</td>
              <td><a href="${r.repoUrl}" target="_blank" rel="noopener">View Repo ↗</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </section>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'fe-audit-report.html'), htmlContent, 'utf8');
fs.writeFileSync(path.join(outputDir, 'fe-audit-summary.json'), JSON.stringify({ auditSummary, outdatedCount: outdatedRows.length, timestamp }, null, 2), 'utf8');

console.log('✅ MAX FE Audit Report generated successfully at: frontend/audit-reports/fe-audit-report.html');
