# Backend Features & Execution Links (后端实现功能与代码链路)

本文档记录了当前 AI 面试系统中，大模型与代码执行逻辑为用户提供的**具体实现功能**以及对应的**核心代码/文件路径**，方便开发者快速定位功能落地代码。

---

## 1. 简历解析与押题功能 (Resume Analysis & Question Target)

- **用户功能**：用户上传个人简历（支持 PDF/Word 格式），系统自动提取简历文本，并结合大模型对简历中的项目经验与技术点进行深挖预测，生成定制化的“简历押题”问答。
- **核心功能代码链路**：
  - **文档提取解析服务**：[document-parser.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/document-parser.service.ts)（使用 `pdf-parse` 和 `mammoth` 抽取文本）。
  - **押题生成服务**：[interview-ai.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview-ai.service.ts) 中的 `generateResumeQuizStream` 接口。

---

## 2. 模拟面试创建与扣费功能 (Mock Interview Configuration)

- **用户功能**：用户输入目标公司、申请岗位，贴入招聘 JD，并选择一份已上传的简历，点击启动模拟面试。系统自动扣减用户剩余面试次数并开启会话。
- **核心功能代码链路**：
  - **接口控制入口**：[interview.controller.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/interview.controller.ts) 中的 `mockStart` 路由方法。
  - **积分扣减与会话初始化服务**：[interview.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview.service.ts) 中的 `startMockInterviewWithStream` 方法。

---

## 3. 双角色流式面试交互 (Panel Interview & Streaming)

- **用户功能**：面试过程中，系统采用流式打字机效果发送提问。面试官分为两个角色：
  - **技术面试官“李工”**：负责技术提问、算法题目的代码把关。
  - **HR 负责人“Lisa 老师”**：负责沟通协作提问，解答候选人反问，并做结语收尾。
  - 支持用户使用文字或者录音（语音转文字后）作答。
- **核心功能代码链路**：
  - **状态机流转控制**：[interview-agent.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview-agent.service.ts) 中的 `compileInterviewGraph`（LangGraph 节点流转）。
  - **“李工”角色提问与算法考核**：[interview-agent.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview-agent.service.ts) 中的 `handleResumeDigging` 和 `handleTechAssessment`（包含边界检查、并发锁等高难度技术追问）。
  - **“Lisa 老师”角色行为面试与反问解答**：[interview-agent.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview-agent.service.ts) 中的 `handleBehavioralTest`（添加平滑过渡语）与 `handleCandidateQA`（动态回答候选人提出的问题）。

---

## 4. 安全 JS 代码沙箱自动编译运行 (JavaScript Code Sandbox)

- **用户功能**：当面试官（李工）要求手写算法时，用户在输入框中提交 JavaScript 代码，系统会自动拦截并运行该代码，将实际执行输出或报错结果反馈给面试官，面试官据此对代码逻辑、死循环或边界问题进行追问。
- **核心功能代码链路**：
  - **安全代码执行沙箱**：[code-sandbox.tool.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/tools/code-sandbox.tool.ts)（限制运行时间在 2000ms 内，限制输出内存在 100KB 内，屏蔽全局 process 以免恶意代码危害服务器）。
  - **自动运行及回流节点**：[interview-agent.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview-agent.service.ts) 中的 `handleExecuteTool` 节点。

---

## 5. 面试长对话防爆/防复读机制 (Context Resets)

- **用户功能**：当面试对话超过 15 轮长链路后，系统自动清空早期明细以防消耗大模型大量 Token，确保面试官提问依然敏锐，避免复读机幻觉，同时对用户无感知（界面依然显示完整历史，大模型依靠系统摘要维持记忆）。
- **核心功能代码链路**：
  - **对话摘要生成与窗口滑动**：[interview-agent.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview-agent.service.ts) 中的 `generateInterviewQuestionStream` 及私有辅助方法 `summarizeConversation`。

---

## 6. 面试能力评估报告生成 (Interview Evaluation Report)

- **用户功能**：面试结语结束后，用户可以查看一份精美的面试打分报告。报告包含多维度能力得分、能力雷达图、匹配的专业技能点与缺失的技能点、大模型对用户回答的详细建议与正确示范。
- **核心功能代码链路**：
  - **接口控制入口**：[interview.controller.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/interview.controller.ts) 中的 `getReport` 路由方法。
  - **评测分析逻辑服务**：[interview-ai.service.ts](file:///Users/admin/Desktop/Peter/man-shi-mai/man-shi-mai-server/src/interview/services/interview-ai.service.ts) 中的 `generateInterviewAnalysisReport` 核心分析方法（提取 `matchedSkills` 等指标数据）。
