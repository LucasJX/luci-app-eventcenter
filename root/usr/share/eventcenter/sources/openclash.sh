#!/bin/sh
# Event Center - OpenClash Event Source
# Monitors OpenClash subscription config and proxy provider files
# Compares proxy node lists and generates detailed change reports

# extract_node_names <file>
# Extracts proxy node names from provider YAML (only proxies: section)
extract_node_names() {
    local _file="$1"
    awk '
        /^proxies:/ { in_proxies=1; next }
        /^(proxy-groups|rules):/ { in_proxies=0 }
        in_proxies && /name:/ {
            line=$0
            sub(/.*name:[[:space:]]*/, "", line)
            sub(/,.*/, "", line)
            gsub(/[\047"]/, "", line)
            if (line !~ /(剩余|到期|套餐|距离|故障|充值|流量|重置|过期|expire|traffic|reset|servername)/ && line != "")
                print line
        }
    ' "$_file" 2>/dev/null
}

# detect_region <node_name>
# Detects region from Chinese keywords in node name
# Returns region_code, or empty if unknown
detect_region() {
    echo "$1" | awk '{
        n = $0
        if      (index(n, "新加坡") || index(n, "狮城"))  print "SG"
        else if (index(n, "加拿大"))                        print "CA"
        else if (index(n, "澳大利亚") || index(n, "澳洲"))  print "AU"
        else if (index(n, "香港"))                          print "HK"
        else if (index(n, "台湾"))                          print "TW"
        else if (index(n, "日本"))                          print "JP"
        else if (index(n, "美国"))                          print "US"
        else if (index(n, "韩国"))                          print "KR"
        else if (index(n, "德国"))                          print "DE"
        else if (index(n, "法国"))                          print "FR"
        else if (index(n, "英国"))                          print "UK"
        else if (index(n, "荷兰"))                          print "NL"
        else if (index(n, "印度"))                          print "IN"
        else if (index(n, "智利"))                          print "CL"
        else if (index(n, "巴西"))                          print "BR"
        else if (index(n, "西班牙"))                        print "ES"
        else if (index(n, "瑞士"))                          print "CH"
        else if (index(n, "瑞典"))                          print "SE"
        else if (index(n, "墨西哥"))                        print "MX"
        else if (index(n, "俄罗斯"))                        print "RU"
        else if (index(n, "土耳其"))                        print "TR"
        else if (index(n, "阿根廷"))                        print "AR"
        else if (index(n, "意大利"))                        print "IT"
    }'
}

# check()
check() {
    local _state_file
    _state_file=$(ec_uci_get "monitor.openclash.state_file" "/tmp/eventcenter_state_openclash")
    local _first_run=0

    if [ ! -f "$_state_file" ]; then
        _first_run=1
        echo "First run: building baseline state" >&2
    fi

    # Discover config files
    local _config_files=""
    local _paths
    _paths=$(uci -q get eventcenter.@monitor[0].paths 2>/dev/null)
    if [ -n "$_paths" ]; then
        _config_files=$(echo "$_paths" | tr ',' '\n')
    else
        [ -d "/etc/openclash/config" ] && _config_files=$(find /etc/openclash/config -maxdepth 1 -name '*.yaml' -type f 2>/dev/null)
    fi
    [ -z "$_config_files" ] && return 0

    # Discover provider files
    local _tmp_providers="/tmp/eventcenter_providers_$$"
    : > "$_tmp_providers"

    local _cf _pf
    for _cf in $_config_files; do
        [ -z "$_cf" ] || [ ! -f "$_cf" ] && continue
        grep -A5 'proxy-providers:' "$_cf" 2>/dev/null | grep 'path:' | sed "s/.*path:[[:space:]]*//;s/['\"]//g;s/\.\///" | while read -r _p; do
            local _pp="/etc/openclash/$_p"
            [ -f "$_pp" ] && echo "$_pp"
        done >> "$_tmp_providers"
    done

    # Also scan default provider directory
    if [ -d "/etc/openclash/proxy_provider" ]; then
        for _pp in /etc/openclash/proxy_provider/*.yaml; do
            [ -f "$_pp" ] && grep -qxF "$_pp" "$_tmp_providers" 2>/dev/null || echo "$_pp"
        done >> "$_tmp_providers"
    fi

    # Build current node list
    local _tmp_current="/tmp/eventcenter_current_$$"
    : > "$_tmp_current"
    local _current_total=0

    sort -u "$_tmp_providers" | while IFS= read -r _pf; do
        [ -z "$_pf" ] || [ ! -f "$_pf" ] && continue
        _nodes=$(extract_node_names "$_pf")
        if [ -n "$_nodes" ]; then
            echo "$_nodes" >> "$_tmp_current"
        fi
    done

    _current_total=$(wc -l < "$_tmp_current" 2>/dev/null || echo 0)

    # Extract old node names from state file
    local _tmp_old="/tmp/eventcenter_old_$$"
    : > "$_tmp_old"
    local _old_total=0

    if [ -f "$_state_file" ]; then
        grep "^nodes:" "$_state_file" 2>/dev/null | while IFS= read -r _line; do
            echo "$_line" | sed 's/^nodes://' | tr ',' '\n' | grep -v '^$'
        done > "$_tmp_old"
        _old_total=$(wc -l < "$_tmp_old" 2>/dev/null || echo 0)
    fi

    # Compare using grep -vxFf (busybox-compatible comm replacement)
    local _tmp_added="/tmp/eventcenter_added_$$"
    local _tmp_removed="/tmp/eventcenter_removed_$$"

    grep -vxFf "$_tmp_old" "$_tmp_current" > "$_tmp_added" 2>/dev/null
    grep -vxFf "$_tmp_current" "$_tmp_old" > "$_tmp_removed" 2>/dev/null

    local _added_count _removed_count
    _added_count=$(wc -l < "$_tmp_added" 2>/dev/null || echo 0)
    _removed_count=$(wc -l < "$_tmp_removed" 2>/dev/null || echo 0)

    if [ "$_added_count" -gt 0 ] 2>/dev/null || [ "$_removed_count" -gt 0 ] 2>/dev/null; then
        if [ "$_first_run" -eq 0 ]; then
            # Build region change summary using awk
            local _tmp_regions="/tmp/eventcenter_regions_$$"
            : > "$_tmp_regions"

            if [ -s "$_tmp_added" ]; then
                while IFS= read -r _name; do
                    [ -z "$_name" ] && continue
                    _r=$(detect_region "$_name")
                    [ -n "$_r" ] && echo "${_r} +1"
                done < "$_tmp_added" >> "$_tmp_regions"
            fi

            if [ -s "$_tmp_removed" ]; then
                while IFS= read -r _name; do
                    [ -z "$_name" ] && continue
                    _r=$(detect_region "$_name")
                    [ -n "$_r" ] && echo "${_r} -1"
                done < "$_tmp_removed" >> "$_tmp_regions"
            fi

            # Build region lines with awk
            local _region_lines=""
            if [ -s "$_tmp_regions" ]; then
                _region_lines=$(awk '{
                    split($0, a, " ")
                    r = a[1]; v = a[2] + 0
                    sums[r] += v
                } END {
                    for (r in sums) {
                        v = sums[r]
                        if (v > 0) printf "%s +%d\n", r, v
                        else if (v < 0) printf "%s %d\n", r, v
                    }
                }' "$_tmp_regions")
            fi

            # Build notification using awk (avoids subshell issues)
            local _ts
            _ts=$(date '+%Y-%m-%d %H:%M')

            _msg=$(awk -v added="$_added_count" -v removed="$_removed_count" \
                -v old_total="$_old_total" -v new_total="$_current_total" \
                -v ts="$_ts" \
                -v regions="$_region_lines" \
                'BEGIN {
                    printf "🚀 *OpenClash*\n\n订阅配置更新\n\n📅 %s\n\n📊 *变更摘要*\n\n➕ 新增: %s\n➖ 移除: %s", ts, added, removed
                    if (regions != "") {
                        printf "\n\n🌎 *地区变更*\n"
                        n = split(regions, lines, "\n")
                        for (i = 1; i <= n; i++) {
                            split(lines[i], parts, " ")
                            code = parts[1]; delta = parts[2]
                            emoji = ""
                            if (code == "HK") emoji = "🇭🇰"
                            else if (code == "TW") emoji = "🇨🇳"
                            else if (code == "JP") emoji = "🇯🇵"
                            else if (code == "SG") emoji = "🇸🇬"
                            else if (code == "US") emoji = "🇺🇸"
                            else if (code == "KR") emoji = "🇰🇷"
                            else if (code == "DE") emoji = "🇩🇪"
                            else if (code == "FR") emoji = "🇫🇷"
                            else if (code == "UK") emoji = "🇬🇧"
                            else if (code == "NL") emoji = "🇳🇱"
                            else if (code == "IN") emoji = "🇮🇳"
                            else if (code == "CL") emoji = "🇨🇱"
                            else if (code == "BR") emoji = "🇧🇷"
                            else if (code == "ES") emoji = "🇪🇸"
                            else if (code == "CH") emoji = "🇨🇭"
                            else if (code == "SE") emoji = "🇸🇪"
                            else if (code == "MX") emoji = "🇲🇽"
                            else if (code == "CA") emoji = "🇨🇦"
                            else if (code == "AU") emoji = "🇦🇺"
                            else if (code == "RU") emoji = "🇷🇺"
                            else if (code == "TR") emoji = "🇹🇷"
                            else if (code == "AR") emoji = "🇦🇷"
                            else if (code == "IT") emoji = "🇮🇹"
                            else emoji = code
                            printf "\n%s %s %s", emoji, code, delta
                        }
                    }
                    printf "\n\n📦 *总节点*\n\n%s → %s", old_total, new_total
                }')

            eventcenter emit openclash config_change info \
                "订阅配置更新" \
                "$_msg"
        fi
    fi

    # Update state file
    local _tmp_state="${_state_file}.tmp"
    : > "$_tmp_state"

    local _names_csv
    _names_csv=$(awk '{printf "%s%s", (NR>1?",":""), $0}' "$_tmp_current")
    printf 'nodes:%s\n' "$_names_csv" >> "$_tmp_state"

    # Atomic replace
    mkdir -p "$(dirname "$_state_file")" 2>/dev/null
    mv "$_tmp_state" "$_state_file" 2>/dev/null

    # Cleanup temp files
    rm -f "$_tmp_providers" "$_tmp_current" "$_tmp_old" "$_tmp_added" "$_tmp_removed" "$_tmp_regions"

    return 0
}
