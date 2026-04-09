# n8n Builder — Claude Instructions

## Project Purpose

This project is for building and editing n8n workflows directly in my n8n instance. Claude uses the available MCP tools and skills to create, modify, debug, and review workflows based on my requests.

## Available Tools

### n8n MCP Server (czlonkowski/n8n-mcp)

**Documentation & validation:**

- `search_nodes` — find nodes by keyword before building
- `get_node` — get full node docs and parameter details
- `validate_node` — validate a node's configuration
- `validate_workflow` — validate a full workflow before pushing
- `search_templates` — find existing n8n community templates
- `get_template` — retrieve a complete template workflow JSON
- `tools_documentation` — get docs for any MCP tool

**Workflow management (requires API credentials — already configured):**

- `n8n_list_workflows` — list all workflows in the instance
- `n8n_get_workflow` — fetch a workflow by ID
- `n8n_create_workflow` — create a new workflow
- `n8n_update_full_workflow` — replace a workflow entirely
- `n8n_update_partial_workflow` — update specific parts of a workflow
- `n8n_delete_workflow` — delete a workflow
- `n8n_validate_workflow` — validate workflow against the live instance
- `n8n_autofix_workflow` — auto-fix common workflow issues
- `n8n_deploy_template` — deploy a template directly
- `n8n_test_workflow` — run a test execution
- `n8n_executions` — view recent execution history
- `n8n_health_check` — check instance connectivity

### Skills (czlonkowski/n8n-skills)

These activate automatically based on the task at hand:

- `n8n-workflow-patterns` — architectural patterns for webhooks, HTTP APIs, DB ops, AI integrations, scheduled tasks
- `n8n-node-configuration` — operation-aware node setup, property dependencies, AI connection types
- `n8n-expression-syntax` — `{{}}` syntax, `$json`/`$node`/`$now`/`$env` variables, expression debugging
- `n8n-validation-expert` — interpret validation errors and fix workflow issues
- `n8n-mcp-tools-expert` — guide for using MCP tools effectively, nodeType formats, validation profiles
- `n8n-code-javascript` — Code node JS patterns, data access, HTTP requests
- `n8n-code-python` — Code node Python patterns with n8n library limitations

## How to Approach Tasks

### Building a new workflow

1. Search existing workflows first (`search_workflows`) — avoid duplicating something that already exists
2. Ask for clarification on big architectural decisions (triggers, external services, data shape). For small details, make a reasonable assumption and note it.
3. Build the workflow following the quality standards below
4. Push directly to the n8n instance via MCP

### Editing an existing workflow

1. Fetch the full workflow JSON first (`get_workflow_details`) — never edit blind
2. Understand the existing structure before proposing changes
3. Make only the changes requested — don't refactor unrelated parts
4. Push the updated workflow via MCP

### Debugging a workflow

1. Fetch the workflow JSON and read it carefully
2. Identify the likely failure point before suggesting fixes
3. If execution data is available, use `execute_workflow` to reproduce the issue
4. Fix the root cause — don't add workarounds that mask the problem

### Reviewing / optimizing a workflow

1. Fetch and read the full workflow
2. Flag issues in order of severity: errors first, then reliability, then simplicity
3. Don't over-engineer — only suggest changes that provide clear value

## Workflow Quality Standards

### Error handling

- Every workflow must handle failure paths — use Error Trigger nodes or IF/Switch branches for error cases
- HTTP requests, AI agents, and external API calls must always have error branches
- Never let a workflow silently fail

### Sticky notes

- Add sticky notes to document: the workflow's purpose, any non-obvious logic, and configuration requirements (credentials, env vars)
- Group related nodes visually and label groups with sticky notes

### Node naming

- Use clear, descriptive names — not "HTTP Request1" but "Fetch Customer from Stripe"
- Action verbs first: "Fetch", "Parse", "Send", "Filter", "Store", "Format"
- Be consistent across the workflow

### Simplicity

- Fewer nodes is better — avoid chaining nodes when one can do the job
- Prefer built-in n8n nodes over Code nodes when possible
- If a Code node is needed, keep the logic focused and readable
- Avoid deeply nested expressions — break them into Set nodes if needed

## Output

Always push workflow changes directly to the n8n instance using MCP. After pushing, confirm what was done and note any assumptions made or anything the user should verify.

## Deployment Rules

- **On `staging` branch**: always deploy automatically — `git push origin staging` triggers a Vercel Preview deployment, no confirmation needed.
- **On `main` branch**: ALWAYS ask the user before deploying to production. Never run `git push origin main` without explicit approval.

## Boundaries

- Exception: if MCP server or n8n connectivity troubleshooting genuinely requires it, ask the user first before accessing anything outside this folder.

<response_style>

## Communication Rules

1. No victory laps  
   Do not announce completion with celebratory messages.

2. No unsolicited explanations  
   Do not explain changes unless explicitly asked.

3. No teaching unless requested  
   Avoid educational commentary or advice.

4. Minimal confirmations  
   Use "Done." or proceed silently.

5. No summaries unless asked  
   Complete the task and stop.

## When to provide detail

- When asked to explain or summarize
- When clarification is required
- When reporting blocking errors
- When presenting a plan for approval

## Response format

- Actions → minimal commentary
- Errors → brief, actionable
- Questions → concise, wait for reply
- Plans → structured list, then pause

</response_style>
