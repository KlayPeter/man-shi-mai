# Monorepo 迁移记录

## 来源

| 原仓库 | 导入提交 | 新目录 |
| --- | --- | --- |
| https://github.com/KlayPeter/man-shi-mai-web | `948a901d143eaf1b3cc610318961ea5e80b4b249` | `apps/web` |
| https://github.com/KlayPeter/man-shi-mai-server | `36559d72066f0023061cc35e9df521ec5788adca` | `apps/server` |

目标仓库：<https://github.com/KlayPeter/man-shi-mai>，默认开发分支为 `main`。

迁移提交以两端原始 HEAD 为父提交，保留两边可达的原始提交及哈希。历史提交中的文件路径仍然是当时的应用根路径；迁移之后使用 `apps/web` 和 `apps/server`。可用 `git log --all --graph` 查看合并历史，或直接通过原始提交哈希查看旧文件。原仓库的 Issues、PR、Actions 设置和 GitHub Secrets 不会随 Git 历史迁移。

## 工作区约定

- 原本地仓库保留原状，并由根 `.gitignore` 忽略；新仓库不使用 Git submodule。
- 根目录原有学习材料保持本地，不纳入应用仓库；正式维护说明放入 `docs/`。
- Node 固定为 22.23.0，pnpm 固定为 10.33.2。
- 只有根目录维护锁文件。迁移从原锁文件合并依赖解析结果，保留应用的直接依赖版本。
- 后端 `p-retry` override 提升至根包配置；应用自身继续维护各自的依赖列表。
- 前后端默认端口分别为 8000、3000，Playwright 使用前端 8001、后端 3000。
- Next.js 14 沿用 `.eslintrc.json`，移除与现有 ESLint 8 不匹配的冗余 flat config。
- 后端 `lint` 改为只检查，主动修复使用 `pnpm --filter @man-shi-mai/server lint:fix`。
- Vitest、Jest、TypeScript、ESLint 配置保持按应用管理。
- `pnpm hooks:install` 安装根提交钩子，统一更新两端技能索引。

## 配置与发布

迁移后的最新文件树仅跟踪 `.env.example`。本机已有配置可复制到各应用目录使用，且不会提交。完整保留的旧历史仍包含原仓库当时已跟踪的文件。

两个应用独立部署；合并提交并不意味着部署平台会原子发布前后端。接口改动仍需保持兼容，或安排发布顺序。需要权限隔离时，应在部署平台分别配置环境变量和服务权限。

共享类型暂不抽取，避免在目录迁移时同时改变业务契约。后续可逐模块增加 `packages/contracts`，统一请求、响应和流式事件类型；该包应保持无 NestJS、数据库和服务密钥依赖。
