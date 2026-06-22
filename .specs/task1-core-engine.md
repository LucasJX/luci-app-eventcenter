# Task 1: Event Center 核心引擎 + CLI

## 目标
实现 eventcenter 的核心 CLI 和事件处理引擎，不依赖任何外部服务，纯本地可测试。

## 具体要求

### 1. `/usr/bin/eventcenter` 主入口
```sh
#!/bin/sh
# 核心命令：
# eventcenter emit <source> <event> <level> <title> <message>
# eventcenter list [--limit N]  # 查看日志
# eventcenter test              # 发送测试通知
# eventcenter status            # 显示服务状态
```

### 2. 事件引擎 `/usr/share/eventcenter/engine.sh`
- 读取 UCI 配置
- 去重检查
- 格式化消息
- 调用 notifier

### 3. 工具函数 `/usr/share/eventcenter/utils.sh`
- `log_write()` — 写日志文件
- `dedup_check()` — 去重检查（基于 source+event 的 md5，N 分钟内不重复）
- `format_message()` — 格式化消息模板

### 4. UCI 配置 `/etc/config/eventcenter`
```
config eventcenter 'global'
    option enable '1'
    option log_path '/tmp/eventcenter.log'
    option log_max_lines '1000'
    option dedup_ttl '300'

config notifier 'telegram'
    option enable '0'
    option token ''
    option chatid ''
    option parse_mode 'Markdown'

config monitor 'openclash'
    option enable '1'
    option paths ''       # 留空=自动发现 /etc/openclash/config/*.yaml
    option interval '5'
    option geo_files 'GeoIP.dat,GeoSite.dat,Country.mmdb,ASN.mmdb'
```

### 5. 去重机制
- 缓存文件：`/tmp/eventcenter_dedup`（UCI 可配路径）
- 去重 key：`source:event` 的 md5（同类型事件在 TTL 内只发一次）
- 缓存超过 500 条自动清理
- 格式：`key|timestamp`

### 6. 日志格式
每行：`timestamp|source|event|level|title|message`
- `log_max_lines` 超过后自动截断（保留最新 N 行）

## ⚠️ 注意事项
- 所有路径从 UCI 读取，有默认值但可改
- Shell 脚本必须 `#!/bin/sh`，不依赖 bash
- 不要硬编码任何文件名或路径
- 日志和 dedup 缓存默认在 tmpfs（重启清空），可配持久化路径
