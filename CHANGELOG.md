# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- Fix: skill `description` viết bằng **YAML block scalar** (`description: |` rồi xuống dòng) bị đọc thành đúng một ký tự `"|"` — skill `ponytail` đi kèm package đang ở tình trạng này, nên nó không bao giờ được chọn vì description không nêu trigger nào. Cả `scripts/generate-skills.ts` và `src/skills/file-loader.ts` giờ đọc đúng cả `|` và `>`, gộp thành một dòng. Test mới phủ cả hai kiểu
- Fix: `ask-questions-if-underspecified` và `ponytail` có description mở đầu bằng chủ đề thay vì trigger; test mới bắt buộc mọi skill builtin phải có description ≥ 20 ký tự và bắt đầu bằng "Use when/before/after/during"
- Skills: viết lại `brainstorming` — bản cũ chỉ 53 dòng và bắt hỏi từng câu kể cả khi request đã rõ. Bản mới có cổng "bạn thực sự biết gì?" (việc đã quyết thì làm luôn, đừng tra khảo), nguyên tắc đọc code/plan trước khi hỏi, mỗi câu hỏi phải nói rõ câu trả lời sẽ đổi gì, và sửa chỗ mâu thuẫn: bản cũ dặn ghi design vào `docs/plans/` trong khi Hive lưu plan ở `.hive/features/<f>/plan.md`
- Skills: ba skill mới học từ obra/superpowers, viết lại theo các tool Hive chứ không chép nguyên văn — `using-hive` (bảng chọn skill theo ý định, vì trước đây `available_skills` tồn tại nhưng không agent nào được bảo phải đọc), `receiving-code-review` (kiểm chứng trước khi sửa, được phản biện có lý, cấm "Bạn nói đúng hoàn toàn"), `finishing-a-development-branch` (kiểm tra xanh → đưa lựa chọn merge/PR/giữ nguyên → **chạy lại test trên kết quả đã merge** rồi mới dọn dẹp)
- Skills: `executing-plans` giữ **sổ tiến độ** `.hive/features/<feature>/progress.md` (ghi base commit trước khi dispatch, mỗi task một dòng khi xong). Đây là lỗi đắt nhất mà superpowers ghi nhận: sau compaction controller quên và **chạy lại cả loạt task đã merge**; sổ + `git log` đáng tin hơn trí nhớ. Review chạy mỗi batch thay vì hỏi từng lần, và không còn bắt chờ duyệt giữa các batch
- Skills: `code-reviewer` có **vòng sửa có trần** (minor không vào vòng, vòng 4–5 đổi người làm + tăng bậc model, tối đa 5 vòng, hết trần thì phán quyết có ghi sổ) và mục **Do Not Pre-Judge** (cấm dặn reviewer "đừng báo lỗi này")
- Skills: `skill-creator` sửa chỗ sai về format (frontmatter chỉ có `name` + `description`, thân bài tự do) và thêm quy trình kiểm thử skill kiểu TDD: đỏ (xem agent làm sai khi chưa có skill) → xanh → vá lỗi ngụy biện
- Agents: `zetta`/`architect` được dặn kiểm tra bảng skill **trước hành động đầu tiên**; `swarm` và `zetta` có hướng dẫn chọn model theo vai (việc máy móc → rẻ, tích hợp → trung bình, thiết kế/review cuối → mạnh nhất; số lượt ăn hơn giá token); `forager` có mục **Definition of Done** — "xong" nghĩa là có thứ vừa chạy chứng minh, không phải code trông đúng
- Fix: `agent_hive.schema.json` **khai báo đủ mọi key mà code đọc** — `vectorMemory`, `hiddenJudge`, `userProfile`, `tokenTruncation`, `sessionSnapshot`, `omoSlimEnabled` trước đây vắng mặt trong khi schema đặt `additionalProperties: false`, nên editor báo đỏ một `agent_hive.json` hoàn toàn hợp lệ. Test mới suy ra danh sách key từ `HiveConfig` nên hai bên không lệch lại được
- Fix: bỏ `agentBooster` khỏi `HiveConfig` và `DEFAULT_HIVE_CONFIG` — cấu hình còn sót của gói đã thay bằng engine có sẵn, không còn đoạn code nào đọc nó
- Fix: `vectorMemory.enabled` / `vectorMemory.indexPath` không được khai báo trong schema vì **không có chỗ nào đọc** (memory luôn bật, đường dẫn cố định); `rtk` thì được khai báo vì shell hook có dùng
- Fix: RTK **không còn tự tải binary** từ GitHub. Trước đây mỗi lần nạp plugin, `ensureRtkInstalled()` gọi GitHub API + tải `.tar.gz`, giải nén rồi **ghi đè `event.command`** trỏ vào binary vừa tải mà không kiểm chứng — tải hỏng là mọi lệnh shell mang tiền tố đường dẫn không tồn tại. Nay Hive chỉ dùng `rtk` khi binary nằm trên PATH (hoặc binary cũ còn trong `~/.config/opencode/hive/bin`), kiểm tra thực thi được trước khi prefix; không có thì lệnh chạy nguyên vẹn, không gọi mạng
- Fix: `rtk` (và `enabled`/`command` của nó) được **khai báo trong `agent_hive.schema.json`** — trước đây schema đặt `additionalProperties: false` mà thiếu key này nên editor báo đỏ một cấu hình hợp lệ
- Fix: `ast_grep_*` trả kết quả có cấu trúc khi **thiếu `@ast-grep/napi`** (native binary tải hỏng / cài thiếu) thay vì ném lỗi thô. Trước đây loader `throw` mà không tool nào bắt, nên cả 5 tool `ast_grep_*` trả exception; nay trả `success: false` kèm `reason`, các lựa chọn thay thế (`code_search`, `grep`, `call_graph_extract`) và cách sửa, plugin và các tool khác vẫn chạy bình thường

