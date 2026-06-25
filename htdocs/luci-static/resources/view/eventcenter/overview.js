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
			L.resolveDefault(fs.exec('eventcenter', ['status']), { stdout: '' }),
			L.resolveDefault(fs.exec('eventcenter', ['list', '--limit', '10']), { stdout: '' }),
			L.resolveDefault(fs.exec('/usr/share/eventcenter/sources/system-health.sh', ['status']), { stdout: '' })
		]);
	},

	render: function(data) {
		var uciData = data[0];
		var statusOutput = (data[1] && data[1].stdout) ? data[1].stdout.trim() : '';
		var logOutput = (data[2] && data[2].stdout) ? data[2].stdout.trim() : '';
		var sysHealthOutput = (data[3] && data[3].stdout) ? data[3].stdout.trim() : '';

		var enabled = uci.get('eventcenter', 'global', 'enable') === '1';
		var tgEnabled = uci.get('eventcenter', 'telegram', 'enable') === '1';
		var tgToken = uci.get('eventcenter', 'telegram', 'token') || '';
		var tgChatId = uci.get('eventcenter', 'telegram', 'chatid') || '';
		var ocEnabled = uci.get('eventcenter', 'openclash', 'enable') === '1';

		var tgConfigured = tgToken.length > 0 && tgChatId.length > 0;
		var sysHealthEnabled = uci.get('eventcenter', 'system_health', 'enable') === '1';

		// Parse system health metrics
		var sysMetrics = {};
		if (sysHealthOutput) {
			var lines = sysHealthOutput.split('\n');
			lines.forEach(function(line) {
				var match;
				if ((match = line.match(/^CPU:\s+(\d+)%/))) sysMetrics.cpu = parseInt(match[1]);
				if ((match = line.match(/^Memory:\s+(\d+)%\s+\((\d+)MB\s*\/\s*(\d+)MB/))) {
					sysMetrics.mem = parseInt(match[1]);
					sysMetrics.memUsed = parseInt(match[2]);
					sysMetrics.memTotal = parseInt(match[3]);
				}
				if ((match = line.match(/^Temperature:\s+(\d+)°C/))) sysMetrics.temp = parseInt(match[1]);
				if ((match = line.match(/^Load Avg:\s+(.*)/))) sysMetrics.load = match[1].trim();
			});
		}

		// Parse log entries
		var logLines = logOutput.split('\n').filter(function(l) { return l.length > 0 && l.indexOf('|') > -1; });
		var logEntries = [];
		for (var i = logLines.length - 1; i >= 0 && logEntries.length < 10; i--) {
			var parts = logLines[i].split('|');
			if (parts.length >= 6) {
				logEntries.push({
					time: parts[0],
					source: parts[1],
					event: parts[2],
					level: parts[3],
					title: parts[4],
					message: parts[5]
				});
			}
		}

		// Status card
		var statusCard = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '服务状态'),
			E('table', { 'class': 'table' }, [
				E('tr', {}, [
					E('td', { 'style': 'width:200px;font-weight:bold' }, '服务'),
					E('td', {}, [
						E('span', {
							'class': 'label',
							'style': 'padding:3px 10px;border-radius:3px;color:#fff;background:' + (enabled ? '#28a745' : '#dc3545')
						}, enabled ? '运行中' : '已停止')
					])
				]),
				E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, 'Telegram 通知'),
					E('td', {}, [
						E('span', {
							'class': 'label',
							'style': 'padding:3px 10px;border-radius:3px;color:#fff;background:' + (tgEnabled && tgConfigured ? '#28a745' : tgEnabled ? '#ffc107' : '#6c757d')
						}, tgEnabled && tgConfigured ? '已配置' : tgEnabled ? '已启用(未配置Token)' : '已禁用')
					])
				]),
				E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, 'OpenClash 监控'),
					E('td', {}, [
						E('span', {
							'class': 'label',
							'style': 'padding:3px 10px;border-radius:3px;color:#fff;background:' + (ocEnabled ? '#28a745' : '#6c757d')
						}, ocEnabled ? '已启用' : '已禁用')
					])
				]),
				E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, '系统健康监控'),
					E('td', {}, [
						E('span', {
							'class': 'label',
							'style': 'padding:3px 10px;border-radius:3px;color:#fff;background:' + (sysHealthEnabled ? '#28a745' : '#6c757d')
						}, sysHealthEnabled ? '已启用' : '已禁用')
					])
				])
			])
		]);

		// System health metrics card
		var sysHealthCard = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '系统状态'),
			E('table', { 'class': 'table' }, [
				E('tr', {}, [
					E('td', { 'style': 'width:200px;font-weight:bold' }, 'CPU 使用率'),
					E('td', {}, [
						E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
							E('div', { 'style': 'flex:1;background:#e9ecef;border-radius:4px;height:20px;overflow:hidden' }, [
								E('div', { 'style': 'width:' + (sysMetrics.cpu || 0) + '%;height:100%;background:' + ((sysMetrics.cpu || 0) > 80 ? '#dc3545' : (sysMetrics.cpu || 0) > 60 ? '#ffc107' : '#28a745') + ';transition:width 0.3s' })
							]),
							E('span', { 'style': 'font-weight:bold;min-width:40px' }, (sysMetrics.cpu || 0) + '%')
						])
					])
				]),
				E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, '内存使用率'),
					E('td', {}, [
						E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
							E('div', { 'style': 'flex:1;background:#e9ecef;border-radius:4px;height:20px;overflow:hidden' }, [
								E('div', { 'style': 'width:' + (sysMetrics.mem || 0) + '%;height:100%;background:' + ((sysMetrics.mem || 0) > 85 ? '#dc3545' : (sysMetrics.mem || 0) > 70 ? '#ffc107' : '#28a745') + ';transition:width 0.3s' })
							]),
							E('span', { 'style': 'font-weight:bold;min-width:80px' }, (sysMetrics.mem || 0) + '% (' + (sysMetrics.memUsed || 0) + 'MB/' + (sysMetrics.memTotal || 0) + 'MB)')
						])
					])
				]),
				sysMetrics.temp !== undefined ? E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, '温度'),
					E('td', {}, [
						E('span', { 'style': 'font-weight:bold;color:' + ((sysMetrics.temp || 0) > 75 ? '#dc3545' : (sysMetrics.temp || 0) > 60 ? '#ffc107' : '#28a745') }, (sysMetrics.temp || 0) + '°C')
					])
				]) : E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, '温度'),
					E('td', { 'style': 'color:#888' }, '传感器不可用')
				]),
				E('tr', {}, [
					E('td', { 'style': 'font-weight:bold' }, '系统负载'),
					E('td', {}, sysMetrics.load || 'N/A')
				])
			])
		]);

		// Quick actions
		var quickActions = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '快捷操作'),
			E('div', { 'style': 'display:flex;gap:10px;padding:10px' }, [
				E('button', {
					'class': 'btn cbi-button-action',
					'click': function() {
						var btn = this;
						btn.disabled = true;
						btn.textContent = '发送中...';
						fs.exec('eventcenter', ['test']).then(function() {
							btn.textContent = '测试已发送!';
							setTimeout(function() { btn.textContent = '测试通知'; btn.disabled = false; }, 2000);
						}).catch(function() {
							btn.textContent = '失败';
							setTimeout(function() { btn.textContent = '测试通知'; btn.disabled = false; }, 2000);
						});
					}
				}, '测试通知'),
				E('button', {
					'class': 'btn cbi-button-action',
					'click': function() {
						var btn = this;
						btn.disabled = true;
						btn.textContent = '检查中...';
						fs.exec('eventcenter', ['check', 'openclash']).then(function() {
							btn.textContent = '检查完成!';
							setTimeout(function() { btn.textContent = '运行 OpenClash 检查'; btn.disabled = false; }, 2000);
						}).catch(function() {
							btn.textContent = '失败';
							setTimeout(function() { btn.textContent = '运行 OpenClash 检查'; btn.disabled = false; }, 2000);
						});
					}
				}, '运行 OpenClash 检查')
			])
		]);

		// Recent events table
		var rows = [];
		if (logEntries.length === 0) {
			rows.push(E('tr', {}, E('td', { 'colspan': '5', 'style': 'text-align:center;padding:20px;color:#888' }, '暂无事件记录')));
		} else {
			logEntries.forEach(function(entry) {
				var levelColor = { info: '#17a2b8', warn: '#ffc107', error: '#dc3545', critical: '#dc3545' };
				rows.push(E('tr', {}, [
					E('td', {}, entry.time),
					E('td', {}, E('span', { 'class': 'label', 'style': 'background:#007bff;color:#fff;padding:1px 6px;border-radius:3px;font-size:0.85em' }, entry.source)),
					E('td', {}, entry.event),
					E('td', {}, E('span', { 'style': 'color:' + (levelColor[entry.level] || '#333') + ';font-weight:bold' }, entry.level)),
					E('td', { 'style': 'max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', 'title': entry.message }, entry.title)
				]));
			});
		}

		var recentEvents = E('div', { 'class': 'panel cbi-section' }, [
			E('h3', {}, '最近事件 (最近10条)'),
			E('table', { 'class': 'table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', {}, '时间'),
					E('th', {}, '来源'),
					E('th', {}, '事件'),
					E('th', {}, '级别'),
					E('th', {}, '标题')
				])),
				E('tbody', {}, rows)
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, '事件中心 - 概览'),
			statusCard,
			sysHealthCard,
			quickActions,
			recentEvents
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
