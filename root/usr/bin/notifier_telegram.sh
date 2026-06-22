#!/bin/sh
# Event Center - Telegram Notifier
# /usr/bin/notifier_telegram.sh "<message>"
# Sends notification via Telegram Bot API
# Reads token, chatid, parse_mode from UCI

# Load utils for UCI helpers
. /usr/share/eventcenter/utils.sh

# Read config from UCI
_token=$(uci -q get eventcenter.telegram.token 2>/dev/null)
_chatid=$(uci -q get eventcenter.telegram.chatid 2>/dev/null)
_parse_mode=$(uci -q get eventcenter.telegram.parse_mode 2>/dev/null)

# Validate required fields
if [ -z "$_token" ]; then
    echo "Error: Telegram bot token not configured" >&2
    exit 1
fi

if [ -z "$_chatid" ]; then
    echo "Error: Telegram chat ID not configured" >&2
    exit 1
fi

# Message content from argument
_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Default parse_mode
[ -z "$_parse_mode" ] && _parse_mode="HTML"

# Build JSON safely using awk to escape special chars
_json=$(printf '%s' "$_message" | awk -v chatid="$_chatid" -v mode="$_parse_mode" '
BEGIN { ORS="" }
{
    if (NR > 1) buf = buf "\n";
    buf = buf $0
}
END {
    gsub(/\\/, "\\\\", buf);
    gsub(/"/, "\\\"", buf);
    gsub(/\n/, "\\n", buf);
    gsub(/\r/, "\\r", buf);
    gsub(/\t/, "\\t", buf);
    printf "{\"chat_id\":\"%s\",\"text\":\"%s\",\"parse_mode\":\"%s\"}", chatid, buf, mode
}')

# Send via Telegram Bot API
_api_url="https://api.telegram.org/bot${_token}/sendMessage"

_response=$(curl -s -o /tmp/telegram_response.json -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$_json" \
    "$_api_url" 2>/dev/null)

_curl_exit=$?

# Cleanup temp file
rm -f /tmp/telegram_response.json 2>/dev/null

# Check curl exit code
if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

# Check HTTP status
if [ "$_response" = "200" ]; then
    echo "OK: Telegram notification sent"
    exit 0
else
    echo "Error: Telegram API returned HTTP $_response" >&2
    exit 1
fi