## [2.0.3] - 2026-10-24
- Fix: agent được cài **một lần ở global** (`$XDG_CONFIG_HOME/opencode/agents`, mặc định `~/.config/opencode/agents`) thay vì ghi `<project>/.opencode/agents` mỗi lần mở project như 2.0.0–2.0.2; override bằng `OPENCODE_AGENTS_DIR`
- Fix: setup dọn các file agent do bản 2.x cũ để lại trong `<project>/.opencode/agents/` (chỉ đúng tên agent của Hive, giữ agent người dùng tự viết; xoá thư mục `agents` nếu rỗng)
- Fix: `hive_code_edit` không còn phụ thuộc `@sparkleideas/agent-booster` (package gần như không còn được cập nhật). Hive có engine riêng: khớp **chính xác** trước, sau đó khớp kiểu **bỏ qua thụt lề** và giữ thụt lề của file; lỗi trả về dòng gần giống nhất và **không** ghi file
- Fix: `hive_booster_status` báo `builtin` với `capabilities { apply, lazyApply }`, không còn bước cài package; `hive_lazy_edit` ghép marker bằng code của Hive
- Fix: frontmatter agent không còn dòng permission trùng do alias v1 (`edit` ×2, `subagent` ×2)
- Fix: plugin setup **không còn cài tool package** — `bun-pty`, `auto-cr-cmd`, `btca` được cài ở lần dùng tool đầu tiên (`ensureToolInstalled`), nên việc mở plugin (mỗi file `bun test`, mỗi lần sửa code trong project) không còn gọi mạng và không còn phụ thuộc máy có npm hay không. Đây là nguyên nhân bước `Test opencode-hive` đỏ ở CI cho 2.0.1–2.0.3 (`/bin/sh: 1: npm: not found`)
- Fix: auto-install cài **từng gói một**, log `Installed via npm: ...` / `Unavailable: ...` theo từng package, nên một dependency chết (`agentdb@alpha` publish thiếu `dist/`) không kéo cả cụm xuống; không có `npm` lẫn `bun` trên PATH thì bỏ qua im lặng thay vì cảnh báo mỗi lần nạp
- Fix: **bỏ hẳn `@sparkleideas/memory`** (không bản nào trên npm có API facade Hive cần + `agentdb@alpha` thiếu `dist/`). Hive tự lưu memory vào sharded JSON (`hive_vector_*`) và tìm bằng text search; `hive_vector_status` báo `Built-in text search (sharded)`. Memory cũ vẫn đọc được, không cần cài gì thêm
- Fix: hai workflow đưa `bun` vào `GITHUB_PATH` — setup-bun chỉ đặt PATH cho step của chính nó, nên `bun test` chạy bằng một bun khác với `bun install` và không thấy workspace link (`Cannot find module '@opencode/plugin'`); kèm bỏ lần `npm install -g npm@11` bị lặp trong bước publish của Release
- Fix: test `ensureCodegraphInit` chấp nhận skip khi máy không có `codegraph` trên PATH (PATH của CI khác máy dev)
- Tests: **647 pass / 0 fail** (opencode-hive), **150 pass / 0 fail** (hive-core), `tsc --noEmit` sạch, build dist 1.11 MB không còn tham chiếu `@sparkleideas/*`; verify trên OpenCode 2.1.4 thật với config/HOME cô lập (project mới không sinh `.opencode/agents`, `hive_code_edit` → `Applied via exact`); chạy lại đúng chuỗi lệnh CI trên checkout sạch, HOME rỗng, **không có Node** — xanh, không một lần gọi mạng

