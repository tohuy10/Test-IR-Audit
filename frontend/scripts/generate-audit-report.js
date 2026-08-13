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

// Load package.json for dependency type lookup
let pkgJson = {};
try {
  pkgJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
} catch (e) {}

function getDepType(pkgName) {
  if (pkgJson.devDependencies && pkgJson.devDependencies[pkgName]) return 'devDependency';
  if (pkgJson.dependencies && pkgJson.dependencies[pkgName]) return 'dependency';
  return 'transitive';
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
    type: getDepType(pkg),
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

// Sort Vulnerabilities by Severity Priority: Critical -> High -> Moderate -> Low -> Info
const severityRank = {
  critical: 1,
  high: 2,
  moderate: 3,
  low: 4,
  info: 5,
  unknown: 6
};

vulnRows.sort((a, b) => {
  const rankA = severityRank[a.severity.toLowerCase()] || 99;
  const rankB = severityRank[b.severity.toLowerCase()] || 99;
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return a.package.localeCompare(b.package);
});

// Generate HTML Report
const timestamp = new Date().toISOString();
const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAX FE Audit Report</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --table-header-bg: #f1f5f9;
      --table-hover: #f8fafc;
      --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08);
      --title-color: #0284c7;
      --critical: #dc2626;
      --critical-bg: #fef2f2;
      --high: #ea580c;
      --high-bg: #fff7ed;
      --moderate: #d97706;
      --moderate-bg: #fffbeb;
      --low: #2563eb;
      --low-bg: #eff6ff;
      --outdated: #9333ea;
      --outdated-bg: #faf5ff;
      --success: #16a34a;
      --link: #0284c7;
      --code-bg: #f1f5f9;
    }

    [data-theme="dark"] {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --table-header-bg: #0f172a;
      --table-hover: #334155;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      --title-color: #38bdf8;
      --critical: #ef4444;
      --critical-bg: rgba(239, 68, 68, 0.15);
      --high: #f97316;
      --high-bg: rgba(249, 115, 22, 0.15);
      --moderate: #eab308;
      --moderate-bg: rgba(234, 179, 8, 0.15);
      --low: #3b82f6;
      --low-bg: rgba(59, 130, 246, 0.15);
      --outdated: #a855f7;
      --outdated-bg: rgba(168, 85, 247, 0.15);
      --success: #22c55e;
      --link: #38bdf8;
      --code-bg: #0f172a;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 24px;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow);
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--title-color);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .timestamp {
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 500;
    }
    .theme-toggle {
      background: var(--table-header-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    .theme-toggle:hover {
      border-color: var(--link);
      color: var(--link);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px 16px;
      text-align: center;
      box-shadow: var(--shadow);
      transition: transform 0.15s ease;
    }
    .stat-card:hover {
      transform: translateY(-2px);
    }
    .stat-card .label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .stat-card .number {
      font-size: 32px;
      font-weight: 800;
      margin-top: 6px;
      line-height: 1;
    }
    .stat-card.critical { border-top: 4px solid var(--critical); }
    .stat-card.critical .number { color: var(--critical); }
    .stat-card.high { border-top: 4px solid var(--high); }
    .stat-card.high .number { color: var(--high); }
    .stat-card.moderate { border-top: 4px solid var(--moderate); }
    .stat-card.moderate .number { color: var(--moderate); }
    .stat-card.low { border-top: 4px solid var(--low); }
    .stat-card.low .number { color: var(--low); }
    .stat-card.outdated { border-top: 4px solid var(--outdated); }
    .stat-card.outdated .number { color: var(--outdated); }

    section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow);
    }
    h2 {
      margin-top: 0;
      font-size: 17px;
      font-weight: 700;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      text-align: left;
    }
    th, td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      font-size: 13.5px;
    }
    th {
      background: var(--table-header-bg);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tbody tr:hover {
      background-color: var(--table-hover);
    }
    code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge.critical { background: var(--critical-bg); color: var(--critical); border: 1px solid var(--critical); }
    .badge.high { background: var(--high-bg); color: var(--high); border: 1px solid var(--high); }
    .badge.moderate { background: var(--moderate-bg); color: var(--moderate); border: 1px solid var(--moderate); }
    .badge.low { background: var(--low-bg); color: var(--low); border: 1px solid var(--low); }
    
    a {
      color: var(--link);
      text-decoration: none;
      font-weight: 500;
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
        <p style="margin:4px 0 0; color: var(--text-muted); font-size: 13px;">Generated automatically by Jenkins Pipeline</p>
      </div>
      <div class="header-actions">
        <button class="theme-toggle" id="themeBtn" onclick="toggleTheme()">☀️ Light Mode</button>
        <div class="timestamp">Generated: ${timestamp}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card critical">
        <div class="label">Critical Vulnerabilities</div>
        <div class="number">${auditSummary.critical || 0}</div>
      </div>
      <div class="stat-card high">
        <div class="label">High Vulnerabilities</div>
        <div class="number">${auditSummary.high || 0}</div>
      </div>
      <div class="stat-card moderate">
        <div class="label">Moderate Vulnerabilities</div>
        <div class="number">${auditSummary.moderate || 0}</div>
      </div>
      <div class="stat-card low">
        <div class="label">Low Vulnerabilities</div>
        <div class="number">${auditSummary.low || 0}</div>
      </div>
      <div class="stat-card outdated">
        <div class="label">Outdated Libraries</div>
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
              <td><strong style="color:var(--outdated);">${r.latest}</strong></td>
              <td>${r.type}</td>
              <td><a href="${r.repoUrl}" target="_blank" rel="noopener">View Repo ↗</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </section>
  </div>
  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const themeBtn = document.getElementById('themeBtn');
      if (html.getAttribute('data-theme') === 'dark') {
        html.setAttribute('data-theme', 'light');
        themeBtn.innerHTML = '☀️ Light Mode';
        localStorage.setItem('theme', 'light');
      } else {
        html.setAttribute('data-theme', 'dark');
        themeBtn.innerHTML = '🌙 Dark Mode';
        localStorage.setItem('theme', 'dark');
      }
    }
    // Load saved theme preference if available
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      const btn = document.getElementById('themeBtn');
      if (btn) btn.innerHTML = savedTheme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'fe-audit-report.html'), htmlContent, 'utf8');
fs.writeFileSync(path.join(outputDir, 'fe-audit-summary.json'), JSON.stringify({ auditSummary, outdatedCount: outdatedRows.length, timestamp }, null, 2), 'utf8');

console.log('✅ MAX FE Audit Report generated successfully at: frontend/audit-reports/fe-audit-report.html');
