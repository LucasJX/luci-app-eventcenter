# Task 2: Telegram Notifier + 事件源框架

## 目标
实现 Telegram 通知发送器和可插拔的事件源框架。

## 具体要求

### 1. Telegram Notifier `/usr/bin/notifier_telegram.sh`
```sh
#!/bin/sh
# 用法：notifier_telegram.sh "<消息内容>"
# 从 UCI 读取 token 和 chatid
# 调用 Telegram Bot API sendMessage
# 支持 Markdown 和 HTML 两种 parse_mode
# 返回发送结果（成功/失败+错误码）
# 超时 10 秒
```

### 2. 事件源框架
- 每个事件源是一个独立脚本，放在 `/usr/share/eventcenter/sources/`
- 命名规范：`<source_name>.sh`
- 每个脚本必须实现 `check()` 函数
- 脚本通过 `eventcenter emit` 提交事件

### 3. OpenClash 事件源 `/usr/share/eventcenter/sources/openclash.sh`
```sh
#!/bin/sh
# check() 函数：
# 1. 从 UCI 读取 monitor.openclash.paths
#    - 留空则自动发现 /etc/openclash/config/*.yaml
# 2. 从 UCI 读取 monitor.openclash.geo_files
# 3. 计算每个文件的 md5
# 4. 与缓存对比（/tmp/eventcenter_state_openclash）
# 5. 有变化则调用 eventcenter emit
# 6. 更新缓存
```

### 4. 自动发现逻辑
```
1. 读取 UCI paths 配置
2. 如果为空，扫描 /etc/openclash/config/ 目录
3. 过滤 *.yaml 文件
4. 同时检查 geo_files 列表中的文件
5. 在 LuCI 界面显示当前发现的文件列表
```

### 5. 测试命令
```sh
# 发送测试消息
eventcenter test

# 手动触发 OpenClash 检查
eventcenter check openclash

# 发送自定义事件
eventcenter emit test manual info "测试" "这是一条测试消息"
```

## ⚠️ 注意事项
- 不硬编码 OpenClash 路径，全部从 UCI 读取或自动发现
- 自动发现扫描 `/etc/openclash/config/` 目录下所有 `.yaml` 文件
- GEO 文件也从 UCI 读取文件名列表，不硬编码
- Telegram API 调用必须有超时（10s）和错误处理
- notifier 必须解耦，未来可扩展微信/webhook 等
