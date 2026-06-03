---
name: automated-testing
description: guidelines for running build checks and compiling verification. Use this to verify frontend correctness after modifying Next.js pages, Zustand stores, or components, and before making commits.
---

# Skill: Automated Verification & Build Check (自动化编译与构建检查规范)

## 核心原则 / Core Principle
**禁止将无法编译或含有 Lint 错误的前端代码提交到仓库**。Next.js 项目的生产构建 (Build) 是高强度的自动化类型与语法检查（包含 TypeScript 静态类型分析和 ESLint 语法静态审查）。在提交代码前，必须执行本地打包命令以验证前端项目的完整可编译性。

---

## 规范细节 / Specifications

### 1. 前端自动化编译检查工作流 / Frontend Verification Workflow

在每次修改 React 组件、Next.js 路由页面、Zustand 状态库或前端配置文件后，必须在前端项目根目录下运行以下检查：

#### 第一步：运行静态 ESLint 语法检查
```bash
pnpm run lint
```
该命令将全量扫描组件语法，检查是否有未声明的变量、React Hooks 依赖缺失或非法的 JSX 嵌套。

#### 第二步：运行全量生产构建打包
```bash
pnpm run build
```
Next.js 编译器将自动：
1. 调用 `tsc` (TypeScript Compiler) 对所有 `.ts`, `.tsx` 文件进行强类型语法验证。
2. 对全局样式与静态资源进行优化与打包。
3. 如果代码中存在任何语法错误、未闭合标签或类型不匹配（如 Prop 传参错误），构建将自动中止并报错。

---

## AI 智能体使用守则 / Instructions for AI Agents

1. **先过编译再提交**：完成任何前端 UI 或逻辑修改后，必须在本地终端执行 `pnpm run build`。
2. **红屏阻断**：若 `pnpm run build` 出现任何 Error（如 `Type error`、`Lint error`），**禁止**执行 `git commit`。必须先在终端中阅读详细编译报错，定位受影响的组件和文件行数，修正完毕且打包显示 `✓ Generating static pages` 后，方可进行提交。
3. **保持整洁**：严禁通过大面积使用 `@ts-ignore` 或 `any` 来规避类型检查。必须按照 TypeScript 规范正确声明 Interface 和 Type。
