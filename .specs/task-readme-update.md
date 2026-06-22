# 更新 README.md

## 目标
更新 `~/luci-app-eventcenter/README.md`，反映当前 v1.2.0 的实际功能。

## 当前 README 的问题
- 描述还是旧的"GEO 文件变更监控"
- UCI 配置还提 `geo_files`、`interval`（已删除）
- 没有 inotifywait 实时监听功能说明
- 没有按订阅名称分组推送的说明
- 没有节点变更分类（新增/下线/参数更新/新地区上线/地区缩减）
- 没有地区统计功能说明
- 版本历史只有 v1.0.0

## 需要更新的内容

### 1. 项目描述
路由器通用事件通知中心 — 实时监控 OpenClash 订阅配置变更，按订阅名称分组推送 Telegram 通知，包含节点变更分类和地区统计。

### 2. 功能特性（替换旧的）
- **实时文件监听**: inotifywait 内核级事件驱动，文件变更秒级感知
- **按订阅分组**: 每个配置文件 = 一个独立订阅，变更时按订阅名称分别推送
- **节点变更分类**: ➕新增线路 / ➖下线线路 / 🔄参数更新
- **地区变化检测**: 🚀新地区上线 / ⚠️地区缩减 / 各地区节点增减统计
- **Telegram 通知**: 精美 Markdown 格式，包含变更摘要、地区统计、主要变化列表
- **事件引擎**: 标准化流水线（去重 → 记录 → 格式化 → 推送）
- **LuCI 管理界面**: 概览、设置、日志三个页面
- **busybox 兼容**: 无 comm/paste/yq 依赖，纯 shell 实现

### 3. UCI 配置说明（更新）
去掉 `geo_files`、`interval`，加上 `realtime`、`debounce`：
```
config monitor 'openclash'
    option enable '1'
    option paths ''
    option realtime '1'
    option debounce '5'
```

### 4. 目录结构
加上 `watcher.sh`

### 5. 通知示例
展示按订阅名称推送的通知格式

### 6. 版本历史
- v1.0.0 — 初始版本
- v1.1.0 — 节点变更分类 + 通知模板优化
- v1.2.0 — 按订阅名称分组推送

## ⚠️ 注意
- 只改 README.md，不要改其他文件
- 不要 git push
- 保持中文风格
