# hiesther.me ✦

不二的个人网站 — 一个非技术背景设计师用 AI 搓出来的互联网小家。

🔗 **Live**: [hiesther.me](https://hiesther.me)

## 关于

这是我的第三版个人网页，一个 IP 驱动的桌面风格网站。

- **主页** — 教程、分享、HTML 展示页的入口
- **作品集** — 产品设计作品与项目经历
- **无限白板** — 自由探索的 Moodboard

## 技术栈

主页使用 React + Vite；文章、教程和 Playground 仍是 `public/` 下的独立静态 HTML，并部署到 GitHub Pages。

## 自动更新内容

- 主页内容统一从 `public/` 的一级子文件夹开始；一级子文件夹会自动显示为主页文件夹。
- HTML 放进这些子文件夹后会自动显示；更深层目录会依次生成文件夹窗口。
- 直接放在 `public/` 根目录的 HTML 不会进入主页或 `sitemap.xml`。
- `npm run dev` 与 `npm run build` 会自动更新主页内容树和 `sitemap.xml`，不再手工维护链接。
- `public/index.html` 是保留文件名；当前 React 主页入口是项目根目录的 `index.html`。

## 版本进化

| 版本 | 特点 | 文件 |
|------|------|------|
| Ver 1 | 简单自我介绍 | `website-ver1.html` |
| Ver 2 | 终端穿越 + 无限白板 | `website-ver2.html` |
| Ver 3 | 桌面 OS 风格，IP 载体 | 项目根目录 `index.html` |

## 制作工具

这个网站 100% 由我和 [Cola](https://cola.app) 协作完成——我负责定调和审美决策，Cola 负责执行和发散。