## [2.0.2] - 2026-10-24
- Fix: khôi phục hành vi v1 cho agent — `build` và `plan` được hạ về `mode: "subagent"` qua `agentEditor.update`, để `zetta` là agent primary duy nhất người dùng thấy; các agent hệ thống ẩn (`compaction`, `title`, `summary`) vẫn giữ `primary` (hạ chúng làm `opencode run` lỗi `AgentNotFoundError`)
- Fix: ngừng ghi `temperature` vào frontmatter agent `.md` — OpenCode 2.1 không còn hỗ trợ field này và log `ignored unsupported agent fields: ["temperature"]` cho mọi agent mỗi lần khởi động; `temperature` trong `agent_hive.json` vẫn được nhận để tương thích
- Fix: `hive_tasks_sync` cảnh báo khi plan có `## Tasks` nhưng không có header dạng `### 1. Tên task` — trước đây trả `0 created` im lặng (dễ mất task đã có)
- Fix: cho phép `hive_worktree_commit` commit lại task đã `done` khi branch chưa có commit nào (lần trước kết thúc với "No changes to commit"), thay vì chặn bằng `invalid_task_state`
- Fix: `verificationNote` không còn báo thiếu evidence khi summary có dòng `Verification:` / `verify`
- Tests: **626 pass / 0 fail** (opencode-hive), **150 pass / 0 fail** (hive-core), `tsc --noEmit` sạch, build dist 1.12 MB
- Verify: chạy OpenCode 2.1.3/2.1.4 thật — agent catalog `build|subagent`, `plan|subagent`, `zetta` là default; `opencode run` trả lời với `> zetta · ...`; agent md không còn `temperature` và không còn warning

## [2.0.1] - 2026-10-23
- Fix: npm install báo `PluginModule.LoadError: Plugin entrypoint not found` khi cấu hình `plugins: ["@hung319/opencode-hive"]` — `exports["."]` trỏ `./index.js`, nhưng shim này không nằm trong `files` nên không được publish, còn build thật nằm ở `dist/index.js`; đổi `exports["."]` sang `./dist/index.js` kèm condition `types`
- Fix: thêm `"./package.json"` vào `exports` để công cụ đọc metadata không bị chặn bởi exports map
- Verify: `npm pack` → cài tarball vào project sạch → `import('@hung319/opencode-hive')` trả `id: "opencode-hive"`; opencode v2.1.3 nạp plugin từ `dist/index.js`

## [2.0.0] - 2026-10-22
- Breaking: port toàn bộ plugin sang **OpenCode V2 plugin API** — bỏ hỗ trợ OpenCode V1: `Plugin.define({ id, setup(ctx) → cleanup })`
  - Hooks mapping: `experimental.chat.system.transform` → session `context` hook (system injection + per-agent hive-tool gate); `experimental.session.compacting` → session `compaction` hook; per-agent tools deny map → context-hook gating; tool executes → compat layer `(args, v2Context)` với kết quả `{content}`
  - Agent bootstrap: sinh `.opencode/agents/*.md` (permissions YAML flow-map, model ref `provider/model#variant`, frontmatter `temperature`); built-in agents giữ nguyên (demoting `build` làm vỡ `opencode run`); default primary qua `agentEditor.default("zetta")`
  - Client: `session.generate`, `OpenCodeProviderService(defaultSessionID)`, `session.synthetic` cho HiddenJudge/compaction restoration
  - Loader fix: V2 resolve entry `index.js` tầng gốc của thư mục plugin — ship root `index.js` shim + `package.json` `exports`
- Feat: V2 docs-sync — `temperature` render vào agent md frontmatter (field hợp lệ theo schema/docs V2), giữ đúng ví dụ custom-agents trong README
- Tests: harness V2 dùng chung (`runV2PluginSetup`/`execTool`/`agentPromptProxy`); port 5 e2e suites + tests services; **624 pass / 0 fail / 1 skip**, `tsc` sạch, build dist 1.12 MB
- Verify: smoke runtime thật với opencode v2.1.2 — plugin nạp, zetta là default agent, exit=0

## [1.21.2] - 2026-08-23
- Fix: CodeGraph MCP báo `MCP error -32000: Connection closed` khi chạy trong OpenCode — `process.execPath` trả về binary OpenCode (Bun) thay vì Node; thêm `isNodeBinary()` + fallback `findNodeBinary()` (npm-shim với node thật → managed bundle → PATH)

