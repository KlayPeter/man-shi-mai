---
name: automated-testing
description: guidelines for running automated test suites and build checks. Enforces progressive testing under the test/ directory (e.g., pnpm test test/store/userStore.spec.ts) and Next.js compile verification before making commits.
---

# Skill: Automated Testing & Verification (自动化测试与验证规范)

## 核心原则 / Core Principle
**禁止将未经测试或含有编译/Lint 错误的前端代码提交到仓库**。
1. **渐进式测试验证**：每次修改前端 Zustand 状态库、API 交互逻辑或核心公共方法后，必须运行对应的单元测试（Vitest），确保未破坏存量功能。应当仅针对修改的模块运行指定的测试文件，而非执行全量耗时测试。
2. **自动化编译与 Lint 检查**：Next.js 项目的生产构建 (Build) 是高强度的类型与语法验证。在提交代码前，还必须确保本地 Lint 和 Build 打包顺利通过。

---

## 规范细节 / Specifications

### 1. 前端单元测试工作流 (Vitest) / Frontend Unit Testing Workflow

前端测试代码统一归档于根目录的 `test/` 文件夹下，按功能/模块类型划分：
- `test/store/`: Zustand 状态管理库测试 (如 `userStore.spec.ts`)
- `test/login/`: 登录及认证相关测试
- `test/profile/`: 个人中心与简历等模块测试
- `test/interview/`: 面试评测模块测试
- `test/history/`: 历史记录模块测试

#### 渐进式运行指定功能测试
当您修改了某个模块（如 Zustand store）的代码后，只需运行该模块对应的测试文件：
```bash
# 格式: pnpm test test/<folder>/<filename>.spec.ts
# 示例：只测试用户状态存储
pnpm test test/store/userStore.spec.ts
```

---

### 2. 前端自动化编译与 Lint 检查工作流 / Frontend Build & Lint Workflow

在每次修改 React 组件、Next.js 路由页面或配置文件后，必须在前端项目根目录下运行以下静态检查：

#### 运行静态 ESLint 检查
```bash
pnpm run lint
```
该命令将扫描组件语法，检查 React Hooks 依赖缺失或非法的 JSX 嵌套。

#### 运行全量生产构建打包
```bash
pnpm run build
```
Next.js 编译器将自动调用 `tsc` 进行强类型静态校验。如果存在任何语法错误或类型不匹配，构建将中止并报错。

---

## AI 智能体使用守则 / Instructions for AI Agents

1. **功能对应测试**：完成代码编写后，若修改涉及状态管理或通用函数，必须找到 `test/` 下对应的测试文件并运行（例如 `pnpm test test/store/userStore.spec.ts`）。
2. **编写与修改测试用例**：只要修改了功能逻辑，**必须同步修改或补充对应的测试用例**，确保测试套件覆盖核心分支。
3. **红屏阻断与整洁**：若单元测试失败，或 `pnpm run build` / `pnpm run lint` 出现任何 Error，**禁止**执行 `git commit`。必须修复所有错误并确保打包成功（显示 `✓ Generating static pages`）后，方可提交。
4. **禁止滥用 ignores**：严禁大面积使用 `@ts-ignore` 或 `any` 规避类型检查，必须定义清晰的 TypeScript Interface 和 Type。
