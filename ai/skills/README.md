# AI Agent Skills Registry - Web (前端智能体技能库)

本目录 (`man-shi-mai-web/ai/skills/`) 统一管理前端项目中所有供 AI 智能体（或开发人员）遵循的专属规范与技能指南。每个技能作为独立文件夹进行管理，AI 在执行特定操作时应优先调取并遵循对应规范。

---

## 技能索引与元数据 / Skills Index & Metadata

<!-- SKILLS_LIST_START -->
| 技能目录 / Directory | 技能名称 / Name | 标识 / ID | 版本 / Version | 状态 / Status | 核心作用 / Short Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [git-commit/](git-commit/SKILL.md) | git-commit | `git-commit` | `1.0.0` | 🟢 开启中 (Active) | guidelines for formatting git commit messages. enforces Conventional Commits with English type prefixes and Chinese subject descriptions (e.g., feat(scope): 新增功能). use when making commits or staging files in the repository. |
| [skill-builder-protocol/](skill-builder-protocol/SKILL.md) | skill-builder-protocol | `skill-builder-protocol` | `1.0.0` | 🟢 开启中 (Active) | create, critique, refactor, or improve chatgpt skills and claude-style skills as reusable agent operating manuals. use when the user asks to make a new skill, convert a workflow into a skill, write or review skill.md, decide whether a skill should be short or long, split instructions into references, design trigger descriptions, add decision trees, examples, failure handling, tools, scripts, assets, or quality checks for reliable repeatable agent behavior. |
| [web-feature-doc/](web-feature-doc/SKILL.md) | web-feature-doc | `web-feature-doc` | `1.0.0` | 🟢 开启中 (Active) | standard protocol for creating and maintaining frontend Next.js feature-specific Agent.md files. Requires documenting UI interactions and component hierarchy using Mermaid flowcharts. |
<!-- SKILLS_LIST_END -->

---

## 使用与加载守则 / Guidelines for AI Agents

1. **按需检索**：在执行与开发、提交、测试或部署相关的任何重要任务前，务必先阅读本注册表。
2. **遵守优先级**：如果本技能库中存在某一领域的开发/提交技能描述，其规则的优先级将高于外部通用模型偏好。
3. **保持同步**：若在开发中发现有更好且可复用的技能规范，可在此目录下新建独立文件夹，并在本 `README.md` 注册表中追加其元数据以供后续 AI 继承。
