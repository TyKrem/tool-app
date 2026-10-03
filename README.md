# tool-app

一组开箱即用的纯静态在线小工具。没有后端、没有构建步骤，
丢到任何静态服务器（nginx / GitHub Pages / 对象存储）就能跑。

## 工具

| 页面 | 功能 |
| --- | --- |
| `/` | 工具汇总页，卡片跳转到各工具；与各工具统一蓝色样式 |
| `/text.html` | 文本工具：A / B / C 三个文本框，去重、交集、并集、双向差集，可过滤空行 / 去首尾空白 / 自然排序，带行号与实时高亮 |
| `/json.html` | JSON 工具：格式化 / 压缩、语法着色、可折叠、行号、错误提示，支持所有合法 JSON 标量 |
| `/regex.html` | 正则工具：输入表达式与标记，列出全部匹配位置、内容与捕获分组，并高亮预览命中片段；常用模板、独立 Worker 执行，2 秒超时停止 |
| `/diff.html` | Diff 对比：按行比较两段文本，标出新增 / 删除 / 修改，改动精确到行内字符，长段落可折叠 |
| `/math.html` | 数学工具：算式计算、2–36 进制转换、随机数、日期计算、随机抽取与排序、UUID 生成 |
| `/string.html` | 字符串工具：转义字符串、UTF-8 Hex、HTML 实体、URL 编码、Base64 的 UTF-8 双向转换，结果可反向转换 |
| `/timestamp.html` | 时间戳工具：实时时间与秒级 / 毫秒级时间戳互转，附 UTC 时间与相对时间 |

## 操作

- 蓝色卡片、按钮和表单保持统一；跟随系统的浅色 / 深色模式。
- 文本、JSON、正则、Diff、字符串的编辑器可以导入 UTF-8 本地文件（最大 2 MB）；
  已有输入时先确认替换。文件只在浏览器读取，不上传。
- 以上五类工具的结果可以复制或下载；输入改变后禁用旧结果的导出，需要重新执行。
- 文本、JSON、正则、Diff、字符串支持 `Ctrl / ⌘ + Enter` 执行；数学算式和时间戳支持回车。
- 数学进制转换的常用进制结果可以单独复制；参数改变后清除旧结果。
- 时间戳实时钟暂停后，复制保持与屏幕上显示的值一致。

正则使用原生 Web Worker，静态部署时要一并提供 `js/regex-worker.js`，
不能只复制 HTML。需要通过 HTTP / HTTPS 访问；若配置 CSP，应允许同源 Worker。
2 秒是匹配计算的超时保护，不包括结果列表和预览的渲染时间。

## 结构

```
public/
  index.html          工具汇总页
  text.html           文本工具
  json.html           JSON 工具
  regex.html          正则工具
  diff.html           Diff 对比
  math.html           数学工具
  string.html         字符串工具
  timestamp.html      时间戳工具
  css/style.css       样式
  js/common.js        通用编辑器组件（行号、高亮、折叠）
  js/text-core.js     文本工具的核心逻辑（浏览器 / Node 通用）
  js/diff-core.js     Diff 的核心逻辑（行对齐、行内字符 diff）
  js/math-core.js     数学工具的核心逻辑（算式解析、进制、随机、日期）
  js/string-core.js   字符串转换的核心逻辑
  js/timestamp-core.js 时间戳转换的核心逻辑
  js/regex-worker.js  正则匹配的独立线程
  js/*.js             各页面的初始化与交互逻辑
deploy/               作者实际使用的 nginx 站点配置，可作参考
```

## 运行

纯静态，本地起个服务即可预览：

```bash
cd public && python3 -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

部署到 nginx：

```bash
cp -a public/. /var/www/tool-app/
# 站点配置参考 deploy/tool.http.conf 与 deploy/tool.tykrem.top.conf
nginx -t && systemctl reload nginx
```

`deploy/` 下是作者实际在用的配置，里面的域名与证书路径需要按你的环境改。

### 布局约定

页面按「一屏装满」设计：顶栏 + 内容区 + 页脚三等分高度，内容区用 flex 与
CSS 栅格自适应铺满，编辑器和结果区跟着行高伸缩，正常情况下不出现整页滚动条
（只有编辑器、结果列表这类容器内部滚动）。

屏幕宽度不足 1180px 或高度不足 700px 时，`style.css` 末尾的媒体查询会把布局
回退成「自然高度 + 页面滚动」，避免把编辑器压到没法用；手机采用单列布局，导航横向滚动，输入与结果按顺序显示，按钮增加触控面积。

改布局时注意：给编辑器、卡片加 `min-height` 会把一屏布局顶破，宁可让容器
内部滚动。

## 浏览器支持

用的是原生 JS 与 CSS（无框架、无 polyfill），现代浏览器均可。

## License

[MIT](LICENSE)
## 测试

```bash
node --test test/*.test.js   # 使用支持 node:test 的当前 Node，无额外依赖
```

`public/js/*-core.js` 是各工具的核心逻辑，写成浏览器和 Node 都能加载的形式
（页面挂到 `window.<名字>Core`，Node 走 `module.exports`），所以不用引 jsdom
就能直接测。

## 主题切换

页面提供浅色、深色与跟随系统三档切换，按钮可通过键盘操作；刷新保留选择。
在同一浏览器访问本站及其子站时共用主题偏好，偏好不包含登录身份或访问码。
