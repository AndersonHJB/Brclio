# 原 Skill 改造清单：v3 开放色板修订

原 Skill：`/Users/huangjiabao/.codex/skills/ian-xiaohei-illustrations`

## 必须成组替换

### `SKILL.md`

- 默认角色从小黑改为 Bornforthis。
- 写入“黄腮红”一词识别点和两张参考图职责。
- 删除黑色角色、怪诞小黑、红橙蓝旧色彩分工。
- 背景改为纯白，风格改为温暖手绘蜡笔。
- 色彩规则写成“品牌三色层 + 内容辅助色层”，不得写成只能使用三色。
- 增加耳机、蓝夹克、相机、相机包、笔记本均非固定的规则。

### `agents/openai.yaml`

- `display_name` 改为 Bornforthis 正文配图。
- `short_description` 删除小黑与旧画风。
- `default_prompt` 改为调用 Bornforthis Skill，并要求角色参考图。

### `references/xiaohei-ip.md`

- 整文件退出使用，替换为 `references/bornforthis-ip.md`。
- 不保留黑色实心怪物、白点眼、细腿、空表情等任何旧身份定义。

### `references/style-dna.md`

- 背景固定白色。
- 三个品牌色按蓝/黄/红 60/30/10 建立相对层级。
- 明确允许按物体和语义加入其它颜色。
- 删除“只允许三色”“不得引入新颜色”“绿色/紫色/橙色均违规”等表达。
- 增加辅助色不抢主品牌、不过度彩虹化、保持蜡笔质感的规则。
- 写入四类字体角色。

### `references/prompt-template.md`

- 删除小黑英文身份 Prompt。
- 加入两张参考图的角色分工。
- 加入蓝碎发、白脸、黄鼻点、黄腮红的身份锁。
- 增加 `{内容辅助色}` 变量。
- 明确 60/30/10 只表示品牌三色彼此的视觉层级，不是像素配额或封闭色板。
- 禁止项从 `no extra colors` 改为 `no meaningless rainbow or competing dominant palette`。

### `references/composition-patterns.md`

- 将小黑动作池改为 Bornforthis 的连接、筛选、搭建、修复、记录、判断、测试和发布。
- 移除依赖黑色怪物身体变形的隐喻。
- 每个构图增加“真实材料色/状态色是否必要”的判断。
- 保留大留白、一个主结构、角色承担动作和不复刻旧案例的原则。

### `references/qa-checklist.md`

- 必查黄腮红、蓝碎发、白脸和成年比例。
- 必查耳机/夹克/相机/笔记本没有固化。
- 将色彩检查拆成：品牌三色层级、辅助色语义、辅助色是否抢主、是否彩虹化。
- 不得再把绿色、紫色、棕色、灰色等合理内容色判为失败。
- 保留白底、留白、单一结构、短标签和非 PPT 检查。

### `assets/examples/*.png`

- 旧 14 张小黑案例全部替换为本目录 `examples/` 的 14 张 Bornforthis v3。
- 示例必须展示开放色板，而不是继续只使用蓝黄红。
- 耳机仅在降噪主题出现，服装需要轮换。

## 全文残留扫描

安装后搜索以下词汇并人工确认上下文：

```text
小黑|Xiaohei|solid-black|black blob|only white and|只使用.*三种|no extra colors|yellow background|黄底|固定耳机|固定夹克
```

允许这些词只出现在否定规则中，不得作为默认角色或默认配色继续生效。

## 推荐安装方式

推荐把改造版安装为独立 `bornforthis-illustrations`，保留上游 `ian-xiaohei-illustrations`。这样更新上游时不会覆盖 Bornforthis 的角色与开放色板规则。