## [1.21.1] - 2026-08-23
- Feat: Codegraph MCP không còn cần restart — đăng ký thẳng launcher `npm-shim.js` của dependency `@colbymchenry/codegraph` (tự resolve platform bundle, tự tải lúc spawn đầu tiên nếu thiếu); fallback: bundle marker cũ → executable trên PATH
- Refactor: bỏ bộ downloader/TTL/checksum tự viết (~600 dòng net) — binary update đi kèm bản release plugin; boot plugin không còn gọi network cho codegraph

## [1.21.0] - 2026-08-23
- Feat: Codegraph MCP auto-provisioning — installer tải self-contained bundle từ `colbymchenry/codegraph` releases (verify SHA256SUMS) vào `~/.config/opencode/hive/codegraph/<ver>` với marker `current.json`; auto-update mode resolve bản latest qua redirect `releases/latest` (không dùng GitHub API — rate limit), re-check tối đa 1 lần/ngày (TTL 24h), tự upgrade + sweep version dir cũ
- Feat: MCP `codegraph` chỉ được đăng ký khi binary available (absolute launcher path) — hết lỗi đỏ ENOENT khi thiếu binary; boot chain fire-and-forget install → per-project `init`/`sync`
- Fix: CI — extract bundle qua argv-array `execFileSync('tar', [...])` thay vì shell-string `execSync` (Bun shell-spawn báo "command not found" trên runners); `isCodegraphOnPath` scan PATH trực tiếp bằng JS (Bun snapshot env lúc startup, child không thấy runtime PATH mutation)
- Tests: +47 (installer, version parsing, mcp filtering, init flow)

## [1.20.7] - 2026-08-22
- Fix: Vector false-positive — validate `add/search` facade before reporting HNSW ready (v3 alpha exports classes `UnifiedMemoryService/HNSWIndex`, not facade), fallback to text-search honestly; no compatible `@sparkleideas/memory` on npm (3.5.2-patch.1 tarball missing `dist`)
- Fix: Booster dist-tag `latest` points to `0.2.2-patch.32` (old), pin `agent-booster@0.2.34` with version-aware `isModuleResolvable` + `npm install --prefix` versioned

## [1.20.6] - 2026-08-22
- Fix: LSP pin `typescript@^5` (was `typescript@latest` → 7.0.2 Go port breaks language-server 6.x) + auto-downgrade check in `lsp-autoinstall` (detect 7.x → reinstall 5.9.3)
- Fix: Vector/booster global resolve — `tool-installer.getGlobalNpmRoot` tries `npm root -g` + bun/pnpm fallbacks + `~/.bun/install/global`, `vector-memory` also checks global root (was hive-only), stable HNSW vs fallback
- Chore: `tool-installer` auto-cleans stale `bin/dora` on next install

## [1.20.5] - 2026-08-22
- Refactor: LSP single registry (`lsp/registry.ts`) + single `getLspInstallDir`/`getLanguageFromPath` (`utils/lsp-path.ts`), rename `tools/lsp-manager.LspManager` → `LspStatusManager`, unify installers on same registry
- Refactor: Memory single filter config (`services/memory-config.ts`), `autoSaveProjectMemory` via block API (filter/limit/read-only), journal filtered, 4-layer doc
- Refactor: Installer skip-logic single `utils/skip-install.ts` (was 3 copies in tool/lsp/rtk installers)

## [1.20.3] - 2026-08-22
- Fix: LSP retry after ready (resolveServerPath via node_modules/.bin), vector init latch + instance assign, agent-booster global npm root detection

## [1.20.2] - 2026-08-22
- Fix: auto_cr_scan path last + quote, LSP bin path node_modules/.bin

## [1.20.1] - 2026-08-22
- Fix: 4 self-test bugs (ast-grep extensions crash, rewrite metavariable, typed-memory upsert, auto-cr bin alias) + remove dora

## [1.20.0] - 2026-08-22
- See docs/releases/v1.20.0.md (RTK replaces snip, new skills/MCP, test stability)

> **Note:** Detailed releases from 1.4.0 onward are in `docs/releases/v*.md`. This CHANGELOG is intentionally frozen at 1.3.1 for historical context; see `docs/releases/` for latest.

## [1.3.1] - 2026-03-17

