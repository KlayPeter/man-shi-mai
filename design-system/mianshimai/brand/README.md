# 面试麦品牌标识

当前方案为「开口有声」：M 的竖线与转折构成麦克风拾音部件，下方的弧形支架与底座完成麦克风轮廓，对应语音面试、开口回答与产品名中的「麦」。图形不使用字体、渐变或外部资源，支持单色与反白。

- 打开 [面试主题设计](refinements/index.html) 比较「开口有声」「面对面」「面试席」三个方向，并查看深浅背景及小尺寸效果；[当前预览](refinements/preview.png) 可直接查看。
- [voice-m.svg](refinements/voice-m.svg) 是可编辑的单色母版，使用 `currentColor`；[mark-1024.png](refinements/mark-1024.png) 为透明背景导出。
- [index.html](index.html) 与 [preview.png](preview.png) 保留初轮六个方向的探索，原「开口成章」可在 [01-dialogue-m.svg](01-dialogue-m.svg) 查看。
- 站内图形位于 `apps/web/src/components/Brand.tsx`，沿用现有招聘季颜色：浅底使用 `primary-600`，深色侧栏使用 `lime`。图形本身不随季节变化。
- 浏览器使用 `apps/web/public/logo.svg`；PNG 兼容图标分别为 `logo.png`（512）、`icon-192.png`（192）、`apple-touch-icon.png`（180）。PNG 带奶油色背景及安全留白。
- 更新图形时同时更新组件与 SVG 母版，再导出 PNG，保持站内标识、浏览器、手机图标和组织结构化数据一致。

设计探索参考 Logo Generator 的 SVG 比较模板与 UI/UX Pro Max 的可访问性指引。展示页离线可用，配色按钮支持键盘及选中状态；减少动态效果偏好下关闭过渡。
