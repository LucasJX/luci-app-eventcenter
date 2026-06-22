#!/bin/sh
VAL=$(uci -q get openclash.config.dashboard_password)
printf "Authorization: Bearer %s" "$VAL"
