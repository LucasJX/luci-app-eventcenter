include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-eventcenter
PKG_VERSION:=1.3.0
PKG_RELEASE:=1

LUCI_TITLE:=Event Center - 通用事件通知中心
LUCI_DESCRIPTION:=路由器事件通知中心，支持 Telegram/微信等多通道通知
LUCI_DEPENDS:=+curl +inotify-tools
LUCI_PKGARCH:=all

define Package/luci-app-eventcenter/conffiles
/etc/config/eventcenter
endef

define Package/luci-app-eventcenter/preinst
#!/bin/sh
[ "$${IPKG_NO_SCRIPT}" = "1" ] && exit 0
# Stop service before upgrade
/etc/init.d/eventcenter stop 2>/dev/null
exit 0
endef

define Package/luci-app-eventcenter/prerm
#!/bin/sh
[ "$${IPKG_NO_SCRIPT}" = "1" ] && exit 0
# Stop service and clean up
/etc/init.d/eventcenter stop 2>/dev/null
/etc/init.d/eventcenter disable 2>/dev/null
# Clean temp files
rm -f /tmp/eventcenter* /tmp/ec_* /tmp/eventcenter_dedup* 2>/dev/null
exit 0
endef

define Package/luci-app-eventcenter/postinst
#!/bin/sh
[ "$${IPKG_NO_SCRIPT}" = "1" ] && exit 0
# Run uci-defaults
for f in /etc/uci-defaults/luci-app-eventcenter*; do
    [ -f "$f" ] && . "$f" && rm -f "$f"
done
# Enable and start service
/etc/init.d/eventcenter enable 2>/dev/null
/etc/init.d/eventcenter start 2>/dev/null
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,luci-app-eventcenter))
