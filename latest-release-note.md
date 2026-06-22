## 1.5.12.7 MCP & Context Improvements ✨

### 📝 Context & Mentions

- **@ mentions (#414)**: Now support Canvas, Bases, JSON/YAML, plain text, and other text-based files.

### ⚡ Provider & Streaming

- **Response streaming mode (#416)**: Added a provider-level toggle to control whether each provider uses streaming responses; fixes cache hit info being lost on some gateways (e.g. newapi proxying DeepSeek) in streaming mode.
- Adjusted the default auto context compression threshold to reduce premature compression prompts in long conversations.
- ChatGPT OAuth model list now includes gpt-5.5.

### 🔌 MCP Enhancements

- **On-demand disclosure (#340)**: When on-demand disclosure is enabled, lightweight MCP servers stay in context by default while large MCP servers disclose on demand — fewer unnecessary tool-loading rounds and first-call failures; updated related system prompts. Agent tool settings now show auto-selection results per server, with manual override to always-in-context or on-demand.
- **MCP permissions**: Tool permissions can now be set per MCP server (require approval or allow all), without adjusting each tool individually for large MCP servers.
- **MCP status in Agent tools**: The Agent tool overview now shows MCP loading or connection failure status, making it easier to tell if custom tools are still initializing after startup or reload.

---

## 1.5.12.7 MCP 与上下文体验 ✨

### 📝 上下文与 @ 引用

- **@ 引用 (#414)**：现支持 Canvas、Bases、JSON/YAML、纯文本等文本类文件。

### ⚡ Provider 与流式响应

- **响应流式模式 (#416)**：新增渠道级开关，可设置对应 provider 是否开启流式；修复部分网关（如 newapi 代理 DeepSeek）在流式下丢失缓存命中信息的问题。
- 优化自动上下文压缩的默认触发阈值，减少长上下文对话中过早提示压缩的情况。
- ChatGPT OAuth 模型列表新增 gpt-5.5。

### 🔌 MCP 增强

- **按需披露 (#340)**：优化 MCP 工具按需披露启用后的披露策略——轻量 MCP 默认直接常驻上下文，大型 MCP 自动按需披露，减少不必要的工具加载轮次和首次调用失败；优化相关系统提示词。Agent 工具设置中新增自动选择展示，可按 server 查看当前自动判定结果，也可手动固定为常驻上下文或按需披露。
- **MCP 权限**：现在可以按 MCP server 统一设置「需要审批」或「完全放行」，不必再为大型 MCP 的每个工具逐项调整。
- **Agent 工具状态**：Agent 工具概览现在会显示 MCP 正在加载或连接失败的状态，启动和重载后更容易判断自定义工具是否还在后台初始化。
