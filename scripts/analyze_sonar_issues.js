const fs = require('fs');

const data = JSON.parse(fs.readFileSync('sonar_issues_raw.json', 'utf8'));
const issues = data.issues;
const measures = data.measures;

console.log('Total issues:', issues.length);

// Categorization
const byType = {};
const bySeverity = {};
const byImpact = {};
const byRule = {};
const byComponent = {};
const byCleanCodeAttribute = {};

const bugs = [];
const vulnerabilities = [];
const blockerCriticalMajor = [];

for (const issue of issues) {
  // by type
  byType[issue.type] = (byType[issue.type] || 0) + 1;
  // by severity
  bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  
  // by impact
  if (issue.impacts) {
    for (const imp of issue.impacts) {
      byImpact[imp.softwareQuality] = (byImpact[imp.softwareQuality] || 0) + 1;
    }
  }

  // by rule
  const ruleKey = issue.rule + ' - ' + issue.message.split('.')[0];
  if (!byRule[issue.rule]) {
    byRule[issue.rule] = { count: 0, rule: issue.rule, messageSample: issue.message, severity: issue.severity, type: issue.type, examples: [] };
  }
  byRule[issue.rule].count++;
  if (byRule[issue.rule].examples.length < 3) {
    byRule[issue.rule].examples.push({
      component: issue.component.replace('Felipecoder07_Arenix:', ''),
      line: issue.line,
      message: issue.message
    });
  }

  // by component (file)
  const cleanComp = issue.component.replace('Felipecoder07_Arenix:', '');
  if (!byComponent[cleanComp]) {
    byComponent[cleanComp] = { count: 0, file: cleanComp, types: {}, severities: {}, issues: [] };
  }
  byComponent[cleanComp].count++;
  byComponent[cleanComp].types[issue.type] = (byComponent[cleanComp].types[issue.type] || 0) + 1;
  byComponent[cleanComp].severities[issue.severity] = (byComponent[cleanComp].severities[issue.severity] || 0) + 1;
  byComponent[cleanComp].issues.push({
    severity: issue.severity,
    type: issue.type,
    line: issue.line,
    rule: issue.rule,
    message: issue.message
  });

  if (issue.type === 'BUG') {
    bugs.push({ ...issue, cleanComponent: cleanComp });
  }
  if (issue.type === 'VULNERABILITY') {
    vulnerabilities.push({ ...issue, cleanComponent: cleanComp });
  }
  if (['BLOCKER', 'CRITICAL', 'MAJOR'].includes(issue.severity)) {
    blockerCriticalMajor.push({ ...issue, cleanComponent: cleanComp });
  }
}

console.log('--- Summary by Type ---');
console.log(byType);
console.log('--- Summary by Severity ---');
console.log(bySeverity);
console.log('--- Vulnerabilities Count ---', vulnerabilities.length);
console.log('--- Bugs Count ---', bugs.length);

fs.writeFileSync('sonar_summary.json', JSON.stringify({
  total: issues.length,
  byType,
  bySeverity,
  byImpact,
  topRules: Object.values(byRule).sort((a, b) => b.count - a.count),
  topFiles: Object.values(byComponent).sort((a, b) => b.count - a.count),
  vulnerabilities,
  bugs,
  blockerCriticalMajor
}, null, 2));

console.log('Saved sonar_summary.json');
