#!/usr/bin/env node
// Add a link (or an empty folder) to the homepage in app/desktop/tree.json. The homepage
// draws it as a voxel town: each top-level folder is an area, each link a building.
//
//   node scripts/add-link.mjs --list
//   node scripts/add-link.mjs --folder "untitled folder/explainers" --name "how dns works" \
//        --href "https://reservetempo.github.io/how-dns-works/"
//   node scripts/add-link.mjs --folder "new folder"            (makes an empty folder)
//
// --folder is a path of folder names from the desktop, split by "/"; "" is the desktop
// itself. Folders that don't exist yet are made. Names must be unique inside a folder.
// --replace lets --name point an existing link at a new --href. --dry-run prints the
// result without writing it.
//
// In Git Bash, a site path like --href "/blog" is rewritten to a Windows path; run
// it with MSYS_NO_PATHCONV=1 in front, or from PowerShell. https:// links are fine.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TREE = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'desktop', 'tree.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) fail(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    if (['list', 'replace', 'dry-run'].includes(name)) args[name] = true;
    else if (['folder', 'name', 'href'].includes(name)) {
      if (i + 1 >= argv.length) fail(`${key} needs a value`);
      args[name] = argv[++i];
    } else fail(`Unknown option: ${key}`);
  }
  return args;
}

function fail(message) {
  console.error(`add-link: ${message}`);
  process.exit(1);
}

const isFolder = (item) => Array.isArray(item.items);

function list(node, depth = 0, path = '') {
  for (const item of node.items) {
    const indent = '  '.repeat(depth);
    if (isFolder(item)) {
      const p = path ? `${path}/${item.name}` : item.name;
      console.log(`${indent}${item.name}/   (${item.items.length} items; --folder "${p}")`);
      list(item, depth + 1, p);
    } else {
      console.log(`${indent}${item.name}  ->  ${item.href}`);
    }
  }
}

// Same layout as the hand-written file: one line per link, so diffs stay small.
function format(item, pad) {
  const q = JSON.stringify;
  if (!isFolder(item)) return `${pad}{ "name": ${q(item.name)}, "href": ${q(item.href)} }`;
  const inner = `${pad}  `;
  const head = item.name === undefined ? '' : `${inner}"name": ${q(item.name)},\n`;
  if (!item.items.length) return `${pad}{\n${head}${inner}"items": []\n${pad}}`;
  const children = item.items.map((child) => format(child, `${inner}  `)).join(',\n');
  return `${pad}{\n${head}${inner}"items": [\n${children}\n${inner}]\n${pad}}`;
}

const args = parseArgs(process.argv.slice(2));
const tree = JSON.parse(readFileSync(TREE, 'utf8'));

if (args.list) {
  console.log('Desktop/');
  list(tree, 1);
  process.exit(0);
}

if (args.folder === undefined) fail('give --folder (use "" for the desktop itself), or --list');
if (args.href !== undefined && !args.name) fail('--href needs --name');
if (args.name !== undefined && args.href === undefined) fail('--name needs --href');

const segments = args.folder.split('/').map((s) => s.trim()).filter(Boolean);
for (const s of [...segments, args.name ?? 'x']) {
  if (s.includes('/')) fail(`a name can't contain "/": ${s}`);
  if (s.length > 60) fail(`name is too long (60 characters max): ${s}`);
}
if (args.href !== undefined && !/^(https:\/\/|\/)/.test(args.href)) {
  fail(`--href must start with https:// or / (got ${args.href})`);
}

// Walk down the folder path, making folders that don't exist.
let node = tree;
const made = [];
for (const name of segments) {
  let next = node.items.find((item) => item.name === name);
  if (next && !isFolder(next)) fail(`"${name}" is a link, not a folder`);
  if (!next) {
    next = { name, items: [] };
    node.items.push(next);
    made.push(name);
  }
  node = next;
}

let action = made.length ? `made folder ${made.map((m) => `"${m}"`).join(' > ')}` : 'folder exists';
if (args.name) {
  const existing = node.items.find((item) => item.name === args.name);
  if (existing && isFolder(existing)) fail(`"${args.name}" is already a folder in "${args.folder}"`);
  if (existing && existing.href === args.href) {
    action += `; link "${args.name}" is already there`;
  } else if (existing && !args.replace) {
    fail(`"${args.name}" already links to ${existing.href} in "${args.folder}" (use --replace, or another --name)`);
  } else if (existing) {
    existing.href = args.href;
    action += `; pointed "${args.name}" at ${args.href}`;
  } else {
    node.items.push({ name: args.name, href: args.href });
    action += `; added "${args.name}" -> ${args.href}`;
  }
}

const out = `${format(tree, '')}\n`;
if (args['dry-run']) {
  console.log(out);
  console.log(`(dry run) ${action}`);
} else {
  writeFileSync(TREE, out);
  console.log(action);
}
const where = segments.length ? `#${segments.map(encodeURIComponent).join('/')}` : '';
console.log(`Opens at: /${where}`);
