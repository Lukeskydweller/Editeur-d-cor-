#!/usr/bin/env node
import fs from 'node:fs';

const excludeJsonPath = 'coverage-exclude.json';
const snapshotPath = '.ci/coverage-exclude.snapshot.txt';

// Read current exclusion list
const json = JSON.parse(fs.readFileSync(excludeJsonPath, 'utf8'));
const currentCount = json.files.length;

// ❌ Sur PR, pas de création implicite : le snapshot DOIT exister
if (!fs.existsSync(snapshotPath)) {
  console.error(`❌ coverage budget snapshot missing.`);
  console.error(`   It must be created/updated on main only.`);
  console.error(`   Run: node scripts/update-coverage-exclude-snapshot.mjs`);
  process.exit(1);
}

// Read previous count
const previousCount = Number(fs.readFileSync(snapshotPath, 'utf8').toString().trim());

// Check if list grew
if (currentCount > previousCount) {
  console.error(`❌ coverage.exclude budget exceeded!`);
  console.error(`   Previous: ${previousCount} files`);
  console.error(`   Current:  ${currentCount} files`);
  console.error(`   Increase: +${currentCount - previousCount}`);
  console.error(``);
  console.error(`⚠️  You cannot add files to coverage.exclude!`);
  console.error(`   Instead: Add tests to existing excluded files and remove them from the list.`);
  console.error(`   Goal: Reduce excluded files, never increase them.`);
  process.exit(1);
}

// Check if list decreased (good!)
if (currentCount < previousCount) {
  console.log(`✅ coverage.exclude budget REDUCED! 🎉`);
  console.log(`   Previous: ${previousCount} files`);
  console.log(`   Current:  ${currentCount} files`);
  console.log(`   Reduced:  -${previousCount - currentCount}`);
  console.log(``);
  console.log(`⚠️  Snapshot will be updated automatically on main branch.`);
  console.log(`   Merge this PR to persist the new budget.`);
  process.exit(0);
}

// List unchanged
console.log(`✅ coverage.exclude within budget (${currentCount} files)`);
console.log(`   Goal: Reduce to 0 by adding tests progressively.`);
