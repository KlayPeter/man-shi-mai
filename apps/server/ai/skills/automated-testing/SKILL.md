---
name: automated-testing
description: guidelines for running automated test suites and build checks. Enforces progressive testing under the test/ directory (e.g., pnpm test test/auth/jwt.strategy.spec.ts) after modifying NestJS controllers, services, database schemas, or payment flows.
---

# Skill: Automated Testing & Verification (自动化测试与验证规范)

## 核心原则 / Core Principle
**禁止将未经测试验证的代码提交到仓库**。每次修改后端业务逻辑、数据库模型或外部 API 接口后，必须运行本地自动化测试工具进行验证，确保没有破坏原有功能。为了提高开发效率并保持渐进式验证，**应当仅针对修改的功能模块运行对应的单元测试，而不是进行全局全量测试**。

---

## 规范细节 / Specifications

### 1. 后端自动化测试工作流 / Backend Testing Workflow

后端测试代码统一归档于根目录的 `test/` 文件夹下，并针对不同的业务功能划分了独立子目录：
- `test/auth/`: 认证相关测试
- `test/user/`: 用户管理测试
- `test/resume/`: 简历管理测试
- `test/interview/`: 面试评测测试
- `test/payment/`: 支付系统测试

#### 渐进式运行指定功能测试
当您修改了某个模块（如 `auth`）的代码后，只需运行该模块对应的测试文件，无需全量运行所有接口测试：
```bash
# 格式: pnpm test test/<module>/<filename>.spec.ts
# 示例：只测试 JWT 认证策略
pnpm test test/auth/jwt.strategy.spec.ts
```

#### 全量 API 接口集成测试
当需要进行完整发布前的最终回归验证时，确保本地服务已启动 (`pnpm run start:dev`) 并运行：
```bash
pnpm run test:api
```

---

### 2. 编写与修改测试用例 / Modifying Test Cases

只要您修改了某个功能，就**必须同时修改/补充该功能对应的测试文件**。

- **测试文件定位**：每一个在 `src/` 中的功能类，均应在 `test/` 下的对应功能文件夹中有一个对应的 `xxx.spec.ts` 测试文件（如：`src/resume/resume.service.ts` 对应 `test/resume/resume.service.spec.ts`）。
- **编写准则**：使用 NestJS 的 `@nestjs/testing` TestBed 进行依赖 Mock（如 mock 数据库 Model），仅验证核心逻辑分支的正确性。

---

## AI 智能体使用守则 / Instructions for AI Agents

1. **功能对应测试**：完成代码编写后，必须找到 `test/` 下对应的测试文件并运行它（如 `pnpm test test/resume/resume.service.spec.ts`）。
2. **红屏阻断与测试修改**：如果修改导致测试断言失败，禁止提交。必须同步更新该测试文件中的断言以符合新的业务逻辑。
3. **新增功能必须写测试**：当新增接口或服务时，必须在 `test/<feature>/` 目录下新建 `xxx.spec.ts` 并完成单元测试。
