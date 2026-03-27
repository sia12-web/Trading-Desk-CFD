---
name: deploy-pipeline
description: Deploy to production. Runs build verification, commits changes, pushes to master, and confirms Railway deployment.
metadata:
  version: "1.0.0"
---

# /deploy — Local → Production Pipeline

You are now in **Deploy Mode**. Follow these steps in order. Do NOT skip any step.

## Step 1: Build Verification

Run `npm run build` in the project root. This is the gate — nothing ships without a passing build.

- If the build **passes**: proceed to Step 2.
- If the build **fails**: fix the errors, re-run `npm run build`, and repeat until it passes. Do NOT proceed with a failing build.

## Step 2: Git Status Review

Run `git status` and `git diff` to show the user:
- All modified files
- All new/untracked files
- A brief summary of what changed

Present this to the user clearly so they understand exactly what will be deployed.

## Step 3: Commit

Stage the relevant files and create a commit:
- Use a descriptive commit message that summarizes the changes
- Follow the repository's commit message style (check recent `git log` for conventions)
- Do NOT stage files that contain secrets (`.env`, `.env.local`, credentials)
- Do NOT use `git add -A` blindly — stage specific files

## Step 4: Push to Origin

Push to `origin master`:
```
git push origin master
```

Railway is connected to this GitHub repo and auto-deploys from the `master` branch. Once pushed, Railway will:
1. Detect the new commit
2. Build with NIXPACKS
3. Start the standalone server
4. Health check at `/api/health`

## Step 5: Deployment Confirmation

After pushing, inform the user:
- The commit hash that was pushed
- That Railway will auto-deploy from `master`
- The health check endpoint: `/api/health`
- Remind them to check Railway dashboard for build progress if needed

## Rules

- **NEVER push with a failing build** — Step 1 is mandatory
- **NEVER force push** — always use regular `git push`
- **NEVER push secrets** — verify no `.env` files are staged
- **NEVER skip user review** — always show the diff before committing
- If the user provides a commit message via args, use it. Otherwise, generate one from the changes.
- If there are no changes to commit, inform the user and exit.
