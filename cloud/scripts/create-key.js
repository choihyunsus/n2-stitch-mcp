#!/usr/bin/env node
/**
 * N2 Cloud — API Key Creation CLI
 * 
 * Usage:
 *   node scripts/create-key.js --name "홍길동" --plan pro
 *   node scripts/create-key.js --name "Test User" --plan free --email "test@example.com"
 *   node scripts/create-key.js --name "Developer" --plan pro --stitch-key "AIza..."
 */

import { UserDB } from '../src/n2-auth.js';

const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  debug: () => { },
};

// ── Parse args ──────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) result.name = args[++i];
    else if (args[i] === '--email' && args[i + 1]) result.email = args[++i];
    else if (args[i] === '--plan' && args[i + 1]) result.plan = args[++i];
    else if (args[i] === '--stitch-key' && args[i + 1]) result.stitchKey = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') result.help = true;
  }

  return result;
}

// ── Main ────────────────────────────────────────────────

const args = parseArgs();

if (args.help || !args.name) {
  console.log(`
╔══════════════════════════════════════════════╗
║         N2 Cloud — API Key Generator         ║
╚══════════════════════════════════════════════╝

Usage:
  node scripts/create-key.js --name "Name" [options]

Options:
  --name <name>         User name (required)
  --email <email>       User email
  --plan <plan>         Plan: free, pro, team, test (default: free)
  --stitch-key <key>    User's Stitch API key (will be encrypted)
  --help, -h            Show this help

Plans:
  free   20 Stitch/month, 200 search/month
  pro    Unlimited (all features)
  team   Unlimited + 5 team keys
  test   Same as free, but uses test key prefix

Examples:
  node scripts/create-key.js --name "홍길동" --plan pro
  node scripts/create-key.js --name "Test" --plan test
  node scripts/create-key.js --name "Dev" --plan pro --stitch-key "AIzaSy..."
`);
  process.exit(args.help ? 0 : 1);
}

const userDB = new UserDB(logger);
const encryptionSecret = process.env.ENCRYPTION_SECRET || 'n2-cloud-encryption-key';
const apiKey = userDB.create(
  args.name,
  args.email || '',
  args.plan || 'free',
  args.stitchKey || '',
  encryptionSecret
);

console.log(`
╔══════════════════════════════════════════════╗
║            ✅ API Key Created!                ║
╠══════════════════════════════════════════════╣
║  Name:  ${args.name.padEnd(35)}║
║  Plan:  ${(args.plan || 'free').padEnd(35)}║
║  Key:   ${apiKey.padEnd(35)}║
╚══════════════════════════════════════════════╝

⚠️  Save this key! It won't be shown again.

MCP Config (add to your settings):
{
  "mcpServers": {
    "n2-stitch-cloud": {
      "url": "https://cloud.nton2.com/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}
`);
