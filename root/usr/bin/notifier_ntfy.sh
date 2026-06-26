#!/bin/sh
# Event Center - ntfy Notifier
# /usr/bin/notifier_ntfy.sh "<message>"
# Sends notification via ntfy (self-hosted or ntfy.sh)

. /usr/share/eventcenter/utils.sh

_url=$(uci -q get eventcenter.ntfy.url 2>/dev/null)
_topic=$(uci -q get eventcenter.ntfy.topic 2>/dev/null)
_token=$(uci -q get eventcenter.ntfy.token 2>/dev/null)
_user=$(uci -q get eventcenter.ntfy.user 2>/dev/null)
_pass=$(uci -q get eventcenter.ntfy.pass 2>/dev/null)
_priority=$(uci -q get eventcenter.ntfy.priority 2>/dev/null)
_icon=$(uci -q get eventcenter.ntfy.icon 2>/dev/null)
_click=$(uci -q get eventcenter.ntfy.click 2>/dev/null)

if [ -z "$_url" ] || [ -z "$_topic" ]; then
    echo "Error: ntfy url or topic not configured" >&2
    exit 1
fi

_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Extract title (first line, strip emoji/markdown)
_title=$(printf '%s' "$_message" | head -1 | sed 's/^[*📊🚀⚠️💚🟡📦📅🔧♻️🚤 ]*//;s/[*]*//g')
[ -z "$_title" ] && _title="Event Center"

# Remove title line from message body (avoid duplicate in ntfy app)
# Skip first line and the empty line after it
_message=$(printf '%s' "$_message" | sed '1{/^$/d};2{/^$/d}' | sed '1d')

# Remove trailing slash from URL
_url=$(echo "$_url" | sed 's:/$::')

# Default values
[ -z "$_priority" ] && _priority="default"

# Auto-detect tags from message content
# Priority: UCI config > auto-detect from content
_tags=$(uci -q get eventcenter.ntfy.tags 2>/dev/null)
if [ -z "$_tags" ]; then
    _tags=""
    # Node change detection
    case "$_message" in
        *节点*|*上线*|*下线*|*切换*|*proxy*|*Proxy*|*代理切换*)
            _tags="node,change"
            ;;
    esac
    # System alert detection
    if [ -z "$_tags" ]; then
        case "$_message" in
            *告警*|*警告*|*错误*|*故障*|*异常*|*alert*|*Alert*|*ERROR*)
                _tags="alert,warning"
                ;;
        esac
    fi
    # Recovery detection
    if [ -z "$_tags" ]; then
        case "$_message" in
            *恢复*|*正常*|*已恢复*|*recovery*|*Recovery*)
                _tags="recovery,ok"
                ;;
        esac
    fi
    # Update detection
    if [ -z "$_tags" ]; then
        case "$_message" in
            *更新*|*升级*|*版本*|*update*|*Update*)
                _tags="update,release"
                ;;
        esac
    fi
fi

# Build curl args
set -- curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 10 \
    -X POST \
    -H "Title: $_title" \
    -H "Priority: $_priority"

# Auth - token takes priority over user/pass
if [ -n "$_token" ]; then
    _hdr=$(printf "%s %s" "Authorization:Bearer" "$_token")
    set -- "$@" -H "$_hdr"
elif [ -n "$_user" ] && [ -n "$_pass" ]; then
    set -- "$@" -u "$_user:$_pass"
fi

# Tags
if [ -n "$_tags" ]; then
    set -- "$@" -H "Tags: $_tags"
fi

# Optional icon
if [ -n "$_icon" ]; then
    set -- "$@" -H "Icon: $_icon"
fi

# Optional click URL
if [ -n "$_click" ]; then
    set -- "$@" -H "Click: $_click"
fi

# Message body and URL
set -- "$@" -d "$_message" "${_url}/${_topic}"

_response=$("$@" 2>/dev/null)
_curl_exit=$?

if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

if [ "$_response" = "200" ]; then
    echo "OK: ntfy notification sent (tags: ${_tags:-none})"
    exit 0
else
    echo "Error: ntfy returned HTTP $_response" >&2
    exit 1
fi