### Added
- **Custom Multi-Model Subagents**: Users can now define `customAgents` in `~/.config/opencode/agent_hive.json` to create additional taskable workers and reviewers derived from `forager-worker` or `hygienic-reviewer`. Custom agents inherit the base prompt, tools, and permissions while allowing targeted overrides for `model`, `temperature`, `variant`, and `autoLoadSkills`
- **`hive_worktree_start` Tool**: New dedicated tool for normal task starts, split from `hive_worktree_create`. `hive_worktree_start` handles pending/failed tasks; `hive_worktree_create` is now exclusively for resuming blocked tasks (`continueFrom: "blocked"`)
- **Custom Agent Delegation in `hive_worktree_start`**: Returns `defaultAgent`, `eligibleAgents`, and delegation instructions so orchestrators can choose the best-matching configured worker instead of always using the built-in forager
- **Custom Agent Prompt Injection**: Configured custom subagents are surfaced in primary orchestrator prompts (`hive`, `architect-planner`, `swarm-orchestrator`) under a "Configured Custom Subagents" section for routing guidance
- **Reserved-Name Guardrails**: Custom agent IDs cannot shadow built-in Hive agents, plugin aliases, or OpenCode operational agent IDs
- **Seeded Config Templates**: `hive_init` generates `agent_hive.json` with commented-out custom agent examples that are self-disqualifying, making it easy to define custom agents by filling in real values
- **`compaction-hook.test.ts`** and **`hook-cadence.test.ts`**: New regression tests for hook behavior and cadence logic
- **`HOOK_CADENCE.md`**: Documentation for the hook cadence system

### Changed
- **`hive_worktree_create` API Hardened**: Now exclusively for blocked-resume paths. Rejects calls where task state is not `blocked` with a structured `terminal: true` error to stop retry loops. Returns `reason: "task_not_blocked"` and `correctTool: "hive_worktree_start"` for clear orchestrator guidance
- **Blocked-Resume Response Contracts**: All blocked-resume guard responses now include `success`, `terminal`, `reason`, and `nextAction` fields for machine-readable orchestration
- **Agent Prompts (Hive, Swarm)**: Updated tool guidance to use `hive_worktree_start` for normal starts and `hive_worktree_create` strictly for blocked resumes. Added "Configured Custom Subagents" section with reviewer routing guidance
- **Dependency Check responses**: `executeWorktreeStart` now returns `terminal: true` with `reason: "dependencies_not_done"` when task dependencies are unmet
- **`hive_status` nextAction**: Updated to suggest `hive_worktree_start` for runnable tasks
- **Skills Updated**: `dispatching-parallel-agents`, `executing-plans`, and `parallel-exploration` skills updated for `hive_worktree_start` / `hive_worktree_create` split
- **ConfigService Extended**: Normalizes custom agents, inherits effective base-agent runtime config, and exposes lookup helpers for custom agent resolution
- **Variant Hook Extended**: Applies configured variants to accepted custom agents through the shared `chat.message` variant hook path
- **VSCode Extension Aligned**: `exec.ts`, `status.ts`, `task.ts`, and `initNest.ts` updated to reflect the `hive_worktree_start` / `hive_worktree_create` semantics split
- **Version Bump**: Bumped root and package versions to `1.3.1` (`agent-hive`, `hive-core`, `opencode-hive`, `vscode-hive`)

### Fixed
- **Blocked-Resume Retry Loops**: Orchestrators that drifted into retrying `continueFrom: "blocked"` on non-blocked tasks now receive a hard terminal rejection with a corrective `nextAction`, breaking the loop
- **Skill Template Reference**: `parallel-exploration` skill now references `hive_worktree_start` (not `hive_worktree_create`) for parallel implementation work
- **Custom Agent Skill Deduplication**: Inherited `autoLoadSkills` are merged and deduplicated against base agent skills so skills are not loaded twice

### Design Notes
- Base agents supported for custom derivation: `forager-worker` and `hygienic-reviewer` only — primary planner/swarm/scout derivation explicitly out of scope (likely never supported)
- No automatic semantic router added; orchestrators still choose the worker/reviewer from prompt-visible descriptions — keeps models in control of routing decisions
- Custom prompt overrides not supported in this slice — the combination of Hive system prompt + role `description` field is sufficient for correct model "expert mode" activation
- Self-disqualifying config templates chosen over JSONC comments to maintain JSON schema compatibility

## [1.3.0] - 2026-02-25

### Added
- **Multi-Source Prompt Alignment (OMO + Claude + Anthropic + Codex)**: Updated Forager, Hive, Swarm, and Scout prompts with stronger intent extraction/verbalization, exploration hierarchy, verification discipline, and concise instruction patterns
- **PHILOSOPHY.md v1.3.0 Evolution Notes**: Added a dedicated evolution section documenting adopted patterns, rejected patterns, and rationale across all four source guides

