# 公基学习台

公基课程、资料检索、图片对照、连续随机练习、单选/多选、上一题回看与账号错题同步。

当前内容：13个单元、1152个整理考点、321个资料章节、721道原创练习（62道多选）、39张真实来源图片。

## GitHub Pages版本

Pages展示课程、时间线、资料检索和图片。登录刷题、错题及课程进度链接到 `pages-config.json` 指定的账号网站，继续使用原账号。
GitHub Pages不运行本项目的动态登录服务或数据库，不能把 `/api/progress` 直接部署成静态接口。

```sh
python3 build.py
python3 scripts/build-pages.py
node qa/verify-pages.mjs
```

输出在 `dist-pages/`，资源路径兼容 `用户名.github.io/仓库名/` 和自定义域名。

仓库的 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
推送到main或手动运行 Publish Gongji study to GitHub Pages 将自动发布。

## 完整应用源码

`app/`中保留动态账号与进度接口，`db/`及`drizzle/`中保留数据库结构；这些不在Pages运行。
内容生成使用 `src/` 和 `build.py`。账号接口与题库的完整回归检查是 `node qa/verify.mjs`，需要安装项目依赖。
不要修改已经应用的数据库迁移。

## 图片与资料

图片的作者、原始页面、许可和观察提示见 `src/visual-references.json`，网站逐张展示署名和许可链接。
模型及天文图像处理有明确说明。PDF原文件不在本仓库，资料检索使用提取文字与原页码。

## PDF 学习版（2026-10-05）


- 在“PDF 学习版”入口按资料浏览；上下册合计 118 章，均有独立导读、阅读路径、易混提醒和主动回忆。
- 五份资料纳入阅读的全部提取页均有段落整理版，保留原 PDF 页码与原始提取文字；未逐字校勘，不自动猜测表格或框架图的关系。
- 上册目录已按实际文件页序校正一页，保留章节 ID 兼容账号记录。
- 目录点击保留位置，支持上一章、下一章、翻页、大字与护眼底色。
- 上下册可从资料卡下载 PDF；生成脚本 `scripts/build-reading-pdf.py` 需 ReportLab 和可嵌入中文字体。部署直接使用 `public/downloads/` 下已验证的输出，无需重新生成。
