#!/bin/sh
# Event Center - Webhook Notifier
# Generic webhook notifier for DingTalk, Feishu, Bark, etc.
# Supports custom URL templates and message formatting

# --- Webhook sender ---

webhook_send() {
    local _message="$1"
    local _url _method _content_type _body_template _headers

    # Read webhook config from UCI
    _url=$(ec_uci_get "webhook.url" "")
    _method=$(ec_uci_get "webhook.method" "POST")
    _content_type=$(ec_uci_get "webhook.content_type" "application/json")
    _body_template=$(ec_uci_get "webhook.body_template" "")
    _headers=$(ec_uci_get "webhook.headers" "")

    if [ -z "$_url" ]; then
        echo "Error: webhook URL not configured" >&2
        return 1
    fi

    # Build request body
    local _body=""
    if [ -n "$_body_template" ]; then
        # Use custom template with message substitution
        _body=$(echo "$_body_template" | sed "s|{{message}}|$(echo "$_message" | sed 's/|/\\|/g')|g")
    else
        # Default JSON body
        _body=$(printf '{"msgtype":"text","text":{"content":"%s"}}' \
            "$(echo "$_message" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')")
    fi

    # Build curl command
    local _curl_cmd="curl -s -m 10 -X $_method"

    # Add content type
    _curl_cmd="$_curl_cmd -H 'Content-Type: $_content_type'"

    # Add custom headers
    if [ -n "$_headers" ]; then
        echo "$_headers" | tr '|' '\n' | while read -r _header; do
            [ -n "$_header" ] && _curl_cmd="$_curl_cmd -H '$_header'"
        done
    fi

    # Add body
    _curl_cmd="$_curl_cmd -d '$_body'"

    # Add URL
    _curl_cmd="$_curl_cmd '$_url'"

    # Execute
    local _result
    _result=$(eval "$_curl_cmd" 2>&1)
    local _exit_code=$?

    if [ $_exit_code -ne 0 ]; then
        echo "Error: webhook request failed (exit code $_exit_code)" >&2
        echo "$_result" >&2
        return 1
    fi

    # Check response (for common success indicators)
    if echo "$_result" | grep -qE '"errcode":0|"code":0|"status":"ok"|"success":true'; then
        return 0
    fi

    # If no success indicator found, assume success (some APIs don't return status)
    return 0
}

# --- Platform-specific templates ---

# DingTalk robot
dingtalk_template() {
    local _message="$1"
    local _token=$(ec_uci_get "webhook.dingtalk_token" "")

    if [ -z "$_token" ]; then
        echo "Error: DingTalk token not configured" >&2
        return 1
    fi

    local _url="https://oapi.dingtalk.com/robot/send?access_token=$_token"
    local _body=$(printf '{"msgtype":"text","text":{"content":"%s"}}' \
        "$(echo "$_message" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')")

    curl -s -m 10 -X POST \
        -H 'Content-Type: application/json' \
        -d "$_body" \
        "$_url" >/dev/null 2>&1
}

# Feishu robot
feishu_template() {
    local _message="$1"
    local _token=$(ec_uci_get "webhook.feishu_token" "")

    if [ -z "$_token" ]; then
        echo "Error: Feishu token not configured" >&2
        return 1
    fi

    local _url="https://open.feishu.cn/open-apis/bot/v2/hook/$_token"
    local _body=$(printf '{"msg_type":"text","content":{"text":"%s"}}' \
        "$(echo "$_message" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')")

    curl -s -m 10 -X POST \
        -H 'Content-Type: application/json' \
        -d "$_body" \
        "$_url" >/dev/null 2>&1
}

# Bark (iOS)
bark_template() {
    local _message="$1"
    local _server=$(ec_uci_get "webhook.bark_server" "https://api.day.app")
    local _key=$(ec_uci_get "webhook.bark_key" "")

    if [ -z "$_key" ]; then
        echo "Error: Bark key not configured" >&2
        return 1
    fi

    local _title="Event Center"
    local _encoded_message=$(echo "$_message" | sed 's/ /%20/g; s/\n/%0A/g')

    local _url="${_server}/${_key}/${_title}/${_encoded_message}"

    curl -s -m 10 -X POST "$_url" >/dev/null 2>&1
}

# --- Main entry point ---

main() {
    local _message="$1"
    local _platform=$(ec_uci_get "webhook.platform" "custom")

    case "$_platform" in
        dingtalk)
            dingtalk_template "$_message"
            ;;
        feishu)
            feishu_template "$_message"
            ;;
        bark)
            bark_template "$_message"
            ;;
        custom|*)
            webhook_send "$_message"
            ;;
    esac
}

# Run if called directly
if [ "$1" = "test" ]; then
    main "🧪 Webhook 测试消息 - $(date '+%Y-%m-%d %H:%M:%S')"
else
    main "$1"
fi
