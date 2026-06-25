# luci-app-eventcenter

路由器通用事件通知中心 — 统一监控 OpenClash 订阅变更、节点健康、系统资源、设备状态，多渠道推送通知。

## 功能特性

### 核心功能
- **事件引擎**: 标准化流水线（去重 → 聚合 → 记录 → 格式化 → 推送）
- **多事件源**: OpenClash 订阅、节点健康、系统健康、设备上下线
- **多通知渠道**: Telegram、Webhook（钉钉、飞书、Bark、自定义）
- **告警聚合**: 相同事件在时间窗口内聚合为一条通知，避免消息轰炸
- **LuCI 管理界面**: 概览、节点健康、设置、日志四个页面

### 事件源
- **OpenClash 订阅监控**: 实时文件监听，按订阅分组推送变更通知
- **节点健康监测**: 监控代理组节点切换，故障转移/恢复通知
- **系统健康监控**: CPU/内存/温度/磁盘使用率超阈值告警
- **设备上下线监控**: DHCP/ARP 检测设备在线状态变化

### 通知渠道
- **Telegram**: 精美 Markdown 格式通知
- **Webhook 通用**: 支持钉钉、飞书、Bark、自定义 URL
- **可扩展**: 易于添加新的通知器

## 目录结构

```
luci-app-eventcenter/
├── Makefile                          # OpenWrt 编译脚本
├── root/
│   ├── etc/
│   │   ├── config/eventcenter        # UCI 配置
│   │   └── init.d/eventcenter        # procd 服务脚本
│   ├── usr/
│   │   ├── bin/
│   │   │   ├── eventcenter           # CLI 主入口
│   │   │   ├── notifier_telegram.sh  # Telegram 通知器
│   │   │   └── notifier_webhook.sh   # Webhook 通知器
│   │   ├── share/
│   │   │   ├── eventcenter/
│   │   │   │   ├── engine.sh         # 事件引擎
│   │   │   │   ├── utils.sh          # 工具函数库
│   │   │   │   ├── aggregate.sh      # 告警聚合模块
│   │   │   │   ├── watcher.sh        # inotifywait 实时监听
│   │   │   │   └── sources/
│   │   │   │       ├── openclash.sh  # OpenClash 事件源
│   │   │   │       ├── node-health.sh # 节点健康事件源
│   │   │   │       ├── system-health.sh # 系统健康事件源
│   │   │   │       └── device-monitor.sh # 设备监控事件源
│   │   │   ├── rpcd/acl.d/eventcenter.json   # RPC 权限
│   │   │   └── luci/menu.d/luci-app-eventcenter.json  # 菜单
│   │   └── lib/upgrade/keep.d/luci-app-eventcenter    # 升级保留配置
├── htdocs/
│   └── luci-static/resources/view/eventcenter/
│       ├── overview.js               # 概览页（系统状态可视化）
│       ├── health.js                 # 节点健康页（延迟趋势图表）
│       ├── settings.js               # 设置页（所有配置项）
│       └── logs.js                   # 日志页
└── README.md
```

## 安装方法

### 方式一：OpenWrt 编译系统

将 `luci-app-eventcenter` 目录放入 `package/` 或 `feeds/luci/applications/`，然后：

```bash
make menuconfig  # 选中 LuCI -> Applications -> luci-app-eventcenter
make package/luci-app-eventcenter/compile V=s
```

### 方式二：手动安装 ipk

```bash
opkg install luci-app-eventcenter_*.ipk
```

### 方式三：源码直接部署（开发调试）

```bash
# 复制 root/ 下的文件到对应系统目录
cp -r root/* /
cp -r htdocs/* /www/

# 设置执行权限
chmod +x /usr/bin/eventcenter
chmod +x /usr/bin/notifier_telegram.sh
chmod +x /usr/bin/notifier_webhook.sh
chmod +x /etc/init.d/eventcenter
chmod +x /usr/share/eventcenter/*.sh
chmod +x /usr/share/eventcenter/sources/*.sh

# 重启 rpcd 和 uhttpd
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

## 使用方法

### CLI 命令

```bash
# 查看帮助
eventcenter help

