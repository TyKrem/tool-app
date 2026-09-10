# 工具汇总页（tool.tykrem.top）

纯静态工具页，无需后端服务，由 nginx 直接托管。

## 目录

- `/root/tool-app`：可编辑源码（public/deploy）
- `/opt/tool-app`：运行目录
- `/etc/nginx/conf.d/tool.tykrem.top.conf`：站点配置

## 工具

- `/`：工具汇总页，入口卡片跳转到各工具独立页面
- `/text.html`：文本工具（A/B/C 三个文本框，去重 / 交集 / 并集，行号与实时高亮）
- `/json.html`：JSON 工具（格式化 / 压缩、语法着色、折叠、行号、错误提示）
- `/regex.html`：正则工具（表达式 + 标记，列出全部匹配位置、内容与分组）

前端结构：`public/js/common.js` 提供通用编辑器组件，`text.js` / `json.js` / `regex.js`
分别初始化各工具页面。

## 同步

```bash
cp -a /root/tool-app/public/. /opt/tool-app/public/
nginx -t && systemctl reload nginx
```

## 证书续期

acme.sh 安装到 `/etc/nginx/ssl/tool.tykrem.top` 后自动续期，
续期命令在 `/root/.acme.sh/tool.tykrem.top_ecc/tool.tykrem.top.conf`。
