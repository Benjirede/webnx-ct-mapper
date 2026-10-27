# Setup Guide

Setup instructions for **webnx-ct-mapper**.

**Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, Node.js API routes with a filesystem JSON cache.

## Prerequisites

- Git
- Node.js **20.9.0 or newer** (Node 20 LTS or 22 LTS both work). Node 18 will not run this project.

Check your version:

```bash
node -v
```

If it's older than 20.9.0, follow [Updating Node with nvm](#updating-node-with-nvm) below.

## Quick Start

1. Clone the repo from GitHub and move into it:

   ```bash
   git clone <repo-url>
   cd webnx-ct-mapper
   ```
2. Install dependencies from the lockfile:

   ```bash
   npm ci
   ```
3. Start the dev server:

   ```bash
   npm run dev
   ```
4. Open the site at [http://localhost:3000](http://localhost:3000).

## Updating Node with nvm

If `npm run dev` says your Node version is too old, install nvm and switch to Node 20 or newer.

```bash
# Install nvm (skip if you already have it)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

# Install and use Node 20 (or use 22)
nvm install 20
nvm use 20
node -v
```

To make it the default for new terminals:

```bash
nvm alias default 20
```

After changing Node versions, reinstall dependencies (see below), since native packages are built for a specific Node version.

## Troubleshooting

### Linux: "Cannot find native binding" / `@tailwindcss/oxide-linux-x64-gnu` not found

This is an npm bug with optional dependencies. It happens when the lockfile was generated on another OS and doesn't include the Linux binaries. Delete the lockfile and reinstall:

```bash
rm -rf node_modules package-lock.json .next
npm install
npm run dev
```

If the error persists, install the bmkminaries directly:

```bash
npm install -D @tailwindcss/oxide-linux-x64-gnu lightningcss-linux-x64-gnu
```

Note that this regenerates `package-lock.json`, so it will show up as changed in `git status`.

### Server won't start after switching Node versions

Clear the build output and reinstall:

```bash
rm -rf node_modules .next
npm ci
npm run dev
```

### Data directory errors

The API routes cache data as JSON files on the local filesystem. If the data directory is gitignored, create it manually and make sure your user can write to it:

```bash
mkdir -p data
```

## Production Build

```bash
npm run build
npm run start
```