# 查看服务状态
eventcenter status

# 发送测试通知
eventcenter test

# 手动触发事件源检查
eventcenter check openclash
eventcenter check node-health
eventcenter check system-health
eventcenter check device-monitor

# 查看事件日志
eventcenter list
eventcenter list --limit 20

# 手动发送事件
eventcenter emit <source> <event> <level> <title> [message]

# 去重缓存管理
eventcenter dedup-clear

# 告警聚合管理
eventcenter aggregate-flush    # 手动刷新聚合缓冲
eventcenter aggregate-status   # 查看聚合状态

# 列出可用事件源
eventcenter sources
```

### 服务管理

```bash
# 启动服务（添加 cron 任务 + inotifywait 监听）
/etc/init.d/eventcenter start

# 停止服务（移除 cron 任务 + 停止监听）
/etc/init.d/eventcenter stop

# 重启服务
/etc/init.d/eventcenter restart

# 查看服务日志
logread | grep eventcenter
```

### LuCI Web 界面

访问 **服务 → Event Center**，包含：

- **概览页**: 服务状态、系统资源可视化（CPU/内存进度条）、最近事件
- **节点健康页**: 当前节点选择、延迟记录、延迟趋势图表、切换事件
- **设置页**: 所有配置项（全局、Telegram、Webhook、OpenClash、节点健康、系统健康、设备监控）
- **日志页**: 完整事件日志、分页浏览

## 配置说明

### 全局配置

```
config eventcenter 'global'
    option enable '1'              # 总开关
    option log_path '/tmp/eventcenter.log'
    option log_max_lines '1000'
    option dedup_ttl '300'         # 去重 TTL（秒）
    option aggregate_enable '1'    # 告警聚合开关
    option aggregate_ttl '600'     # 聚合时间窗口（秒）
```

### Telegram 通知

```
config notifier 'telegram'
    option enable '0'
    option token ''                # Bot Token
    option chatid ''               # Chat ID
    option parse_mode 'Markdown'
```

### Webhook 通知

```
config notifier 'webhook'
    option enable '0'
    option platform 'custom'       # custom/dingtalk/feishu/bark
    option url ''                  # 自定义 Webhook URL
    option method 'POST'
    option content_type 'application/json'
    option body_template ''        # {{message}} 占位符
    option headers ''              # 自定义请求头（|分隔）
    option dingtalk_token ''       # 钉钉 Access Token
    option feishu_token ''         # 飞书 Token
    option bark_server 'https://api.day.app'
    option bark_key ''             # Bark Key
```

### OpenClash 监控

```
config monitor 'openclash'
    option enable '1'
    option realtime '1'            # inotifywait 实时监听
    option debounce '5'            # 防抖延迟（秒）
    option paths ''                # 自定义配置路径
```

### 节点健康监测

```
config health 'health'
    option enable '0'
    option interval '5'            # 检测间隔（分钟）
    option delay_threshold '3000'  # 延迟阈值（ms）
    option test_url 'http://www.gstatic.com/generate_204'
    option notify_recovery '1'     # 恢复通知
    option monitor_groups ''       # 监控组过滤
```

### 系统健康监控

```
config system_health 'system_health'
    option enable '0'
    option interval '2'            # 检测间隔（分钟）
    option cpu_threshold '80'      # CPU 告警阈值（%）
    option mem_threshold '85'      # 内存告警阈值（%）
    option disk_threshold '90'     # 磁盘告警阈值（%）
    option temp_threshold '75'     # 温度告警阈值（°C）
    option notify_recovery '1'
```

### 设备上下线监控

```
config device_monitor 'device_monitor'
    option enable '0'
    option interval '1'            # 检测间隔（分钟）
    option track_macs ''           # 监控 MAC 列表（逗号分隔）
    option notify_recovery '1'
```

## 通知示例

### OpenClash 订阅更新

```
📡 OpenClash 订阅更新 — 我的机场

⏰ 时间: 2026-06-22 15:30:45

📊 变更摘要
├── ➕ 新增线路: 8 条
├── ➖ 下线线路: 2 条
└── 🔄 参数更新: 3 条

