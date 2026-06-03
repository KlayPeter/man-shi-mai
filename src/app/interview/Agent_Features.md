# Frontend Features & Execution Links (前端展示功能与组件代码链路)

本文档记录了前端 Next.js 面试工作区中，直接向用户展示的**具体业务功能**以及对应的**组件代码/文件路径**，方便开发者快速调试与修改前端交互界面。

---

## 1. 模拟面试配置与下单页面 (Start Configuration Page)

- **用户功能**：用户在此选择押题类型，下拉选择自己的简历模板，贴入招聘岗位、目标公司、具体 JD，然后点击按钮扣费启动面试。
- **展示与交互组件路径**：
  - **配置表单与选项页面**：[page.client.tsx](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-web/src/app/interview/start/page.client.tsx)
  - **表单选择器与简历提取状态绑定**：`StartForm` 组件。

---

## 2. 流式交互面试聊天室 (Live Streaming Interview Room)

- **用户功能**：核心对话面板。AI 发送提问时以流式“打字机”效果逐字显示。
- **展示与交互组件路径**：
  - **聊天流式获取渲染逻辑**：[page.client.tsx](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-web/src/app/interview/page.client.tsx)（使用 ReadableStream 逐字累加状态并触发平滑滚动）。
  - **气泡消息组件**：`ChatMessageBubble` 组件（区分 AI 面试官气泡与候选人气泡）。

---

## 3. 面试官角色头像与阶段指示器 (Panel Interview UI Indicator)

- **用户功能**：页面顶部展示当前面试进度，并明确标识当前是哪位面试官（技术李工/HR Lisa）在提问，已提问次数和已识别的技能标签。
- **展示与交互组件路径**：
  - **顶部状态栏组件**：`InterviewStatusBar` 或者是 [page.client.tsx](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-web/src/app/interview/page.client.tsx) 里的顶部指示器渲染部分，通过后端 SSE 返回的 `metadata` (`currentPhase`, `extractedSkills`) 动态更新视图。

---

## 4. 算法代码框渲染高亮 (Markdown & Code Highlight)

- **用户功能**：当李工发送算法题或候选人提交手写 JavaScript 代码时，代码块在气泡消息中以精美的等宽高亮代码形式渲染，方便候选人直接审查和阅读。
- **展示与交互组件路径**：
  - **Markdown 渲染组件**：[page.client.tsx](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-web/src/app/interview/page.client.tsx) 中的 `MarkdownRenderer`（结合了代码块的高亮解析器）。

---

## 5. 录音机与语音转文字输入 (Voice Input & Recorder)

- **用户功能**：除了打字外，候选人可以点击麦克风按钮进行录音答题。录音时界面展示动态波形图以提供微动效反馈。结束录音后系统调用语音转文字自动将文本回填至输入框。
- **展示与交互组件路径**：
  - **录音控制逻辑与录音动画**：[page.client.tsx](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-web/src/app/interview/page.client.tsx) 中的麦克风录音控制块，以及相关的音频授权捕获逻辑。

---

## 6. 面试能力分析报告页 (Evaluation Report Dashboard)

- **用户功能**：面试结束后，用户可在报告页面查看可视化的得分雷达图、匹配的技能与缺失的技能列表、每一道题目的具体评分反馈与高分示范答案。
- **展示与交互组件路径**：
  - **报告仪表盘组件**：[page.client.tsx](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-web/src/app/interview/report/page.client.tsx)
  - **能力雷达图**：`RadarChart` 组件（基于 ECharts 或 Chart.js 渲染 5 维能力得分）。
  - **技能点对比**：`SkillsCompareList` 组件（动态展现已掌握和建议提升的技能点标签）。
