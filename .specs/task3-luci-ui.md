# Task 3: LuCI Web 界面（JS 模式）

## 目标
实现 LuCI Web 界面，包含概览、配置、日志三个页面。

## 具体要求

### 目录结构（ImmortalWrt 24.10 LuCI JS 标准）
```
luci-app-eventcenter/
├── Makefile
├── root/
│   ├── etc/config/eventcenter
│   ├── etc/init.d/eventcenter
│   ├── usr/bin/eventcenter
│   ├── usr/bin/notifier_telegram.sh
│   ├── usr/bin/eventcenter_format.sh
│   ├── usr/bin/eventcenter_dedup.sh
│   └── usr/share/rpcd/acl.d/eventcenter.json
├── htdocs/
│   └── luci-static/resources/view/eventcenter/
│       ├── overview.js      # 概览页
│       ├── settings.js      # 配置页
│       └── logs.js          # 日志页
└── root/usr/share/luci/menu.d/luci-app-eventcenter.json
```

### 1. 概览页 `overview.js`
- 显示服务状态（运行中/已停止）
- Telegram 通知状态（已配置/未配置）
- OpenClash 监控状态（已启用/已禁用）
- 最近 10 条事件（表格：时间、来源、事件、消息）
- 快捷操作：测试通知、立即检查

### 2. 配置页 `settings.js`
- **全局设置**
  - 启用/禁用开关
  - 日志路径（默认 /tmp/eventcenter.log）
  - 日志最大行数
  - 去重 TTL（秒）
- **通知渠道 - Telegram**
  - 启用开关
  - Bot Token（密码输入框）
  - Chat ID
  - 解析模式（Markdown/HTML）
  - 测试发送按钮
- **监控任务 - OpenClash**
  - 启用开关
  - 配置文件路径（留空=自动发现，显示当前发现的文件列表）
  - GEO 文件列表（逗号分隔）
  - 检查间隔（分钟）
- **监控任务 - 预留扩展区**
  - 显示"更多监控任务即将推出"

### 3. 日志页 `logs.js`
- 表格：时间 | 来源 | 事件 | 级别 | 标题 | 消息
- 支持清空日志
- 自动刷新（30 秒）
- 分页（每页 50 条）

### 4. 菜单配置 `luci-app-eventcenter.json`
```json
{
  "admin/services/eventcenter": {
    "title": "Event Center",
    "order": 90,
    "action": {
      "overview": {"title": "Overview"},
      "settings": {"title": "Settings"},
      "logs": {"title": "Logs"}
    }
  }
}
```

### 5. ACL 配置 `eventcenter.json`
```json
{
  "luci-app-eventcenter": {
    "description": "Event Center",
    "read": {"ubus": {"luci": ["*"]}},
    "write": {"ubus": {"luci": ["*"]}}
  }
}
```

## ⚠️ 注意事项
- 必须用 LuCI JS 模式（不是 Lua/CBI），因为 ImmortalWrt 24.10
- 所有配置项从 UCI 读取，不硬编码默认值到前端
- 测试按钮调用 `eventcenter test` 命令
- 配置页面保存后调用 `eventcenter reload` 使配置生效
- 自动发现的文件列表通过 `eventcenter discover` 命令获取