### Changed
- **Verification Model**: Shifted from mandatory TDD verification to best-effort worker verification + orchestrator batch testing. Workers use ast-grep for lightweight code checks in worktrees (no project dependencies needed). Orchestrators run full build + test suite after merging each batch on the main branch
- **Forager Prompt**: Removed TDD flow, added best-effort ast-grep verification model. Workers focus on writing quality code with ~80% confidence, not overthinking verification. Added `ast_grep_scan-code` and `ast_grep_find_code` to Allowed Research tools
- **Hive Prompt**: Added Batch-Merge-Verify Workflow section — orchestrator merges batch, runs `build` + `test`, diagnoses failures with full context
- **Swarm Prompt**: Same batch-merge-verify workflow as Hive. Replaced "Merge only after verification passes" with batch workflow reference
- **AGENTS.md**: Updated worktree dependency note and P6 description to reflect best-effort + batch verification model
- **Verification Gate Softened**: `hive_worktree_commit` no longer hard-rejects commits without test/build keywords. Returns advisory `verificationNote` field instead, keeping keyword tracking for observability
- **Prompt Contract Cleanup**: Restored compatibility phrases required by prompt regression tests while keeping aligned behavior updates (turn termination wording, completion/blocked guidance, verification section headings)
- **Branch Hygiene for Hive Artifacts**: Removed `.hive/features/omo-pattern-alignment` files from git tracking on this branch while preserving local copies for operator continuity
- **Version Bump**: Bumped root and package versions to `1.3.0` (`agent-hive`, `hive-core`, `opencode-hive`, `vscode-hive`)

### Fixed
- **AST Tool Name Mismatch**: Replaced non-existent `ast_grep_search` prompt references with available AST tools
- **Plugin E2E Contract**: Updated plugin smoke test expectation to match advisory `verificationNote` behavior for `hive_worktree_commit` when verification evidence is missing

### Design Notes
- Symlinks for shared node_modules rejected: cross-platform risk (Windows), potential dependency conflicts
- Pure batch testing (zero worker verification) rejected: too many back-and-forth cycles
- ast-grep chosen over LLM self-review: already integrated via MCP, no new dependencies, ~80% accuracy vs ~50% for LLM review
- Agent prompts kept language-agnostic (not bun/node specific) since Hive supports Python, Go, Rust, etc.

## [1.2.0] - 2026-02-08

### Added
- **Docker Mastery Skill**: On-demand skill teaching agents container thinking — debugging, docker-compose, Dockerfile authoring, image optimization, integration testing. Primary user: Forager. Loaded via `hive_skill("docker-mastery")`
- **AGENTS.md Mastery Skill**: On-demand skill teaching agents what makes effective pseudo-memory — signal vs noise filtering, section structure, when to prune. Primary users: Hive, Swarm, Architect. Loaded via `hive_skill("agents-md-mastery")`
- **Atomic AGENTS.md Apply**: New `apply` action on `hive_agents_md` tool — agents propose → user approves → apply writes atomically to eliminate manual edit errors
- **Persistent Sandbox Containers**: One container per worktree, reused across commands via `docker exec`. 50 test runs = 1 container (not 50). Reduces overhead, speeds up test execution
- **Context Lifecycle Management**: `archive()` moves stale contexts to timestamped archive/, `stats()` reports context health (count/size/age), size warning at 20K chars
- **Sandbox Bypass Audit Logging**: All HOST: commands logged with `[hive:sandbox]` prefix for visibility into sandbox escape usage

### Changed
- **Discovery Gate Tightened**: Replaced substring match with regex + 100 char minimum content length. Empty or comment-hidden Discovery sections now rejected (P7 Hard Gates enforcement)
- **Forager Prompt**: Removed HOST: escape hatch documentation — agents must report as blocked and ask users when host access needed
- **Agent Prompts (Hive, Swarm, Forager)**: Added skill references for docker-mastery and agents-md-mastery
- **Skill Count**: 9 skills → 11 skills (docker-mastery, agents-md-mastery added)
- **JSON Schema**: Added sandbox, dockerImage, and persistentContainers properties to agent_hive.schema.json

### Fixed
- **Discovery Gate Bypass**: Empty Discovery sections or hidden Discovery headers (in HTML comments) no longer pass validation

## [1.1.1] - 2026-02-08

### Added
- **AGENTS.md Self-Maintenance Tool**: New `hive_agents_md` tool with `init` and `sync` operations — agents can bootstrap AGENTS.md from codebase analysis and propose updates from feature context discoveries (with approval gate per P2)
- **Docker Sandbox Isolation**: Level 1 Docker sandboxing for worker execution — transparent bash interception wraps test commands in containers, auto-detects project runtime (node/python/go/rust), includes `HOST:` escape hatch for host-level operations

