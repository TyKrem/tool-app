# tool-app

一组开箱即用的纯静态在线小工具。没有后端、没有构建步骤，
丢到任何静态服务器（nginx / GitHub Pages / 对象存储）就能跑。

## 工具

| 页面 | 功能 |
| --- | --- |
| `/` | 工具汇总页，卡片跳转到各工具 |
| `/text.html` | 文本工具：A / B / C 三个文本框，去重、交集、并集，带行号与实时高亮 |
| `/json.html` | JSON 工具：格式化 / 压缩、语法着色、可折叠、行号、错误定位 |
| `/regex.html` | 正则工具：输入表达式与标记，列出全部匹配位置、内容与捕获分组 |

## 结构

```
public/
  index.html          工具汇总页
  text.html           文本工具
  json.html           JSON 工具
  regex.html          正则工具
  css/style.css       样式
  js/common.js        通用编辑器组件（行号、高亮、折叠）
  js/text.js          text.html 的初始化逻辑
  js/json.js          json.html 的初始化逻辑
  js/regex.js         regex.html 的初始化逻辑
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

## 浏览器支持

用的是原生 JS 与 CSS（无框架、无 polyfill），现代浏览器均可。

## License

[MIT](LICENSE)
## 测试

```bash
node --test test/        # 需要 Node 16.17+（node:test 内置，没有额外依赖）
```

`public/js/text-core.js` 是文本工具的核心逻辑，写成浏览器和 Node 都能加载的
形式（页面挂 `window.TextCore`，Node 走 `module.exports`），所以不用引 jsdom
就能直接测。
