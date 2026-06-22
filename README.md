# luci-app-eventcenter

路由器通用事件通知中心 — 监控 OpenClash 配置/GEO 文件变更，通过 Telegram 等通道实时推送通知。

## 功能特性

- **事件引擎**: 标准化事件处理流水线（去重 → 记录 → 格式化 → 推送）
- **Telegram 通知**: 通过 Bot API 发送 Markdown/HTML 格式通知
- **OpenClash 监控**: 自动检测配置文件和 GEO 文件变更
- **Web 管理界面**: LuCI JS 模式，含概览、设置、日志三个页面
- **去重机制**: MD5 按 source:event 去重，可配 TTL 时间窗口
- **日志轮转**: 超过 max_lines 自动截断，保留最新记录

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
│   │   │   └── notifier_telegram.sh  # Telegram 通知器
│   │   ├── share/
│   │   │   ├── eventcenter/
│   │   │   │   ├── engine.sh         # 事件引擎
│   │   │   │   ├── utils.sh          # 工具函数库
│   │   │   │   └── sources/
│   │   │   │       └── openclash.sh  # OpenClash 事件源
│   │   │   ├── rpcd/acl.d/eventcenter.json   # RPC 权限
│   │   │   └── luci/menu.d/luci-app-eventcenter.json  # 菜单
│   │   └── lib/upgrade/keep.d/luci-app-eventcenter    # 升级保留配置
├── htdocs/
│   └── luci-static/resources/view/eventcenter/
│       ├── overview.js               # 概览页
│       ├── settings.js               # 设置页
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

生成的 `.ipk` 文件在 `bin/packages/` 目录下。

### 方式二：手动安装 ipk

```bash
opkg install luci-app-eventcenter_1.0.0-1_all.ipk
```

### 方式三：源码直接部署（开发调试）

```bash
# 复制 root/ 下的文件到对应系统目录
cp -r root/* /
cp -r htdocs/* /www/

# 设置执行权限
chmod +x /usr/bin/eventcenter
chmod +x /usr/bin/notifier_telegram.sh
chmod +x /etc/init.d/eventcenter
chmod +x /usr/share/eventcenter/engine.sh
chmod +x /usr/share/eventcenter/utils.sh
chmod +x /usr/share/eventcenter/sources/openclash.sh

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

# 手动触发 OpenClash 检查
eventcenter check openclash

# 查看事件日志
eventcenter list
eventcenter list --limit 20

# 手动发送事件
eventcenter emit <source> <event> <level> <title> [message]

# 清除去重缓存
eventcenter dedup-clear

# 列出可用事件源
eventcenter sources
```

### 服务管理

```bash
# 启动服务（添加 cron 任务）
/etc/init.d/eventcenter start

# 停止服务（移除 cron 任务）
/etc/init.d/eventcenter stop

# 重启服务
/etc/init.d/eventcenter restart

# 查看服务日志
logread | grep eventcenter
```

### LuCI Web 界面

访问 **服务 → Event Center**，包含：

- **概览页**: 服务状态、快速操作按钮、最近 10 条事件
- **设置页**: 全局开关、Telegram 配置、OpenClash 监控配置
- **日志页**: 完整事件日志、分页浏览、自动刷新

## UCI 配置说明

```
config eventcenter 'global'
    option enable '1'              # 总开关
    option log_path '/tmp/eventcenter.log'   # 日志路径
    option log_max_lines '1000'    # 日志最大行数
    option dedup_ttl '300'         # 去重 TTL（秒）
    option dedup_path '/tmp/eventcenter_dedup'
    option dedup_max '500'         # 去重缓存最大条目

config notifier 'telegram'
    option enable '0'              # Telegram 开关
    option token ''                # Bot Token
    option chatid ''               # Chat ID
    option parse_mode 'Markdown'   # Markdown 或 HTML

config monitor 'openclash'
    option enable '1'              # OpenClash 监控开关
    option paths ''                # 自定义配置路径（逗号分隔，空则自动发现）
    option interval '5'            # 检查间隔（分钟）
    option geo_files 'GeoIP.dat,GeoSite.dat,Country.mmdb,ASN.mmdb'
```

## 扩展事件源

在 `/usr/share/eventcenter/sources/` 下创建 `<name>.sh`，实现 `check()` 函数：

```sh
#!/bin/sh
# /usr/share/eventcenter/sources/my_monitor.sh

check() {
    # 检测逻辑
    if [ 某个条件 ]; then
        eventcenter emit my_monitor some_event info \
            "事件标题" "事件详细描述"
    fi
}
```

然后添加对应的 cron 任务或在现有任务中增加 `check my_monitor`。

## 依赖

- `curl` — Telegram API 调用
- `md5sum` — 去重 key 计算（busybox 自带）

## 版本历史

- **v1.0.0** (2026-06-21) — 初始版本
  - 事件引擎 + CLI
  - Telegram 通知器
  - OpenClash 事件源
  - LuCI Web 管理界面
  - Makefile + init.d + 打包
