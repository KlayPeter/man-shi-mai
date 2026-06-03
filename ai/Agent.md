# Developer & AI Agent Operating Instructions (开发习惯与要求指南)

本文件定义了开发者的编程习惯、规范以及对 AI 智能体 (AI Agent) 的开发要求。所有 AI 智能体在阅读项目和修改代码前，**必须**严格遵循本指南。

---

## 1. 核心开发原则 / Core Development Principles

### 最小修改原则 (Minimum Modification Principle) ⚠️
- **禁止过度重构**：除非用户明确要求，否则禁止对已有、工作正常的代码进行大规模重构。只针对需要实现的功能或修复的 bug 做针对性修改。
- **保留原有上下文**：修改代码时，尽量保留原作者的代码风格、变量命名规则和逻辑结构。
- **保留无关注释/文档**：不得删除与您的修改无关的注释、文档（Docstrings）。

### 代码质量要求 (Code Quality Requirements)
- **干净、清晰、可读**：代码逻辑必须直接了当，避免使用过度复杂的写法。优先考虑代码的长期可维护性和可读性。
- **完整的错误处理**：对于异步操作、网络请求、文件 IO 等易错逻辑，必须编写健壮的 `try-catch` 错误捕获和合理的日志记录。
- **严格遵守项目规范**：
  - 后端项目：TypeScript + NestJS 风格，符合 TypeScript 严格类型检查。
  - 禁止引入未经许可的第三方包。

---

## 2. Git 提交规范 / Git Commit Convention

- **必须使用 Git Commit 技能**：每次提交修改前，必须读取并遵循项目下的 Git 提交规范技能：
  - 本地路径：`ai/skills/git-commit/README.md`
- **提交格式**：必须使用 Conventional Commits 格式（例如 `feat(scope): 描述` 或 `fix(scope): 描述`），且描述必须是**中文**，不可因为中文而改变前缀。
- **自动更新**：在 `git commit` 时，系统的 Pre-commit 钩子会自动运行 `update-skills.js` 来更新技能索引 `README.md`，请确保这些自动更新的文件被一并提交。

---

## 3. 智能体自动执行守则 / Agent Execution Rules

1. **初始化载入**：在准备修改任何代码或提交 Git 之前，必须先检索并载入 `ai/skills/` 目录中的技能，并按照里面的指示操作。
2. **渐进式测试验证**：修改完成后，必须定位到 `test/` 文件夹下对应功能的 `xxx.spec.ts` 文件，运行 `pnpm test test/模块/测试文件` 校验修改是否正确，并同步修改对应的测试断言。
3. **测试通过放行**：只有在对应功能的单元测试通过后，才允许提交代码并执行 `git commit`。
