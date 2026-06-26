#!/bin/sh
# deploy.sh - Deploy luci-app-eventcenter to router
# Preserves existing UCI config (token, chatid, etc.)
# Usage: ./deploy.sh [router_ip]
# Auth: SSH key (preferred) or password via env DEPLOY_PASS

ROUTER="${1:-192.168.100.1}"
BASE="$(dirname "$0")"

# Auth method: prefer SSH key, fallback to password from env var
if [ -n "$DEPLOY_PASS" ]; then
    SSH_CMD="sshpass -p \"$DEPLOY_PASS\" ssh -o StrictHostKeyChecking=no root@${ROUTER}"
    SCP_CMD="sshpass -p \"$DEPLOY_PASS\" scp -o StrictHostKeyChecking=no"
else
    SSH_CMD="ssh -o StrictHostKeyChecking=no root@${ROUTER}"
    SCP_CMD="scp -o StrictHostKeyChecking=no"
fi

ssh_cmd() { eval "$SSH_CMD \"$@\"" 2>/dev/null; }
scp_to()  { eval "$SCP_CMD \"$1\" root@${ROUTER}:\"$2\"" 2>/dev/null; }

echo "=== Deploying v1.3.0 to ${ROUTER} ==="

# 1. Backup existing config
echo "→ Backing up config..."
ssh_cmd "cp /etc/config/eventcenter /tmp/eventcenter.bak 2>/dev/null"

# 2. Deploy frontend files
echo "→ Deploying frontend..."
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/overview.js" "/www/luci-static/resources/view/eventcenter/overview.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/health.js" "/www/luci-static/resources/view/eventcenter/health.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/settings.js" "/www/luci-static/resources/view/eventcenter/settings.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/logs.js" "/www/luci-static/resources/view/eventcenter/logs.js"

# 3. Deploy backend scripts
echo "→ Deploying backend..."
scp_to "${BASE}/root/usr/share/eventcenter/sources/openclash.sh" "/usr/share/eventcenter/sources/openclash.sh"
scp_to "${BASE}/root/usr/share/eventcenter/sources/node-health.sh" "/usr/share/eventcenter/sources/node-health.sh"
scp_to "${BASE}/root/usr/share/eventcenter/sources/system-health.sh" "/usr/share/eventcenter/sources/system-health.sh"
scp_to "${BASE}/root/usr/share/eventcenter/sources/device-monitor.sh" "/usr/share/eventcenter/sources/device-monitor.sh"
scp_to "${BASE}/root/usr/share/eventcenter/sources/sub.sh" "/usr/share/eventcenter/sources/sub.sh"
scp_to "${BASE}/root/usr/share/eventcenter/utils.sh" "/usr/share/eventcenter/utils.sh"
scp_to "${BASE}/root/usr/share/eventcenter/auth_header.sh" "/usr/share/eventcenter/auth_header.sh"
scp_to "${BASE}/root/usr/share/eventcenter/watcher.sh" "/usr/share/eventcenter/watcher.sh"
scp_to "${BASE}/root/usr/share/eventcenter/engine.sh" "/usr/share/eventcenter/engine.sh"
scp_to "${BASE}/root/usr/bin/eventcenter" "/usr/bin/eventcenter"

# 4. Deploy notifiers
echo "→ Deploying notifiers..."
scp_to "${BASE}/root/usr/bin/notifier_telegram.sh" "/usr/bin/notifier_telegram.sh"
scp_to "${BASE}/root/usr/bin/notifier_wechat.sh" "/usr/bin/notifier_wechat.sh"
scp_to "${BASE}/root/usr/bin/notifier_bark.sh" "/usr/bin/notifier_bark.sh"
scp_to "${BASE}/root/usr/bin/notifier_pushplus.sh" "/usr/bin/notifier_pushplus.sh"
scp_to "${BASE}/root/usr/bin/notifier_serverchan.sh" "/usr/bin/notifier_serverchan.sh"
scp_to "${BASE}/root/usr/bin/notifier_serverchan3.sh" "/usr/bin/notifier_serverchan3.sh"
scp_to "${BASE}/root/usr/bin/notifier_ntfy.sh" "/usr/bin/notifier_ntfy.sh"

# 5. Deploy init.d and menu
echo "→ Deploying service files..."
scp_to "${BASE}/root/etc/init.d/eventcenter" "/etc/init.d/eventcenter"
scp_to "${BASE}/root/usr/share/luci/menu.d/luci-app-eventcenter.json" "/usr/share/luci/menu.d/luci-app-eventcenter.json"
scp_to "${BASE}/root/usr/share/rpcd/acl.d/eventcenter.json" "/usr/share/rpcd/acl.d/eventcenter.json"

# 6. Run uci-defaults to add new sections
echo "→ Running uci-defaults for new config sections..."
scp_to "${BASE}/root/etc/uci-defaults/luci-app-eventcenter" "/tmp/luci-app-eventcenter-uci-defaults"
ssh_cmd "chmod 755 /tmp/luci-app-eventcenter-uci-defaults && /tmp/luci-app-eventcenter-uci-defaults && rm -f /tmp/luci-app-eventcenter-uci-defaults"

# 7. Set permissions
echo "→ Setting permissions..."
ssh_cmd "chmod 755 /usr/share/eventcenter/sources/*.sh /usr/share/eventcenter/auth_header.sh /usr/share/eventcenter/watcher.sh /usr/share/eventcenter/engine.sh /usr/bin/eventcenter /etc/init.d/eventcenter"
ssh_cmd "chmod 755 /usr/bin/notifier_telegram.sh /usr/bin/notifier_wechat.sh /usr/bin/notifier_bark.sh /usr/bin/notifier_pushplus.sh /usr/bin/notifier_serverchan.sh /usr/bin/notifier_serverchan3.sh /usr/bin/notifier_ntfy.sh"
ssh_cmd "chmod 644 /www/luci-static/resources/view/eventcenter/*.js /usr/share/luci/menu.d/luci-app-eventcenter.json"
ssh_cmd "mkdir -p /etc/eventcenter"

# 8. Restart service
echo "→ Restarting service..."
ssh_cmd "/etc/init.d/eventcenter restart"

# 9. Clear LuCI cache
echo "→ Clearing LuCI cache..."
ssh_cmd "rm -rf /tmp/luci-*"

# 10. Verify
echo "→ Verifying..."
ssh_cmd "eventcenter status" && echo "✓ Service OK" || echo "✗ Service failed"

echo "=== Done (v1.3.0) ==="
