#!/bin/sh
# Event Center - File Watcher
# Monitors OpenClash config and proxy provider directories using inotifywait

WATCHER_PID_FILE="/tmp/eventcenter_watcher.pid"

# Read debounce delay from UCI (default 5 seconds)
DEBOUNCE=$(uci -q get eventcenter.@monitor[0].debounce 2>/dev/null)
[ -z "$DEBOUNCE" ] && DEBOUNCE=5

# Build watch paths
WATCH_PATHS=""
CONFIG_DIR="/etc/openclash/config"
PROVIDER_DIR="/etc/openclash/proxy_provider"

[ -d "$CONFIG_DIR" ] && WATCH_PATHS="$CONFIG_DIR"
[ -d "$PROVIDER_DIR" ] && WATCH_PATHS="$WATCH_PATHS $PROVIDER_DIR"

if [ -z "$WATCH_PATHS" ]; then
    logger -t eventcenter "watcher: no watchable directories found"
    exit 1
fi

# Save PID
echo $$ > "$WATCHER_PID_FILE"

logger -t eventcenter "watcher: started (dirs=$WATCH_PATHS, debounce=${DEBOUNCE}s)"

# Cleanup on exit
trap "rm -f $WATCHER_PID_FILE; logger -t eventcenter 'watcher: stopped'; exit 0" INT TERM

_last_trigger=0

while true; do
    _tmpfifo="/tmp/eventcenter_fifo_$$"
    rm -f "$_tmpfifo"
    mkfifo "$_tmpfifo"

    inotifywait -m -r -e modify,create,moved_to \
        --format '%w%f' \
        $WATCH_PATHS > "$_tmpfifo" 2>/dev/null &
    _inotify_pid=$!

    while read -r _changed_file; do
        # Only care about .yaml files
        case "$_changed_file" in
            *.yaml|*.yml) ;;
            *) continue ;;
        esac

        # Skip temp/backup files
        case "$_changed_file" in
            *.tmp|*.bak|*.swp|*~|*.part|*.swpx) continue ;;
        esac

        _now=$(date '+%s')
        _elapsed=$(( _now - _last_trigger ))

        if [ "$_elapsed" -ge "$DEBOUNCE" ] 2>/dev/null; then
            logger -t eventcenter "watcher: config changed ($(basename "$_changed_file")), triggering check"
            /usr/bin/eventcenter check openclash >/dev/null 2>&1
            _last_trigger=$(date '+%s')
        fi
    done < "$_tmpfifo"

    kill "$_inotify_pid" 2>/dev/null
    rm -f "$_tmpfifo"

    logger -t eventcenter "watcher: inotifywait exited, restarting in 10s"
    sleep 10
done
