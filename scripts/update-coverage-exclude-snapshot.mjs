#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const excludeJsonPath = 'coverage-exclude.json';
const snapshotPath = '.ci/coverage-exclude.snapshot.txt';

// Read current exclusion list
const json = JSON.parse(fs.readFileSync(excludeJsonPath, 'utf8'));
const currentCount = json.files.length;

// Create directory if needed
fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });

// Write snapshot
fs.writeFileSync(snapshotPath, String(currentCount));

console.log(`📌 snapshot updated: coverage.exclude budget = ${currentCount}`);
console.log(`   File: ${snapshotPath}`);