### Changed
- **Architect Prompt Hardened**: Expanded intent classification with Strategy column, 6-item clearance checklist, Test Strategy section, Turn Termination rules
- **Forager Prompt Hardened**: "Resolve Before Blocking" guidance (try 3+ approaches), expanded Orient pre-flight, 6-item Completion Checklist
- **Forager Prompt**: Added Docker Sandbox awareness section to Iron Laws — explains transparent container wrapping and HOST: escape hatch
- **Scout Prompt Fixed**: Fixed leaked persistence example (truncated research dump), added year awareness to Iron Laws
- **Swarm Prompt Hardened**: Removed non-existent "oracle" subagent reference, added "After Delegation — VERIFY" checklist, Turn Termination
- **Hive Prompt Hardened**: Turn Termination (valid/invalid endings), Hard Blocks table replacing vague Iron Laws prose, AI-Slop Flags
- **Hygienic Prompt Hardened**: Agent-executable verification emphasis with ✅/❌ examples, expanded Active Implementation Simulation
- **Writing-Plans Skill**: Added agent-executable acceptance criteria guidance
- **Hive Skill Loading**: Added `systematic-debugging`, `test-driven-development`, `verification-before-completion` to Hive's skill table
- **PHILOSOPHY.md**: Added "Wax Seal" (sandbox) to Hive Terminology table, added v1.1.1 evolution notes documenting AGENTS.md integration and Docker sandbox design decisions
- **Agent Prompts (Hive + Swarm)**: Added AGENTS.md maintenance guidance — orchestrators sync context findings after feature completion

### Removed
- **Onboarding Skill**: Deleted — unreferenced by any agent (10 skills → 9)

### Fixed
- **Broken Skill References**: Fixed `executing-plans` referencing deleted `finishing-a-development-branch`, fixed `test-driven-development` referencing non-existent `@testing-anti-patterns.md`
- **Skill Registry Regenerated**: `registry.generated.ts` updated to reflect 9 skills

### Stats
- 6 agent prompts updated, 3 skills fixed/removed, 39 prompt tests added/updated
- Clean build across all 3 packages, 9 skills registered

## [1.1.0] - 2026-02-06

### Added
- **Worker Orient Phase**: Forager agents now run a pre-flight checklist before coding — read references, check patterns, verify assumptions. Prevents "code first, ask questions later" failures
- **Task-Type Auto-Inference**: `buildSpecContent()` automatically infers task type (greenfield/testing/modification/bugfix/refactoring) from task name and plan section, giving workers better context without manual annotation
- **Post-Batch Code Review Checkpoints**: After each batch merge, orchestrators (Hive + Swarm) prompt for optional Hygienic reviewer consultation to catch drift early
- **Scout Research Persistence**: Scout agents now persist research findings to context files via `hive_context_write`, so discoveries survive for future workers instead of dying with the session
- **Active Discovery**: Planning agents (Hive + Architect) challenge user assumptions during planning — collaborative pushback on proposals that may not survive "Good Enough Wins" (P4)
- **Worktree Info in `hive_status`**: Task status output now includes worktree path and branch info per task for better visibility

