# Backend Module: Authentication & Authorization (身份认证与权限控制)

## 1. 业务功能概述 / Business Functionality
- **核心业务逻辑**: 本模块为整个后端服务提供 JWT 身份验证与基于角色的权限校验，保护敏感的 API 路由不被非法访问。
- **核心数据结构**:
  - `JwtPayload`: 包含 `userId`、`email`、`role` 等用户信息。

## 2. 架构设计与代码流转 / Architectural Workflow
- **认证守卫 (JwtAuthGuard)**:
  - 文件：`jwt-auth.guard.ts`
  - 核心逻辑：拦截请求并检验其 Header 中的 `Authorization: Bearer <token>`。支持通过 `@Public()` 装饰器跳过认证。
- **公共接口标记 (Public Decorator)**:
  - 文件：`public.decorator.ts`
  - 核心逻辑：定义 `@Public()` 装饰器，向路由添加 `isPublic` 元数据。
- **JWT 策略 (JwtStrategy)**:
  - 文件：`jwt.strategy.ts`
  - 核心逻辑：Passport 策略实现。解码 JWT，并从 Payload 中提取用户 ID 及角色存入请求对象 `req.user` 中。
- **角色守卫 (RolesGuard)**:
  - 文件：`roles.guard.ts`
  - 核心逻辑：校验 `req.user` 中的角色是否符合 API 要求。
- **控制流向 / Data Flow**:
  1. 客户端发送 HTTP 请求 -> `JwtAuthGuard` 拦截。
  2. 若路由被标记为 `@Public()`，放行并进入 Controller。
  3. 若非公开路由，`JwtAuthGuard` 调用 Passport `jwt` 策略解析 Token。
  4. `JwtStrategy` 提取 Token 进行对称加密密钥解密，返回 `req.user`。
  5. 经过 `RolesGuard`（如果路由被标记了角色要求）验证角色。
  6. 通过验证 -> 执行 `Controller` 中的实际业务方法。

## 3. 技术依赖与第三方 API / Tech Stack & External APIs
- **核心依赖**: `@nestjs/passport`, `passport-jwt`, `passport`
- **算法加密**: 对 JWT 采用 HS256 对称加密。

## 4. 开发约束与边界处理 / Constraints & Guidelines
- **安全性**: 任何新增敏感路由默认必须被 `JwtAuthGuard` 保护。如非绝对公开的 API，禁止使用 `@Public()` 装饰器。
- **异常捕获**: 若 JWT 过期或无效，`JwtAuthGuard` 将抛出 `UnauthorizedException` (401 状态码)；角色不匹配时抛出 `ForbiddenException` (403 状态码)。

## 5. 本地调试与排查 / Debugging & Verification
- **调试方式**:
  - 在 Postman 中调用受保护路由时，必须在 Headers 中带上 `Authorization: Bearer <token>`。
- **常见排查**:
  - 发生 `401 Unauthorized`：检查 Token 是否过期或 Header 格式是否写错（例如漏掉 `Bearer ` 前缀）。
  - 发生 `403 Forbidden`：检查当前用户的 Role 权限是否满足 API 条件。
