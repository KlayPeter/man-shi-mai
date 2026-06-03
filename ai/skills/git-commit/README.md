# Skill: Git Commit Formatting (Git 提交规范)

## 元数据 / Metadata
- **名称 (Name)**: Git Commit Formatting (Git 提交规范)
- **标识 (ID)**: git-commit
- **版本 (Version)**: 1.0.0
- **适用场景 (Context)**: 开发者或 AI 智能体在提交代码修改时，规范提交信息 (Commit Message)
- **核心目的 (Goal)**: 确保每次提交均遵循 Conventional Commits (约定式提交) 规范。对中文进行友好支持，清晰表述改动意图，不因中文而破坏格式。

---

## 规范细节 / Specifications

### 1. 提交信息结构 / Structure
每个 Commit 消息必须遵循以下结构：
```text
<type>(<scope>): <subject>

[body]

[footer]
```

> [!NOTE]
> `(<scope>)`、`[body]` 和 `[footer]` 是可选的。

### 2. 字段详细定义 / Fields

- **`<type>` (类型)**: 必须是以下之一：
  - `feat`: 新增功能 (Feature)
  - `fix`: 修复缺陷 (Bug fix)
  - `docs`: 仅仅修改了文档 (Documentation)
  - `style`: 格式化或样式调整，不影响代码逻辑 (Formatting, CSS/style, etc)
  - `refactor`: 重构代码，既不修复错误也不添加新功能 (Code refactoring)
  - `perf`: 优化性能、提高效率的改动 (Performance improvement)
  - `test`: 增加或修改测试用例 (Testing)
  - `build`: 影响构建系统或外部依赖的改动 (e.g. build tooling, npm packages)
  - `ci`: 影响持续集成/部署配置文件的改动 (e.g. GitHub Actions, workflow configs)
  - `chore`: 其他不修改 src 或测试文件的随附变动 (e.g. dependency updates, release steps)
  - `revert`: 撤销之前的 commit (Revert a previous commit)

- **`<scope>` (作用域)**:
  - 简述受影响的模块/文件夹，例如：`web` (前端模块), `layout` (布局), `ui` (组件库), `store` (状态管理) 等。

- **`<subject>` (主题/描述)**:
  - 简短描述本次提交的主要改动。
  - **完全支持并推荐使用中文描述**。
  - **正确格式示例**：
    * `feat(web): 新增面试报告导出为 PDF 功能`
    * `fix(web): 修复登录页面在移动端的适配 bug`
    * `refactor(ui): 优化通用按钮组件的过渡动画`
    * `docs: 更新前端开发环境启动指南`
  - **错误格式防范**：
    * **不要**因为描述是中文，就将前缀写为中文（例如 `新增功能: xxx` ❌）。
    * 英文前缀冒号后面必须保留**一个空格**（例如 `feat:新增功能` ❌ -> 应为 `feat: 新增功能` 运行良好）。
    * 句尾不需要句号或标点符号。

---

## AI 智能体使用守则 / Instructions for AI Agents

1. **改动审查**：在提交前，务必先通过 `git diff --cached` 审查已暂存的文件。
2. **定位类型**：严格根据改动类别选择正确的 `<type>`。
3. **中文表述**：对于 `<subject>`，使用准确、清晰的**中文**说明做了什么修改，确保无语法和编码歧义。
4. **提交命令**：执行 `git commit -m "<type>(<scope>): <subject>"` 时，注意保留英文前缀与英文冒号。
