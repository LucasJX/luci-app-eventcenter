#!/bin/sh
# Event Center - Device Monitor Event Source
# Monitors device connectivity (online/offline status changes)

. /usr/share/eventcenter/utils.sh

# check_device <ip>
# Attempts a quick connectivity check via ping + ARP
check_device() {
    local _ip="$1"
    local _timeout="$2"
    [ -z "$_timeout" ] && _timeout=1

    # Ping with short timeout
    if ping -W "$_timeout" -c 1 "$_ip" >/dev/null 2>&1; then
        return 0  # online
    fi

    # Check ARP table as fallback (device may not respond to ping but be on LAN)
    if arp -n | grep -q "$_ip"; then
        return 0  # online (ARP entry exists)
    fi

    return 1  # offline
}

# device_monitor()
# Main check routine — iterates configured devices and emits events on status change
device_monitor() {
    local _state_dir="/etc/eventcenter/states/devices"
    mkdir -p "$_state_dir" 2>/dev/null

    # Read monitored devices from config or device list file
    local _device_list
    _device_list=$(uci -q get eventcenter.device_monitor.devices 2>/dev/null)

    # If no explicit device list, try to discover from DHCP leases
    if [ -z "$_device_list" ]; then
        _device_list=$(awk '{print $2}' /tmp/dhcp.leases 2>/dev/null | tr '\n' ' ')
    fi

    if [ -z "$_device_list" ]; then
        logger -t eventcenter "device-monitor: no devices to monitor"
        return 0
    fi

    local _alerts=""
    local _level="info"

    for _device in $_device_list; do
        # Skip empty entries
        [ -z "$_device" ] && continue

        local _ip _name
        # Parse "name|ip" format or plain IP
        if echo "$_device" | grep -q '|'; then
            _name=$(echo "$_device" | cut -d'|' -f1)
            _ip=$(echo "$_device" | cut -d'|' -f2)
        else
            _ip="$_device"
            # Try to resolve name from DHCP leases
            _name=$(grep "$_ip" /tmp/dhcp.leases 2>/dev/null | awk '{print $3}' | head -1)
            [ -z "$_name" ] && _name="$_ip"
        fi

        local _was_online=1  # assume online by default
        local _state_file="${_state_dir}/${_ip}.state"

        if [ -f "$_state_file" ]; then
            _was_online=$(cat "$_state_file" 2>/dev/null)
        fi

        local _is_online
        if check_device "$_ip" 1; then
            _is_online=1
        else
            _is_online=0
        fi

        # Save current state
        echo "$_is_online" > "$_state_file" 2>/dev/null

        # Emit event on status change via the event pipeline (dedup + log + notify)
        if [ "$_was_online" != "$_is_online" ]; then
            local _event_type _msg
            if [ "$_is_online" = "0" ]; then
                _event_type="offline"
                _level="warn"
                _msg="🔴 ${_name} (${_ip}) 已离线"
            else
                _event_type="online"
                _level="info"
                _msg="🟢 ${_name} (${_ip}) 已恢复在线"
            fi
            eventcenter emit device-monitor "device_${_event_type}_${_ip}" "$_level" \
                "设备状态变更" "$_msg"
        fi
    done

    return 0
}

# List devices for overview page
# Output format: name|ip|mac|status (one per line)
device_list() {
    local _state_dir="/etc/eventcenter/states/devices"
    local _device_list
    _device_list=$(uci -q get eventcenter.device_monitor.devices 2>/dev/null)

    if [ -z "$_device_list" ]; then
        _device_list=$(awk '{print $2}' /tmp/dhcp.leases 2>/dev/null | tr '\n' ' ')
    fi

    if [ -z "$_device_list" ]; then
        return 0
    fi

    for _device in $_device_list; do
        [ -z "$_device" ] && continue

        local _ip _name _mac _status
        if echo "$_device" | grep -q '|'; then
            _name=$(echo "$_device" | cut -d'|' -f1)
            _ip=$(echo "$_device" | cut -d'|' -f2)
        else
            _ip="$_device"
            _name=$(grep "$_ip" /tmp/dhcp.leases 2>/dev/null | awk '{print $3}' | head -1)
            [ -z "$_name" ] && _name="$_ip"
        fi

        # Get MAC from DHCP leases
        _mac=$(grep "$_ip" /tmp/dhcp.leases 2>/dev/null | awk '{print $4}' | head -1)
        [ -z "$_mac" ] && _mac="unknown"

        # Check current status
        if check_device "$_ip" 1; then
            _status="up"
        else
            _status="down"
        fi

        printf '%s|%s|%s|%s\n' "$_name" "$_ip" "$_mac" "$_status"
    done
}

# Engine entry point — engine.sh sources then calls check()
check() {
    device_monitor
}

# CLI entry — only runs when script is executed directly (not sourced by engine)
# When sourced: no arguments passed, skip case block
# When executed directly: $1 is the sub-command
if [ $# -gt 0 ]; then
    case "$1" in
        list)   device_list ;;
        check)  device_monitor ;;
        *)      device_monitor ;;
    esac
fi
