#!/usr/bin/env node

/**
 * Script to check for hard-coded background colors that should be replaced
 * with semantic color classes (bg-background-primary, bg-background-secondary, bg-background-tertiary)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const HARD_CODED_PATTERNS = [
  /\bbg-white\b/g,
  /\bbg-gray-50\b/g,
  /\bbg-gray-100\b/g,
  /\bbg-gray-200\b/g,
  /\bbg-gray-300\b/g,
  /\bbg-gray-800\b/g,
  /\bbg-gray-900\b/g,
  /\bbg-slate-\d+\b/g,
  /\bbg-zinc-\d+\b/g,
  /\bbg-neutral-\d+\b/g,
  /\bbg-stone-\d+\b/g,
];

// Patterns that are allowed (status badges, etc.)
const ALLOWED_PATTERNS = [
  /\bbg-(red|green|blue|yellow|orange|purple|indigo|amber|pink|violet)-\d+\b/g, // Status colors
  /\bbg-black\b/g, // Overlays
  /\bbg-primary-\d+\b/g, // Primary colors
  /\bbg-error-\d+\b/g, // Error colors
  /\bbg-success-\d+\b/g, // Success colors
  /\bbg-warning-\d+\b/g, // Warning colors
];

const EXCLUDE_DIRS = ['node_modules', '.next', '.turbo', 'dist', 'build'];
const INCLUDE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

interface Issue {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
}

function isAllowed(className: string): boolean {
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(className));
}

function findIssues(filePath: string): Issue[] {
  const issues: Issue[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    HARD_CODED_PATTERNS.forEach((pattern) => {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const fullMatch = match[0];
        if (!isAllowed(line)) {
          // Get context (surrounding code)
          const start = Math.max(0, match.index! - 30);
          const end = Math.min(line.length, match.index! + match[0].length + 30);
          const context = line.substring(start, end).trim();

          issues.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index! + 1,
            match: fullMatch,
            context,
          });
        }
      }
    });
  });

  return issues;
}

function scanDirectory(dir: string, baseDir: string = dir): Issue[] {
  const issues: Issue[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry)) {
        issues.push(...scanDirectory(fullPath, baseDir));
      }
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (INCLUDE_EXTENSIONS.includes(ext)) {
        // Only scan source files in src directory
        if (fullPath.includes('/src/') || fullPath.includes('\\src\\')) {
          issues.push(...findIssues(fullPath));
        }
      }
    }
  }

  return issues;
}

function main() {
  const srcDir = join(process.cwd(), 'src');
  console.log('Scanning for hard-coded background colors...\n');

  const issues = scanDirectory(srcDir);

  if (issues.length === 0) {
    console.log('✅ No hard-coded background colors found!');
    console.log('All components are using semantic color classes.');
    process.exit(0);
  }

  console.log(`❌ Found ${issues.length} issue(s) with hard-coded background colors:\n`);

  // Group by file
  const issuesByFile = new Map<string, Issue[]>();
  issues.forEach((issue) => {
    const relativePath = issue.file.replace(process.cwd(), '').replace(/^\//, '');
    if (!issuesByFile.has(relativePath)) {
      issuesByFile.set(relativePath, []);
    }
    issuesByFile.get(relativePath)!.push(issue);
  });

  // Print issues
  issuesByFile.forEach((fileIssues, file) => {
    console.log(`\n📄 ${file}`);
    fileIssues.forEach((issue) => {
      console.log(`   Line ${issue.line}:${issue.column} - Found: ${issue.match}`);
      console.log(`   Context: ...${issue.context}...`);
    });
  });

  console.log('\n💡 Replace hard-coded colors with semantic classes:');
  console.log('   - bg-white → bg-background-tertiary (elevated surfaces)');
  console.log('   - bg-gray-50 → bg-background-secondary (cards/content)');
  console.log('   - bg-gray-100 → bg-background-primary (page background)');
  console.log('   - bg-gray-800/900 → bg-background-secondary/tertiary (dark mode)');

  process.exit(1);
}

if (require.main === module) {
  main();
}

export { findIssues, scanDirectory };







