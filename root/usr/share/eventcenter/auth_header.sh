#!/bin/sh
VAL=$(uci -q get openclash.config.dashboard_password)
[ -n "$VAL" ] && printf 'Authorization: Bearer %s' "$VAL"
