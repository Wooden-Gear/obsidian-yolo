## 1.5.12.9 Diff Review, Office Attachments & Fixes 🛠️

### 📝 Diff Review

- AI rewrite review is easier to read: large edits now show whole deleted lines and whole added lines side by side, instead of overlapping strikethrough and highlight clutter.

### 📎 Attachments

- Office documents (Word, Excel, PowerPoint) can now be added as chat attachments and read by Agent, with the same prompt format as PDF attachments.

### 🛠️ Fixes

- Fixed ChatGPT OAuth failing to load the Codex model list by using the three-segment version format the Codex API expects. Thanks @bartolli (PR #421).
- Fixed the chat view occasionally leaving a large blank area and hiding model replies while scrolling after the input hint above the composer disappears.

---

## 1.5.12.9 审阅视图、Office 附件与修复 🛠️

### 📝 审阅视图

- 优化 AI 改写的审阅视图：大段改动不再出现删除线与高亮交错的混乱排版，改为「整行旧内容标删除、整行新内容标新增」的清晰对照，更易阅读。

### 📎 附件

- 支持将 Office 文档（Word、Excel、PowerPoint）作为附件上下文添加给模型，Agent 可读取解析此类文件，并与 PDF 附件采用统一的 prompt 注入格式。

### 🛠️ 修复

- 修复 ChatGPT OAuth 下 Codex 模型列表无法加载的问题，插件现在会使用 Codex 接口要求的三段式版本号请求模型目录。感谢 @bartolli (PR #421)。
- 修复聊天窗口偶发出现大片空白、滚动时遮挡模型回复的问题，输入框上方提示消失后不再残留不可见占位。
