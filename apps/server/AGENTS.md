# 后端协作规范

适用于 `apps/server/**`，与[根规范](../../AGENTS.md)一起使用。本文所有 `src/`、`test/` 路径相对于本应用；命令从仓库根目录执行。

## 1. 技术栈与分层

当前为 NestJS 11、TypeScript、Mongoose/MongoDB、JWT、LangChain/LangGraph、Jest 和 ESLint 9。精确版本以包清单与根锁文件为准。

| 位置 | 职责 |
| --- | --- |
| `src/main.ts` / `src/app.module.ts` | 服务启动、全局配置、模块注册、日志和响应边界 |
| `src/auth` / `src/user` | JWT 与角色验证、用户账户及权益数据 |
| `src/resume` | 简历元数据、编辑内容、供 AI 使用的文本快照 |
| `src/interview` | 面试编排、Agent 状态、Prompt、文档解析、报告与消费记录 |
| `src/ai` | 模型工厂、会话及共享 AI 能力 |
| `src/payment` | 订单、支付查询/回调及权益发放 |
| `src/common` | 响应、异常、日志脱敏、拦截器和公共工具 |
| `src/sts` / `src/wechat` | OSS 临时凭证及微信相关集成 |
| `test` / `test/harness` | 单元/集成测试入口；AI 评估工具与样例 |

Controller 负责路由、鉴权与输入输出，Service 负责业务和持久化，DTO 负责传入数据约束，Schema 负责数据库结构。复用已有 Module/Provider，不直接在 Controller 新建数据库连接或模型客户端。

## 2. API、鉴权与数据隔离

- 新增或修改入参同时检查 DTO 校验、Swagger、Controller 和前端消费者。现有 `ValidationPipe` 开启 `whitelist` 与 `transform`，仅有 TypeScript 字段或 `ApiProperty` 不等于有运行时校验。
- 普通响应沿用 `ResponseUtil`、`ResponseInterceptor` 和 `AllExceptionsFilter` 的 `code/message/data` 约定；错误状态须与前端请求封装一致。直接写入 `Response` 的 SSE 不套普通 JSON 包装。
- 受保护接口复用 `JwtAuthGuard`；`@Public()` 只用于明确公开的入口。`src/auth/auth.guard.ts` 中的旧 `AuthGuard` 当前直接返回 `true`，不能用它保护新接口。
- 用户身份取自经过验证的 `req.user`，不信任 body 中的 `userId`。用户接口读写简历、面试或订单时，查询条件必须限定所属用户。
- 账户资料接口不得返回密码哈希、密钥或内部支付凭据；Token 只通过明确的认证流程返回。日志使用已有脱敏工具，新增日志不输出完整简历或请求凭据。
- 分页、默认值、索引及已有文档兼容性需随 Schema 变更一起考虑；需要回填时明确范围、幂等性与恢复方式，不在普通启动中隐式重写数据。

## 3. 必须保留的业务行为

### 简历

`src/resume` 管理简历保存；`src/interview/services/document-parser.service.ts` 负责文件文本解析。不要在简历模块再建第二套解析实现。

修改简历内容时保持 `editorData`、`plainTextSnapshot`、`sourceType` 和状态含义一致。面试侧已有优先读取文本快照、再回退到文件解析的逻辑；改动时验证编辑简历和上传简历两条路径。详情、更新和删除都需要用户归属校验。

### 面试 Agent 与流式响应

- 先追踪 Controller → `InterviewService` → Agent/AI Service → Schema 与前端消费者；不要仅修改 Prompt 来绕过状态机问题。
- 阶段流转、题目计数、已提问内容、已识别技能和结束状态属于业务状态。修改时覆盖首次进入、继续回答、恢复会话及结束报告，避免重复提问、提前结束或重复消费。
- Prompt、Zod 结构、模型输出解析和前端事件类型一起检查；实际模型行为以评估证据为准，Mock 测试不证明模型质量。
- SSE 保留事件格式、响应头及断连订阅清理。区分“已取消订阅”和“模型调用已真正取消”，不要假设前者自动实现后者。
- 模型超时、解析失败或第三方错误应有可追踪失败路径，不能写入伪造的成功报告。

### 支付与权益

- 修改 `src/payment` 前阅读该模块的 `Agent.md`、订单状态及已有测试。
- 保留金额校验、订单状态转换和幂等处理；重复查询、重复通知或并发请求不得重复发放权益。
- 不把数据库原子更新改成无保护的“先查再写”。失败和重试需要保持订单、用户权益及流水的一致性。
- 当前有虚拟支付实现，不能据此声称真实支付宝或微信已验证。测试使用 Mock/专用环境，不真实充值或发放生产权益。

## 4. 配置与依赖

- 默认端口 3000；前端 HTTP 与 SSE 代理的地址应保持一致。
- `AppModule` 当前显式读取 `.env.development`；不能假设设置 `NODE_ENV=production` 就会自动切换到 `.env.production`。生产环境通过部署平台注入变量，部署目录不要携带本地开发配置。
- 新增环境变量需要更新 `.env.example` 并检查实际加载路径。`src/config/config.schema.ts` 的存在不等于它已接入 `ConfigModule` 校验，修改时核实调用关系。
- 模型创建优先使用现有 `AIModelFactory`；新增配置、重试或客户端前，检查是否已有同类机制，避免重复调用和费用放大。
- `p-retry` override 在根 `package.json` 管理；不要在子应用重新增加锁文件或覆盖配置。

## 5. 验证与文档入口

```bash
pnpm --filter @man-shi-mai/server test test/resume/resume.service.spec.ts
pnpm --filter @man-shi-mai/server test test/interview/interview-agent.spec.ts
pnpm --filter @man-shi-mai/server test test/payment/payment.service.spec.ts
pnpm --filter @man-shi-mai/server lint
pnpm build:server
```

根据模块选择测试，新增逻辑覆盖正常、非法输入、权限拒绝和失败路径；支付补并发/重试不重复发放的验证。测试放在 `test/<模块>/*.spec.ts`，数据库、模型及外部支付默认 Mock。纯文档按根规范检查。

`lint` 只检查；需要格式修复时使用 `pnpm --filter @man-shi-mai/server lint:fix` 并审查修改范围。不要用全目录自动修复夹带无关格式变更。

`test:e2e:server`、应用内 `test:api` 和 `db:seed` 需要独立测试环境；`test:agent-eval` 涉及模型评估，执行前核实服务、凭据及费用范围。构建、Mock 测试与真实集成结果分别报告。

按需阅读[技能索引](ai/skills/README.md)以及 `src/auth/Agent.md`、`src/user/Agent.md`、`src/resume/Agent.md`、`src/interview/Agent.md`、`src/payment/Agent.md`。接口列表以 Controller 为准，发现旧文档落后于实现时同步修正。
