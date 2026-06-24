## 1.5.12.8 Long Conversation Performance & Fixes 🚀

### 🚀 Long Conversation Performance

- Long Agent conversations with many tool calls no longer slow down over time: collapsed tool cards now skip processing their hidden parameters and result content, and unchanged tool cards from earlier turns are no longer re-rendered as new responses stream in (#420).
- Large tool outputs are automatically truncated in the UI instead of rendering the full content at once. The model still receives the complete result; only the on-screen display is shortened (#420).

### 🛠️ Fixes

- Fixed the update toast not showing the actual release notes for the new version.
- Fixed some Streamable HTTP MCP servers failing to connect inside Obsidian due to CORS / Chromium fetch restrictions, and added compatibility for JSON-response MCP gateways such as DingTalk MCP Gateway (#417).
- Fixed ChatGPT OAuth health checks, chat requests, and model list fetching for Codex models, avoiding failures caused by endpoint parameter incompatibilities and making the available model list more accurate. Thanks @bartolli for finding and fixing this (PR #419).
- Fixed the mobile chat input leaving a large gap above the keyboard when the keyboard pops up; the input area now stays anchored just above the keyboard more reliably.

### ✨ Polish

- Improved fs_edit parameter guidance so the model is less likely to call it without proper anchoring info, increasing edit tool success rate.
- The fs_read tool card now shows the concrete file paths when reading a small number of files, and only abbreviates when many files are read at once.
- Exported configuration files are now saved to a fixed `YOLO/Exports` directory inside the vault, making them easy to find on mobile as well.

---

## 1.5.12.8 长对话性能优化与修复 🚀

### 🚀 长对话性能

- 长 Agent 对话中大量工具调用结果带来的卡顿明显缓解：折叠的工具卡现在会避免处理隐藏的大型参数和结果内容，生成过程中未变化的旧工具卡也不会被重复渲染 (#420)。
- 大输出工具卡现在会在界面上自动按长度截断展示，不再一次性渲染整段内容，模型收到的仍是完整结果 (#420)。

### 🛠️ 修复

- 修复更新提示弹窗里看不到本次版本更新内容的问题。
- 修复部分 Streamable HTTP MCP 服务在 Obsidian 中因 CORS / Chromium fetch 限制无法连接的问题，并兼容钉钉 MCP Gateway 这类 JSON 响应模式的 MCP 配置 (#417)。
- 修复 ChatGPT OAuth 下 Codex 模型的连接检测、对话请求和模型列表获取问题，避免因端点参数不兼容导致请求失败，并让可用模型列表显示更准确。感谢 @bartolli 发现并修复 (PR #419)。
- 修复移动端聊天输入框在键盘弹出时与键盘之间出现大块空白的问题，输入区现在会更稳定地贴近键盘上方。

### ✨ 体验优化

- 优化 Agent 文本编辑工具的参数说明，减少模型在调用 fs_edit 时因缺少定位信息导致的失败，提高编辑工具调用的成功率。
- 优化读取工具调用卡片的缩略显示逻辑：读取少量文档时会直接展示具体文档路径，多个文档时再自动省略。
- 优化配置导出体验：导出的配置文件现在会保存到库内 YOLO/Exports 目录，移动端也能直接找到文件。
