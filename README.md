# 模型情报月报（公开站点）

站点地址：[https://leo-liz.github.io/model-intelligence-monthly/](https://leo-liz.github.io/model-intelligence-monthly/)

本仓库只保存经过本地校验的公开静态产物，用于 GitHub Pages 发布。`site/` 包含最新首页、公开月报 JSON、按月不可变历史和社交预览图；Excel、研究台账、内部协作材料和凭据不进入本仓库。

每月更新由本地任务完成研究与构建。通过完整校验后，同步新的 `site/` 内容并推送到 `main`；GitHub Actions 核对必需文件后发布。首页始终指向最新成功月份，`site/reports/YYYY-MM/` 保存可分享的历史版本，`site/reports/index.json` 提供月份索引。Actions 和 Pages 不负责检索或判断模型信息。

登记的功能与模型关系不等于当前真实调用；报告中的候选方向也不代表已经完成生产切换验证。
