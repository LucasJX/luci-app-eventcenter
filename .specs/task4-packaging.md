# Task 4: Makefile + init.d + 打包

## 目标
实现 OpenWrt 标准的 Makefile、init.d 服务脚本，完成可编译的插件包。

## 具体要求

### 1. Makefile
```makefile
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-eventcenter
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=Event Center - 通用事件通知中心
LUCI_DESCRIPTION:=路由器事件通知中心，支持 Telegram/微信等多通道通知
LUCI_DEPENDS:=+curl
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,luci-app-eventcenter))
```

### 2. init.d 服务 `/etc/init.d/eventcenter`
```sh
#!/bin/sh /etc/rc.common

START=99
STOP=10

USE_PROCD=1

start_service() {
    # 读取 UCI 配置
    local enable=$(uci get eventcenter.global.enable 2>/dev/null)
    [ "$enable" != "1" ] && return

    # 设置 cron 定时任务
    local interval=$(uci get eventcenter.monitor.openclash.interval 2>/dev/null || echo "5")
    
    # 检查是否已存在，避免重复添加
    grep -q 'eventcenter' /etc/crontabs/root 2>/dev/null || {
        echo "*/$interval * * * * /usr/bin/eventcenter check openclash" >> /etc/crontabs/root
    }
    
    /etc/init.d/cron restart
    logger -t eventcenter "service started"
}

stop_service() {
    # 移除 cron 任务
    sed -i '/eventcenter/d' /etc/crontabs/root
    /etc/init.d/cron restart
    logger -t eventcenter "service stopped"
}

reload_service() {
    stop_service
    start_service
}
```

### 3. 完整目录结构
```
luci-app-eventcenter/
├── Makefile
├── root/
│   ├── etc/
│   │   ├── config/eventcenter
│   │   └── init.d/eventcenter
│   ├── usr/
│   │   ├── bin/
│   │   │   ├── eventcenter
│   │   │   ├── notifier_telegram.sh
│   │   │   ├── eventcenter_format.sh
│   │   │   └── eventcenter_dedup.sh
│   │   ├── share/
│   │   │   ├── eventcenter/
│   │   │   │   ├── engine.sh
│   │   │   │   ├── utils.sh
│   │   │   │   └── sources/
│   │   │   │       └── openclash.sh
│   │   │   ├── rpcd/acl.d/eventcenter.json
│   │   │   └── luci/menu.d/luci-app-eventcenter.json
│   │   └── lib/upgrade/keep.d/luci-app-eventcenter
├── htdocs/
│   └── luci-static/resources/view/eventcenter/
│       ├── overview.js
│       ├── settings.js
│       └── logs.js
└── README.md
```

### 4. keep.d 配置
`/usr/lib/upgrade/keep.d/luci-app-eventcenter`
```
/etc/config/eventcenter
```
确保升级时保留配置。

## ⚠️ 注意事项
- Makefile 必须兼容 OpenWrt 标准编译系统
- init.d 必须用 procd 风格（USE_PROCD=1）
- cron 任务添加前必须检查是否已存在
- 所有脚本文件需要设置可执行权限（chmod +x）
- keep.d 确保升级不丢配置
