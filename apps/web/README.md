# 面试麦 - AI智能面试平台

本应用现位于 Monorepo 的 `apps/web`。请在仓库根目录运行 `pnpm install` 和 `pnpm dev:web`；完整环境配置、测试及部署说明见 [根 README](../../README.md)。下列应用内脚本仍可在本目录执行。

面试麦是专业的AI智能面试平台，提供程序员、产品经理、设计师等各职业的智能面试训练、模拟面试和面试题库。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI**: React 18 + TypeScript
- **样式**: TailwindCSS 3
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
- **其他**: dayjs, marked, qrcode, uuid

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 构建生产版本
pnpm run build

# 启动生产服务器
pnpm run start
```

## 项目结构

```
src/
├── app/              # Next.js App Router 页面
├── components/       # React 组件
│   ├── home/        # 首页组件
│   ├── layouts/     # 布局组件
│   └── ui/          # UI 组件
├── constants/        # 常量配置
├── stores/          # Zustand 状态管理
├── utils/           # 工具函数
└── api/             # API 服务
```

## 功能特性

### 三大核心服务

1. **面试押题** - 3-5分钟快速生成，命中率80%+
2. **专项面试模拟** - 约1小时，支持语音/文字多模态
3. **行测+HR面试** - 约45分钟，双重评估维度

### 主要功能

- AI 智能面试训练
- 模拟面试场景
- 面试题库
- 结构化评估报告
- STAR 模型评估
- 技能矩阵分析
- 雷达图可视化

## 环境变量

```env
NEXT_PUBLIC_API_BASE_URL=/dev-api
NEXT_PUBLIC_RESUME_PREVIEW_URL=https://lgdsunday.club/
```

## License

All rights reserved.
