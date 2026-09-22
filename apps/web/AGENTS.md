# 前端协作规范

适用于 `apps/web/**`，与[根规范](../../AGENTS.md)一起使用。本文所有 `src/`、`test/` 路径相对于本应用；命令从仓库根目录执行。

## 1. 技术栈与代码位置

当前为 Next.js 14 App Router、React 18、TypeScript、Tailwind CSS 3、Zustand 4、Axios、Vitest 和 Playwright。精确版本以 `package.json` 与根锁文件为准；不要套用其他项目的 Next.js 16、React 19、Tailwind 4 或 React Compiler 用法。

| 位置 | 放什么 |
| --- | --- |
| `src/app` | 路由、Layout、页面组合及必要的服务端 Route Handler |
| `src/components` | 业务组件；通用交互优先复用 `ui/` 和已有弹窗、布局 |
| `src/api` | 按业务划分的请求入口 |
| `src/lib/request.ts` | Axios 实例、Token 注入、响应解包、401 处理 |
| `src/lib/sse.ts` | 浏览器端流式请求、解析及取消 |
| `src/stores` | Zustand 状态与跨组件业务动作 |
| `src/hooks` / `src/utils` / `src/types` | 可复用 Hook、纯工具及类型 |
| `test` / `e2e` | Vitest 单元测试 / Playwright 浏览器测试 |

新增页面先搜索已有路由和组件，避免在不同路由组创建重复 URL。保持页面职责清楚，不在 JSX 中堆积请求、数据转换和复杂状态流转。当前测试集中在 `test/<领域>/*.spec.ts`，不要照搬其他项目的就近测试目录约定。

## 2. React、状态与界面

- 只有需要交互、Hook 或浏览器 API 的边界才使用 `'use client'`；访问 `window`、存储、录音等能力时考虑服务端渲染与挂载时机。
- 本地临时 UI 状态留在组件，跨页面或业务共享状态放在现有 Store。不要在组件和 Store 各维护一份相互同步的业务真相。
- Zustand 优先选择需要的字段，异步动作需要最新值时使用 `get()` / `getState()`；检查持久化状态、登录退出与页面重入。
- 异步操作处理 loading、empty、error、retry 和重复点击。快速切换简历或面试时，旧请求不得覆盖新对象状态。
- 定时器、语音监听、流式连接和事件监听必须明确清理时机。修复生命周期问题时检查开始、完成、取消、离开与重新进入。
- UI 变化检查窄屏、长内容、键盘操作、表单标签及 disabled 状态。沿用已有视觉组件，不顺带重做无关页面。
- 修改范围内补明确类型，不以扩大类型断言或关闭检查解决报错；不借普通需求重写全项目类型配置。

## 3. HTTP 与 SSE 两条请求链路

普通请求通过 `src/lib/request.ts` 访问 `/dev-api`，由 `next.config.js` 转发到后端。拦截器已将成功响应解包为业务 `data`；调用方不要再次按原始 Axios 响应解包。HTTP 401 与业务响应中的 401 都要保留登录失效处理。

流式请求链路为：

```text
src/lib/sse.ts → src/app/api/sse-proxy/route.ts → NestJS SSE 接口
```

- 两种代理都使用服务端 `BACKEND_API_URL`，默认 `http://localhost:3000`。修改端口或代理时一起检查 `next.config.js`、SSE Route Handler、示例配置和 Playwright 配置。
- 代理保留 POST body、Authorization、上游状态和流式响应体，不将 SSE 一次性读完后当普通 JSON 返回。
- SSE 解析变化要验证跨 chunk 的消息、结束标记、异常与取消，避免重复追加内容、重复完成回调或残留 loading。
- 不把模型、OSS、支付密钥放入 `NEXT_PUBLIC_*`，也不让浏览器绕过统一代理依赖本机后端地址。
- Next.js rewrite 目标受构建时配置影响；部署后的 SSE Route Handler 还会读取服务端环境。不能只改其中一个地址。

## 4. 简历与面试的业务边界

- 简历中心涉及 `src/components/resume`、`src/stores/resumeStudioStore.ts`、`src/types/resume.ts` 和后端 resume 模块。修改编辑字段时，同时检查保存的 `editorData` 与供 AI 使用的 `plainTextSnapshot`。
- 接口路径以实际 Controller 为准。当前部分 Store 直接发请求，`src/api/resume.ts` 不是所有调用的唯一入口，改接口时必须搜索全部消费者。
- 编辑状态、已保存状态和服务器返回值要区分；保存失败不能提示成功，也不能清除尚未保存的用户输入。
- 面试涉及 `src/app/interview`、`src/stores/interviewStore.ts`、流式客户端及语音 Hooks。阶段、消息类型、报告字段或恢复逻辑变更需同步后端，覆盖新面试与恢复面试。
- 页面不得自行判定支付成功后增加权益；余额、权限和面试次数以后端确认的数据为准。

## 5. 验证与文档入口

```bash
pnpm --filter @man-shi-mai/web test test/store/userStore.spec.ts
pnpm --filter @man-shi-mai/web test test/api/backend-proxy.spec.ts
pnpm --filter @man-shi-mai/web lint
pnpm build:web
```

按影响选择测试；Store、公共工具和请求逻辑变化要有针对行为的回归用例。界面交互变化还需浏览器验证，不能仅以 build 成功判断页面可用。纯文档按根规范检查，不重复运行业务测试。

`pnpm test:e2e:web` 需要测试后端、测试用户及 Playwright 浏览器，并使用前端 8001 / 后端 3000。不要把未运行的 E2E 描述为已通过。

按需阅读[技能索引](ai/skills/README.md)及 `src/app/login/Agent.md`、`src/app/profile/Agent.md`、`src/app/interview/Agent.md`、`src/app/history/Agent.md`。业务说明有变化时维护原文件，不另建一份同名规则。
