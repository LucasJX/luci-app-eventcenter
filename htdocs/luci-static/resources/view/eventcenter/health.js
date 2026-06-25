'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require dom';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('eventcenter'),
			L.resolveDefault(fs.exec('cat', ['/tmp/eventcenter_node_state']), { stdout: '' }),
			L.resolveDefault(fs.exec('cat', ['/etc/eventcenter/failed_nodes']), { stdout: '' }),
			L.resolveDefault(fs.exec('tail', ['-30', '/etc/eventcenter/latency_history']), { stdout: '' }),
			L.resolveDefault(fs.exec('cat', ['/tmp/eventcenter.log']), { stdout: '' })
		]);
	},

	render: function(data) {
		var healthEnabled = uci.get('eventcenter', 'health', 'enable') === '1';
		var stateOutput = (data[1] && data[1].stdout) ? data[1].stdout.trim() : '';
		var failedOutput = (data[2] && data[2].stdout) ? data[2].stdout.trim() : '';
		var latencyOutput = (data[3] && data[3].stdout) ? data[3].stdout.trim() : '';
		var logOutput = (data[4] && data[4].stdout) ? data[4].stdout.trim() : '';

		// Parse state file: group\tnode
		var stateLines = stateOutput.split('\n').filter(function(l) { return l.length > 0; });
		var stateEntries = stateLines.map(function(line) {
			var parts = line.split('\t');
			return { group: parts[0] || '', node: parts[1] || '' };
		});

		// Parse failed file: group\tnode
		var failedLines = failedOutput.split('\n').filter(function(l) { return l.length > 0; });
		var failedEntries = failedLines.map(function(line) {
			var parts = line.split('\t');
			return { group: parts[0] || '', node: parts[1] || '' };
		});

		// Parse latency history: time	group	node	delay
		var latencyLines = latencyOutput.split('\n').filter(function(l) { return l.length > 0; });
		var latencyEntries = [];
		var latencyByGroup = {};
		for (var i = latencyLines.length - 1; i >= 0 && latencyEntries.length < 50; i--) {
			var parts = latencyLines[i].split('	');
			if (parts.length >= 4) {
				latencyEntries.push({
					time: parts[0],
					group: parts[1],
					node: parts[2],
					delay: parts[3]
				});

				// Group by proxy group for chart
				if (!latencyByGroup[parts[1]]) {
					latencyByGroup[parts[1]] = [];
				}
				latencyByGroup[parts[1]].push({
					time: parts[0],
					delay: parseInt(parts[3], 10)
				});
			}
		}

		// Parse log for recent failover/recovery events
		var logLines = logOutput.split('\n').filter(function(l) { return l.length > 0 && l.indexOf('|') > -1; });
		var healthEvents = [];
		for (var j = logLines.length - 1; j >= 0 && healthEvents.length < 10; j--) {
			var p = logLines[j].split('|');
			if (p.length >= 6 && (p[2] === 'node_failover' || p[2] === 'node_recovery')) {
				healthEvents.push({
					time: p[0],
					event: p[2],
					level: p[3],
					title: p[4]
				});
			}
		}

		// Status card
		var statusCard = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '节点健康监测状态'),
			E('table', { 'class': 'table' }, [
				E('tr', {}, [
					E('td', { 'style': 'width:200px;font-weight:bold' }, '监测服务'),
					E('td', {}, [
						E('span', {
							'class': 'label',
							'style': 'padding:3px 10px;border-radius:3px;color:#fff;background:' + (healthEnabled ? '#28a745' : '#6c757d')
						}, healthEnabled ? '运行中' : '已禁用')
					])
				]),
				E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, '监控组数'),
					E('td', {}, '' + stateEntries.length + ' 个 url-test 组')
				]),
				E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, '故障节点'),
					E('td', {}, [
						E('span', {
							'style': 'color:' + (failedEntries.length > 0 ? '#dc3545' : '#28a745') + ';font-weight:bold'
						}, failedEntries.length > 0 ? failedEntries.length + ' 个' : '无')
					])
				])
			])
		]);

		// Current node selections table
		var stateRows = [];
		if (stateEntries.length === 0) {
			stateRows.push(E('tr', {}, E('td', { 'colspan': '2', 'style': 'text-align:center;padding:20px;color:#888' }, '暂无数据（启用监测后自动采集）')));
		} else {
			stateEntries.forEach(function(entry) {
				var isFailed = failedEntries.some(function(f) { return f.group === entry.group; });
				stateRows.push(E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, entry.group),
					E('td', {}, [
						E('span', { 'style': isFailed ? 'color:#dc3545' : '' }, entry.node),
						isFailed ? E('span', { 'style': 'margin-left:8px;color:#dc3545;font-size:0.85em' }, '⚠ 故障中') : ''
					])
				]));
			});
		}

		var stateTable = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '当前节点选择'),
			E('table', { 'class': 'table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', { 'style': 'width:200px' }, '代理组'),
					E('th', {}, '当前节点')
				])),
				E('tbody', {}, stateRows)
			])
		]);

		// Latency history table
		var latencyRows = [];
		if (latencyEntries.length === 0) {
			latencyRows.push(E('tr', {}, E('td', { 'colspan': '4', 'style': 'text-align:center;padding:20px;color:#888' }, '暂无延迟记录')));
		} else {
			latencyEntries.forEach(function(entry) {
				var delayNum = parseInt(entry.delay, 10);
				var delayColor = delayNum < 500 ? '#28a745' : delayNum < 1000 ? '#ffc107' : '#dc3545';
				latencyRows.push(E('tr', {}, [
					E('td', {}, entry.time),
					E('td', {}, entry.group),
					E('td', { 'style': 'max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, entry.node),
					E('td', { 'style': 'color:' + delayColor + ';font-weight:bold' }, entry.delay + ' ms')
				]));
			});
		}

		var latencyTable = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '延迟记录 (最近20条)'),
			E('table', { 'class': 'table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', {}, '时间'),
					E('th', {}, '代理组'),
					E('th', {}, '节点'),
					E('th', {}, '延迟')
				])),
				E('tbody', {}, latencyRows)
			])
		]);

		// Latency trend chart (simple CSS-based visualization)
		var trendCharts = [];
		var groupNames = Object.keys(latencyByGroup);
		if (groupNames.length > 0) {
			groupNames.forEach(function(group) {
				var data = latencyByGroup[group].reverse(); // chronological order
				if (data.length < 2) return;

				// Calculate stats
				var delays = data.map(function(d) { return d.delay; });
				var minDelay = Math.min.apply(null, delays);
				var maxDelay = Math.max.apply(null, delays);
				var avgDelay = Math.round(delays.reduce(function(a, b) { return a + b; }, 0) / delays.length);

				// Normalize delays to 0-100% for visualization
				var range = maxDelay - minDelay || 1;
				var bars = data.map(function(d) {
					var height = Math.round(((d.delay - minDelay) / range) * 80) + 20; // 20-100%
					var color = d.delay < 500 ? '#28a745' : d.delay < 1000 ? '#ffc107' : '#dc3545';
					var time = d.time.split(' ')[1] || d.time; // Show HH:MM:SS
					return E('div', {
						'style': 'display:flex;flex-direction:column;align-items:center;flex:1;min-width:20px'
					}, [
						E('div', {
							'style': 'font-size:0.7em;color:#888;margin-bottom:2px'
						}, d.delay + 'ms'),
						E('div', {
							'style': 'width:80%;height:' + height + 'px;background:' + color + ';border-radius:3px 3px 0 0;transition:height 0.3s'
						}),
						E('div', {
							'style': 'font-size:0.6em;color:#aaa;margin-top:2px;transform:rotate(-45deg);white-space:nowrap'
						}, time.substring(0, 5))
					]);
				});

				var chart = E('div', { 'class': 'panel cbi-section' }, [
					E('h3', {}, '延迟趋势: ' + group),
					E('div', { 'style': 'display:flex;gap:8px;margin-bottom:10px;padding:0 10px' }, [
						E('span', { 'style': 'color:#28a745' }, '● <500ms'),
						E('span', { 'style': 'color:#ffc107' }, '● 500-1000ms'),
						E('span', { 'style': 'color:#dc3545' }, '● >1000ms')
					]),
					E('div', { 'style': 'display:flex;gap:4px;align-items:flex-end;height:120px;padding:10px;overflow-x:auto' }, bars),
					E('div', { 'style': 'display:flex;justify-content:space-around;padding:10px;background:#f8f9fa;border-radius:0 0 4px 4px' }, [
						E('span', {}, '最低: ' + minDelay + 'ms'),
						E('span', {}, '平均: ' + avgDelay + 'ms'),
						E('span', {}, '最高: ' + maxDelay + 'ms')
					])
				]);
				trendCharts.push(chart);
			});
		}

		var trendSection = E('div', {}, trendCharts.length > 0 ? trendCharts : [
			E('div', { 'class': 'panel cbi-section' }, [
				E('h3', {}, '延迟趋势'),
				E('div', { 'style': 'text-align:center;padding:30px;color:#888' }, '暂无足够数据生成趋势图（需要至少2个数据点）')
			])
		]);

		// Recent health events
		var eventRows = [];
		if (healthEvents.length === 0) {
			eventRows.push(E('tr', {}, E('td', { 'colspan': '3', 'style': 'text-align:center;padding:20px;color:#888' }, '暂无切换事件')));
		} else {
			healthEvents.forEach(function(entry) {
				var isRecovery = entry.event === 'node_recovery';
				eventRows.push(E('tr', {}, [
					E('td', {}, entry.time),
					E('td', {}, [
						E('span', {
							'class': 'label',
							'style': 'padding:2px 8px;border-radius:3px;color:#fff;background:' + (isRecovery ? '#28a745' : '#dc3545')
						}, isRecovery ? '💚 恢复' : '🚨 故障')
					]),
					E('td', {}, entry.title)
				]));
			});
		}

		var eventTable = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '最近切换事件'),
			E('table', { 'class': 'table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', {}, '时间'),
					E('th', {}, '类型'),
					E('th', {}, '标题')
				])),
				E('tbody', {}, eventRows)
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, '节点健康监测'),
			statusCard,
			stateTable,
			latencyTable,
			trendSection,
			eventTable
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
