#!/bin/sh
# Event Center - Auth Header Helper
# Reads Clash API authentication from config
# Returns empty string if no auth is needed (no password set)

VAL=$(uci -q get openclash.config.dashboard_password)

if [ -z "$VAL" ]; then
    # No password configured — Clash API may be running without auth
    # Return empty string so curl won't send an invalid Bearer header
    printf ""
else
    printf "Authorization: Bearer %s" "$VAL"
fi
