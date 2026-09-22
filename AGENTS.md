# 面试麦 Monorepo

- 使用 Node.js 22 和 pnpm 10；在仓库根目录安装依赖，只维护根目录的 `pnpm-lock.yaml`。
- `apps/web` 为 Next.js 前端，`apps/server` 为 NestJS 后端；它们独立构建和部署。
- 根目录的 `man-shi-mai-web/`、`man-shi-mai-server/` 为已忽略的旧仓库，禁止在其中开发新功能。
- 修改某个应用前，阅读该应用的 `ai/Agent.md`、`ai/skills/README.md` 和对应功能的 `Agent.md`。
- 业务类型需要共享时再新增 `packages/contracts`；前端不得直接依赖后端服务、数据库模型或环境变量。
- 修改后运行对应测试；涉及工作区、依赖或构建配置时运行根目录的 `pnpm check`。
- E2E 依赖单独的测试数据库与服务，不得默认连接生产环境执行。
- 提交使用 Conventional Commits，中文描述；提交前运行 `pnpm skills:update` 并审查暂存差异。
- 本地环境配置只保存在各应用的 `.env*` 文件中，仓库仅跟踪 `.env.example`。