🌍 地区统计
├── 🇭🇰 香港: +5 -1 (共 42 条)
├── 🇯🇵 日本: +3 +1 (共 28 条)
├── 🇸🇬 新加坡: +0 -2 (共 15 条)
└── 🇺🇸 美国: +0 +0 (共 12 条)
```

### 系统健康告警

```
⚠️ 系统健康告警

🖥️ CPU: 92% (阈值 80%)
💾 内存: 87% (8654MB/9945MB)
💿 磁盘 /: 91% (61G/67G)

📊 负载: 2.15 1.89 1.67
💾 内存详情: 8654MB / 9945MB (可用 1291MB)
```

### 设备状态变动

```
📱 设备状态变动

🟢 iPhone 上线
   MAC: `AA:BB:CC:DD:EE:FF`
   IP: `192.168.1.100`

🔴 MacBook 离线
   MAC: `11:22:33:44:55:66`
```

### 告警聚合通知

```
📢 事件聚合通知

📊 相同事件在 10 分钟内发生了 5 次

📋 最后一条详情:
⚠️ 系统健康告警
🖥️ CPU: 85%

⏰ 首次: 14:30
⏰ 最后: 14:35
```

## 扩展开发

### 添加新事件源

在 `/usr/share/eventcenter/sources/` 下创建 `<name>.sh`，实现 `check()` 函数：

```sh
#!/bin/sh
# /usr/share/eventcenter/sources/my_monitor.sh

check() {
    local _enable
    _enable=$(ec_uci_get "my_monitor.enable" "0")
    [ "$_enable" != "1" ] && return 0

    # 检测逻辑
    if [ 某个条件 ]; then
        eventcenter emit my_monitor some_event info \
            "事件标题" "事件详细描述"
    fi
}
```

### 添加新通知器

在 `/usr/bin/` 下创建 `notifier_<name>.sh`，接收消息作为第一个参数：

```sh
#!/bin/sh
# /usr/bin/notifier_mychannel.sh

_message="$1"
# 发送逻辑
curl -X POST "https://api.example.com/send" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$_message\"}"
```

然后在 UCI 配置中添加对应的 notifier section。

## 依赖

- `curl` — API 调用
- `md5sum` — 去重 key 计算（busybox 自带）
- `inotifywait` — 实时文件监听（inotify-tools 包，可选）

## 版本历史

### v1.1.0 (2026-06-25) — 多事件源 + 多通知渠道

**新功能:**
- ✨ 系统健康监控（CPU/内存/温度/磁盘）
- ✨ 设备上下线监控（DHCP/ARP 检测）
- ✨ Webhook 通用通知器（钉钉、飞书、Bark）
- ✨ 告警聚合防轰炸（相同事件聚合为一条通知）
- ✨ 延迟趋势图表可视化（CSS 柱状图）
- ✨ 概览页系统状态可视化（进度条）

**改进:**
- 📦 重构为多事件源架构
- 📦 重构为多通知器架构
- 📦 添加告警聚合模块
- 📦 LuCI 设置页大幅扩展

### v1.0.3 (2026-06-22) — 通知修复 + 国旗自动补全

- 修复 awk 写入 state 文件时未指定 `-F'\t'` 分隔符
- 修复 server:port 提取逻辑
- 新增 `prepend_flag()` 函数，自动为纯中文节点名补上国旗 emoji
- 优化变更列表格式

### v1.0.2 (2026-06-22) — 按订阅名称分组推送

- 每个配置文件视为独立订阅，变更时按订阅名称分别推送通知
- 优化 inotifywait 监听逻辑，支持多文件并行监听

### v1.0.1 (2026-06-22) — 节点变更分类 + 通知模板优化

- 节点变更智能分类：新增线路 / 下线线路 / 参数更新
- 地区变化检测：新地区上线 / 地区缩减
- 新增 inotifywait 实时文件监听
- 移除 geo_files 和 interval 配置项，改用 realtime + debounce

### v1.0.0 (2026-06-21) — 初始版本

- 事件引擎 + CLI
- Telegram 通知器
- OpenClash 事件源
- LuCI Web 管理界面
- Makefile + init.d + 打包

## License

MIT
