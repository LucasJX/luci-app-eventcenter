#!/bin/sh
# Event Center - Alert Aggregation Module
# Prevents notification flooding by aggregating duplicate alerts
# Sends summary notifications instead of individual ones

AGGREGATE_DIR="/tmp/eventcenter_aggregate"
AGGREGATE_TTL=600  # 10 minutes aggregation window

# --- Aggregation functions ---

# aggregate_init
# Initialize aggregation directory
aggregate_init() {
    mkdir -p "$AGGREGATE_DIR" 2>/dev/null
}

# aggregate_key <source> <event>
# Generate aggregation key
aggregate_key() {
    local _source="$1"
    local _event="$2"
    printf '%s:%s' "$_source" "$_event" | md5sum 2>/dev/null | cut -d' ' -f1
}

# aggregate_add <source> <event> <level> <title> <message>
# Add event to aggregation buffer
aggregate_add() {
    local _source="$1"
    local _event="$2"
    local _level="$3"
    local _title="$4"
    local _message="$5"

    aggregate_init

    local _key
    _key=$(aggregate_key "$_source" "$_event")
    local _now
    _now=$(date '+%s')
    local _agg_file="${AGGREGATE_DIR}/${_key}"

    # Create or update aggregation file
    if [ -f "$_agg_file" ]; then
        # Existing aggregation - increment count
        local _count _first_ts _last_ts _level_old _title_old
        read -r _count _first_ts _last_ts _level_old _title_old < "$_agg_file"

        _count=$(( _count + 1 ))
        _last_ts="$_now"

        # Keep the higher severity level
        local _new_level
        _new_level=$(echo "$_level_old $_level" | awk '{
            if ($2 == "critical") print $2
            else if ($2 == "error" && $1 != "critical") print $2
            else if ($2 == "warn" && $1 != "critical" && $1 != "error") print $2
            else print $1
        }')

        printf '%s %s %s %s %s\n' "$_count" "$_first_ts" "$_last_ts" "$_new_level" "$_title_old" > "$_agg_file"

        # Append message to buffer
        echo "$_message" >> "${_agg_file}.msg"
    else
        # New aggregation
        printf '%s %s %s %s %s\n' "1" "$_now" "$_now" "$_level" "$_title" > "$_agg_file"
        echo "$_message" > "${_agg_file}.msg"
    fi
}

# aggregate_flush
# Check and flush expired aggregation buffers, send summary notifications
aggregate_flush() {
    aggregate_init

    local _now
    _now=$(date '+%s')
    local _agg_ttl
    _agg_ttl=$(ec_uci_get "global.aggregate_ttl" "600")

    for _agg_file in "$AGGREGATE_DIR"/*; do
        [ -f "$_agg_file" ] || continue
        [[ "$_agg_file" == *.msg ]] && continue

        local _count _first_ts _last_ts _level _title
        read -r _count _first_ts _last_ts _level _title < "$_agg_file"

        local _age=$(( _now - _first_ts ))

        # Check if aggregation window expired
        if [ "$_age" -ge "$_agg_ttl" ] 2>/dev/null; then
            # Build summary notification
            local _msg=""
            local _key
            _key=$(basename "$_agg_file")

            if [ "$_count" -eq 1 ]; then
                # Single event - send as-is
                _msg=$(cat "${_agg_file}.msg" 2>/dev/null)
            else
                # Multiple events - send summary
                _msg=$(printf "📢 *事件聚合通知*\n\n")
                _msg=$(printf "%s📊 相同事件在 %d 分钟内发生了 *%d 次*\n\n" "$_msg" "$(( _agg_ttl / 60 ))" "$_count")
                _msg=$(printf "%s📋 *最后一条详情:*\n" "$_msg")

                # Get last message
                local _last_msg
                _last_msg=$(tail -1 "${_agg_file}.msg" 2>/dev/null)
                _msg=$(printf "%s%s\n\n" "$_msg" "$_last_msg")

                _msg=$(printf "%s⏰ 首次: %s\n" "$_msg" "$(date -d "@$_first_ts" '+%H:%M' 2>/dev/null || date -r "$_first_ts" '+%H:%M' 2>/dev/null)")
                _msg=$(printf "%s⏰ 最后: %s" "$_msg" "$(date -d "@$_last_ts" '+%H:%M' 2>/dev/null || date -r "$_last_ts" '+%H:%M' 2>/dev/null)")
            fi

            if [ -n "$_msg" ]; then
                # Send aggregated notification directly (bypass aggregation)
                notify_send "$_msg"
            fi

            # Cleanup aggregation files
            rm -f "$_agg_file" "${_agg_file}.msg"
        fi
    done
}

# aggregate_check <source> <event>
# Check if this event should be aggregated (returns 0 if should aggregate)
aggregate_check() {
    local _source="$1"
    local _event="$2"

    local _enable
    _enable=$(ec_uci_get "global.aggregate_enable" "1")
    [ "$_enable" != "1" ] && return 1

    aggregate_init

    local _key
    _key=$(aggregate_key "$_source" "$_event")
    local _agg_file="${AGGREGATE_DIR}/${_key}"

    # If aggregation file exists, this is a duplicate within window
    if [ -f "$_agg_file" ]; then
        return 0
    fi

    return 1
}

# aggregate_status
# Show aggregation status
aggregate_status() {
    aggregate_init

    echo "=== Alert Aggregation Status ==="
    echo "Directory: $AGGREGATE_DIR"
    echo "TTL: $(ec_uci_get "global.aggregate_ttl" "600") seconds"
    echo ""

    local _count=0
    for _agg_file in "$AGGREGATE_DIR"/*; do
        [ -f "$_agg_file" ] || continue
        [[ "$_agg_file" == *.msg ]] && continue

        local _count_ev _first_ts _last_ts _level _title
        read -r _count_ev _first_ts _last_ts _level _title < "$_agg_file"

        printf "  %-20s count=%-3s level=%-8s title=%s\n" \
            "$(basename "$_agg_file")" "$_count_ev" "$_level" "$_title"
        _count=$(( _count + 1 ))
    done

    [ "$_count" -eq 0 ] && echo "  (no active aggregations)"
}
