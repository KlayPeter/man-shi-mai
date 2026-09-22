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

前端构建时配置 `BACKEND_API_URL`，指向部署后后端的内部地址。`NEXT_PUBLIC_*` 值会进入浏览器构建产物，禁止放入密钥。后端生产环境变量通过部署平台注入，生产目录不要复制本地 `.env.development`。

GitHub Actions 在 `main` 推送和 PR 时执行冻结锁文件安装及 `pnpm check`。这条流水线负责验证，不自动发布应用。

## 原仓库与开发规范

两个原仓库的主分支历史保留在本仓库提交图中，详见 [迁移记录](docs/monorepo-migration.md)。本地旧目录 `man-shi-mai-web/`、`man-shi-mai-server/` 已忽略，新功能统一在 `apps/` 开发。

开发前阅读根目录 [AGENTS.md](AGENTS.md) 与对应应用的 `ai/Agent.md`。提交采用 Conventional Commits 和中文描述。
