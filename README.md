# 面试麦

AI 智能面试与简历平台，采用 pnpm workspace 管理 Next.js 前端和 NestJS 后端。两个应用独立运行、构建和部署。

## 目录

```text
apps/
  web/                 Next.js 14、React 18、Tailwind CSS 3、Zustand
  server/              NestJS 11、MongoDB、LangChain / LangGraph
docs/
  monorepo-migration.md 迁移记录与维护约定
.github/workflows/ci.yml
pnpm-workspace.yaml
pnpm-lock.yaml         唯一依赖锁文件
```

工作区也支持 `packages/*`。出现实际复用需求时再创建共享包；API 请求/响应类型可放在 `packages/contracts`，避免让浏览器依赖后端数据库模型或服务代码。

## 本地开发

需要 Node.js 22.23.0、pnpm 10.33.2 和可访问的 MongoDB。

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.env.example apps/server/.env.development
pnpm hooks:install
```

编辑后端配置中的数据库地址、JWT 密钥和需要使用的 AI / OSS / 支付服务凭据。示例值只是占位符；AI 和第三方服务需要有效凭据才能工作。

充值默认关闭（`PAYMENT_MODE=disabled`）。仅开发/测试环境可设为 `virtual` 验证每账户一次的模拟发放，不产生真实交易；生产环境始终拒绝模拟发放。正式支付宝/微信支付尚未接入，不可用模拟测试代替真实支付验收。

```bash
pnpm dev
```

- 前端：<http://localhost:8000>
- 后端：<http://localhost:3000>
- Swagger：<http://localhost:3000/api>
- 前端通过 `/dev-api` 代理请求后端；修改后端端口时同步修改前端 `BACKEND_API_URL`。

环境变量文件位于各应用目录，只有 `.env.example` 提交到 Git。根目录命令会自动切换到对应应用目录执行。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 同时启动前后端开发服务 |
| `pnpm dev:web` / `pnpm dev:server` | 单独启动应用 |
| `pnpm build` | 构建全部应用 |
| `pnpm build:web` / `pnpm build:server` | 单独构建应用 |
| `pnpm lint` | 检查前后端代码，不自动改写文件 |
| `pnpm test` | 运行 Vitest 和 Jest 单元测试 |
| `pnpm check` | 依次执行 lint、单元测试和生产构建 |
| `pnpm start:web` / `pnpm start:server` | 启动已经构建的生产应用 |
| `pnpm db:seed` | 向当前配置的数据库写入测试用户；仅用于测试数据库 |
| `pnpm skills:update` | 更新两个应用的开发技能索引 |

只验证某个模块：

```bash
pnpm --filter @man-shi-mai/web test test/store/userStore.spec.ts
pnpm --filter @man-shi-mai/server test test/resume/resume.service.spec.ts
```

## 端到端测试

`pnpm test` 不连接真实数据库或调用外部 AI 服务。现有 E2E 测试需要单独准备环境，因此不包含在默认 CI 中：

1. 将后端连接到专用测试数据库，配置测试环境并运行 `pnpm db:seed`。
2. 运行 `pnpm dev:server`，默认监听 3000。
3. 安装浏览器：`pnpm --filter @man-shi-mai/web exec playwright install chromium`。
4. 运行 `pnpm test:e2e:web`。Playwright 会构建并启动 8001 端口的前端。

后端原有 E2E 入口为 `pnpm test:e2e:server`，也需要数据库及环境配置。不要对生产数据库运行种子脚本或集成测试。

## 界面设计与独立 UI 测试

视觉规范见 [面试麦设计系统](design-system/mianshimai/MASTER.md)，覆盖首页、登录、面试准备及账户工作区。默认按中国时区自动切换春招（2–6 月）与秋招（7 月到次年 1 月），首页也可手动预览；档期和文案集中在 `apps/web/src/lib/recruitment-season.ts`。

无需后端的浏览器回归：

```bash
pnpm --filter @man-shi-mai/web exec playwright test --config playwright.ui.config.ts
```

此配置会在 8000 端口启动或复用前端，并 Mock 所有业务 API，检查响应式布局和核心页面交互；不验证真实 AI、语音、支付或数据库。它与上面的真实 E2E 配置分开运行。

## 部署

在仓库根目录安装依赖，按应用构建和启动。例如：

```bash
pnpm install --frozen-lockfile
pnpm build:web
pnpm start:web
```

```bash
pnpm install --frozen-lockfile
pnpm build:server
NODE_ENV=production pnpm start:server
```

前后端可部署到不同机器或不同服务。部署平台的安装命令应从仓库根目录执行，以使用 workspace 和根锁文件；每个服务选择自己的构建和启动命令。

前端运行时配置 `BACKEND_API_URL`，指向部署后后端的内部地址。`NEXT_PUBLIC_*` 值会进入浏览器构建产物，禁止放入密钥。后端生产环境变量通过部署平台注入，生产目录不要复制本地 `.env.development`。

GitHub Actions 在 `main` 推送和 PR 时执行冻结锁文件安装及 `pnpm check`。这条流水线负责验证，不自动发布应用。

## 文件上传配置

上传使用阿里云 STS 限时授权，需要在后端设置 `OSS_STS_ROLE_ARN`、OSS Bucket/地域以及具有 AssumeRole 权限的服务端凭据。浏览器只获得当前用户目录的临时权限；未配置时可继续使用文本或在线简历。配置与限制见 [文件临时授权](apps/server/src/sts/Agent.md)。测试 Bucket 的真实授权、CORS、上传和读取尚需独立验收。

## 产品待升级方向

功能想法统一记录在[产品待升级清单](docs/product-backlog.md)。该清单仅作需求备忘，暂不启动开发，也不代表已排期或已实现。

现有系统的后续演进见[重构、Agent 升级与 Jev 评估方案](docs/refactor-agent-jev-plan.md)：先打通面试与复盘，再完善 Agent 架构，最后评估是否引入 Jev；第一阶段实施中，后两阶段未启动。

## 原仓库与开发规范

两个原仓库的主分支历史保留在本仓库提交图中，详见 [迁移记录](docs/monorepo-migration.md)。两个本地旧目录已从工作区移除（移至系统废纸篓保留恢复能力），新功能统一在 `apps/` 开发。

开发前阅读根目录 [AGENTS.md](AGENTS.md) 与对应应用的 `ai/Agent.md`。提交采用 Conventional Commits 和中文描述。
