---
name: server-feature-doc
description: standard protocol for creating and maintaining backend NestJS feature-specific Agent.md files. Use this to understand the server structure, including Controllers, Services, DTOs, schemas, and database mappings.
---

# Skill: Server Feature Document Protocol (后端模块说明规范)

## 核心原则 / Core Principle
本规范旨在指导 AI 智能体与开发者为**后端（NestJS）**的每个核心功能模块撰写统一、精准的 `Agent.md` 指南。使得每次修改该模块的代码或评估功能时，AI 能够通过此指南瞬间熟悉后端架构与逻辑。

---

## 后端 `Agent.md` 规范模板 / Backend Template

```markdown
# Backend Module: [功能名称 / Feature Name]

## 1. 业务功能概述 / Business Functionality
- **核心业务逻辑**: 简述本模块解决了什么业务需求（例如：处理支付回调、管理面试状态图）。
- **核心数据结构**: 简述该模块涉及的数据库实体或核心数据对象（如：`InterviewState`、`PaymentRecord`）。

## 2. 架构设计与代码流转 / Architectural Workflow
- **控制器入口 (Controller)**: 负责暴露哪些 API（路由前缀与主要路径，如 `@Controller('payment')`）。
- **DTO 与参数校验**: 核心请求与响应的 DTO 文件（如 `create-order.dto.ts`）以及应用的拦截器。
- **业务服务 (Service)**: 描述主要的 Service 及其承担的逻辑（如负责与微信支付网关通信，或控制 LangGraph 条件转移）。
- **数据持久化 (Schema/Repository)**: 本模块操作了哪些 MongoDB/Mongoose 模型（如 `PaymentRecordSchema`）。
- **控制流向 / Data Flow**:
  1. 客户端请求 -> `Controller` (身份验证与参数校验)
  2. `Controller` 调用 -> `Service` (核心计算/大模型交互)
  3. `Service` 调用 -> `Model` (读取/更新数据库)
  4. 返回格式化的 JSON 响应。

## 3. 技术依赖与第三方 API / Tech Stack & External APIs
- **核心依赖**: 本模块引入了哪些关键的依赖包（如 `@nestjs/mongoose`, `@langchain/core`, `alipay-sdk`）。
- **外部集成**: 详细描述对接的第三方接口（如微信支付商户 API 地址，阿里云 STS）。

## 4. 开发约束与边界处理 / Constraints & Guidelines
- **安全性与守卫**: 本模块的路由是否需要 `@UseGuards(JwtAuthGuard)` 认证，哪些是 `@Public()` 的。
- **日志与错误捕获**: 本模块对异常（如网络中断、支付失败、大模型解析失败）的捕获和日志记录规则。
- **并发与幂等**: （如果有）支付回调、状态流转的防重复/并发控制。

## 5. 本地调试与排查 / Debugging & Verification
- **调试接口**: 推荐使用什么工具调试（如 Postman, Swagger 文档路由 `/api-docs`）。
- **日志关键字**: 发生异常时，在日志中查找什么关键字进行排查（如 `[PaymentService] Callback signature verification failed`）。
```

---

## AI 智能体编写守则 / Guidelines for AI Agents
1. **真实代码还原**：编写 `Agent.md` 时，模块内的类名、方法名和调用顺序必须与实际代码**完全一致**。
2. **渐进式维护**：修改后端控制器、服务或数据模型时，必须主动同步更新本模块的 `Agent.md`。