### Changed
- **Tool Consolidation**: Simplified from 22 tools → 14 tools by removing redundant background task and journal infrastructure
- **Tool Rename**: `hive_exec_start` → `hive_worktree_create`, `hive_exec_complete` → `hive_worktree_commit` — names now reflect the worktree-based execution model
- **Worker Summary Guidance**: Forager prompts now guide richer summaries (files changed, key decisions, gotchas, what's left) instead of the old notepad-based approach
- **All Agent Prompts Updated**: Hive, Swarm, Architect, Scout, Forager, Hygienic — all reflect the consolidated tool set and new capabilities
- **All Skills Updated**: Removed background task references, renamed exec→worktree throughout
- **VS Code Extension Updated**: Tool registrations reflect the 14-tool set

### Removed
- **Background Task Infrastructure**: ~5,000 lines deleted — `agent-gate.ts`, `concurrency.ts`, `manager.ts`, `poller.ts`, `store.ts`, `types.ts`, `background-tools.ts` and tests. The complexity wasn't justified; direct worktree execution is simpler and more reliable
- **`delegateMode` Config**: Removed from types and configuration — no longer needed without background tasks
- **Journal Infrastructure**: Removed journal paths, templates, and references from hive-core — journals were write-only artifacts nobody read
- **8 Redundant Tools**: `hive_background_start`, `hive_background_status`, `hive_background_cancel`, `hive_background_result`, `hive_exec_start`, `hive_exec_complete`, `hive_journal_read`, `hive_feature_status`
- **Dead Notepad References**: Cleaned up stale notepad guidance from forager prompt

### Fixed
- **Stale Tool References**: `hive_exec_start`/`hive_exec_complete` → `hive_worktree_create`/`hive_worktree_commit` in PHILOSOPHY.md and all documentation

### Stats
- 54 files changed, 512 insertions, 7,328 deletions (net ~6,800 lines removed)
- Test suite: 88 tests across 5 files (4 new tests for task-type inference)
- Clean build across all 3 packages (hive-core, opencode-hive, vscode-hive)

## [1.0.7] - 2026-02-04

### Added
- **E2E Smoke Tests**: Comprehensive end-to-end testing suite for the OpenCode plugin
  - Plugin smoke tests covering core functionality
  - Better test coverage for task delegation workflows
- **@path Prompt References**: Use `@path` prompt references for task delegation
  - More reliable worker prompt referencing for native tasks
  - Improved path handling in worker prompts

### Fixed
- **Missing Dependency Skills**: Fixed missing dependency skills in OpenCode agents
  - Align plan templates with updated dependency guidance
  - Architect agent: updated to include missing dependency skills
  - Hive agent: synchronized with new dependency handling
  - Swarm agent: added missing skill references
  - Skills registry: regenerated to include all required dependencies

### Changed
- **Documentation**: Enhanced documentation across all packages
  - AGENTS.md: Added guidance on worker prompt referencing
  - OpenCode Hive README: Expanded documentation on task delegation
  - DATA-MODEL.md: Updated data model documentation
  - HIVE-TOOLS.md: Clarified tool usage patterns
- **Writing-Plans Skill**: Major skill documentation update
  - 95 insertions, 52 deletions for better clarity
  - Better dependency annotation guidance
  - Clearer task structure documentation

## [1.0.6] - 2026-02-03

### Added
- **Task Dependency System**: Full dependency tracking and enforcement for task ordering
  - Parse task dependencies from plan templates using `@dep:task-name` syntax
  - Persist task dependencies in status metadata for runtime validation
  - Validate task dependency graphs during `hive_tasks_sync` to catch cycles and missing dependencies
  - Enforce dependencies at execution entrypoints to ensure proper task sequencing
  - Surface runnable tasks and dependency blocks in `hive_status` for visibility
  - Guide dependency-aware task batching to optimize parallel execution while respecting dependencies
  - Dependency annotations in plan templates with clear syntax documentation
- **Architect Task Delegation**: Allow Architect agent to delegate execution tasks via `task()` function
  - Enable Architect to transition from planning to execution by spawning workers
  - Document task() parallelism rules in dispatching-parallel-agents skill
  - Add task-mode guidance to parallel-exploration skill
  - Align Hive/Swarm prompts and tools template with delegateMode configuration

### Fixed
- **Scout Agent Improvements**: Prevent scout background recursion and auto-loading issues
  - Stop scout auto-loading parallel exploration skill unnecessarily
  - Block background delegation from subagents to prevent recursion
  - Disable delegation tools inside workers for proper permission boundaries
  - Deny delegation permissions for subagents to enforce architectural boundaries
  - Prevent scout background recursion with proper checks
- **Dependency Graph Alignment**: Fix alignment of legacy dependency fallback across all tools
- **Spec Generation**: Unify spec generation across sync and exec for consistency
- **Tool Alignment**: Align opencode hive tools with dependency graphs

### Changed
- **Documentation**: Comprehensive documentation updates
  - Standardize on `hive_background` tools terminology
  - Update background task reminders with better guidance
  - Describe dependency semantics in `hive_status` documentation
  - Clarify Architect task() delegation rules

### Tests
- Extended dependency parsing and enforcement coverage

## [1.0.5] - 2026-01-31

### Added
- Support user custom skills for autoloader

### Fixed
- Normalize Windows path casing in prompt validation and plan comments

## [1.0.4] - 2026-01-29

### Added
- New `code-reviewer` skill for reviewing code changes.

### Fixed
- Inject `autoLoadSkills` in prompts to ensure agents receive skill instructions reliably.


## [1.0.2] - 2026-01-27

### Added
- `agentMode` and `delegateMode` configuration for unified or dedicated agent orchestration.
- Gated agent registration based on `agentMode`.

### Changed
- Improved package-wide build scripts and build order using `bun --filter`.
- Updated default configuration generation and accessors.

### Fixed
- Resolved issues with `opencode.json` registration in unified mode.

## [1.0.1] - 2026-01-27

### Added
- Parallel exploration skill with default auto-load for planner agents.
- Per-agent model variant configuration in opencode-hive.
- Selective disable support for skills and MCPs.

### Changed
- Background task timeout guidance and defaults (30–120s guidance, 60s default).
- Delegation/planning tuning and worker prompt de-dup + prompt file delegation.

### Tests & Docs
- Stabilized runtime smoke tests and auto-load skill coverage.
- Documented per-agent variant configuration.

## [0.8.3] - 2026-01-20

- See the GitHub release/tag `v0.8.3` for details.


## [0.8.2] - 2026-01-11

- See the GitHub release/tag `v0.8.2` for details.
