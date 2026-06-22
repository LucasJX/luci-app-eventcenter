'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require dom';
'require uci';

return view.extend({
	load: function() {
		return uci.load('eventcenter');
	},

	render: function() {
		var logPath = uci.get('eventcenter', 'global', 'log_path') || '/tmp/eventcenter.log';
		var PAGE_SIZE = 50;
		var currentPage = 1;
		var allEntries = [];

		var container = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, '事件中心 - 事件日志'),
			E('div', { 'class': 'panel cbi-section', 'style': 'display:flex;justify-content:space-between;align-items:center;padding:10px 15px' }, [
				E('span', {}, [
					E('strong', {}, '日志文件: '),
					E('code', {}, logPath)
				]),
				E('div', { 'style': 'display:flex;gap:8px' }, [
					E('button', {
						'class': 'btn cbi-button-action',
						'click': function() { refreshLogs(); }
					}, '刷新'),
					E('button', {
						'class': 'btn cbi-button-remove',
						'click': function() {
							if (confirm('确认清空所有日志? 此操作不可撤销。')) {
								fs.write(logPath, '').then(function() { refreshLogs(); });
							}
						}
					}, '清空日志')
				])
			]),
			E('div', { 'id': 'log-content' }, [
				E('p', { 'style': 'text-align:center;padding:20px;color:#888' }, '加载中...')
			])
		]);

		function parseLog(raw) {
			var lines = raw.trim().split('\n').filter(function(l) { return l.length > 0 && l.indexOf('|') > -1; });
			var entries = [];
			for (var i = 0; i < lines.length; i++) {
				var parts = lines[i].split('|');
				if (parts.length >= 6) {
					entries.push({
						time: parts[0],
						source: parts[1],
						event: parts[2],
						level: parts[3],
						title: parts[4],
						message: parts[5]
					});
				}
			}
			return entries;
		}

		function renderPage(entries, page) {
			var totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
			if (page > totalPages) page = totalPages;
			if (page < 1) page = 1;

			var start = (page - 1) * PAGE_SIZE;
			var pageEntries = entries.slice(start, start + PAGE_SIZE);

			var rows = [];
			if (pageEntries.length === 0) {
				rows.push(E('tr', {}, E('td', { 'colspan': '6', 'style': 'text-align:center;padding:30px;color:#888' }, '暂无日志记录')));
			} else {
				pageEntries.forEach(function(entry) {
					var levelColor = { info: '#17a2b8', warn: '#ffc107', error: '#dc3545', critical: '#6f1207' };
					var levelBg = { info: '#d1ecf1', warn: '#fff3cd', error: '#f8d7da', critical: '#f8d7da' };
					rows.push(E('tr', {}, [
						E('td', { 'style': 'white-space:nowrap;font-size:0.9em' }, entry.time),
						E('td', {}, E('span', { 'class': 'label', 'style': 'background:#007bff;color:#fff;padding:1px 6px;border-radius:3px;font-size:0.85em' }, entry.source)),
						E('td', {}, entry.event),
						E('td', {}, E('span', {
							'style': 'padding:2px 8px;border-radius:3px;font-size:0.85em;font-weight:bold;color:' + (levelColor[entry.level] || '#333') + ';background:' + (levelBg[entry.level] || '#eee')
						}, entry.level)),
						E('td', { 'style': 'font-weight:500' }, entry.title),
						E('td', { 'style': 'max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', 'title': entry.message }, entry.message)
					]));
				});
			}

			// Pagination
			var pagination = E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;padding:10px 15px;border-top:1px solid #eee' }, [
				E('span', {}, '显示 %d - %d / 共 %d 条'.format(start + 1, Math.min(start + PAGE_SIZE, entries.length), entries.length)),
				E('div', { 'style': 'display:flex;gap:5px' }, [
					E('button', {
						'class': 'btn',
						'disabled': page <= 1 ? 'disabled' : null,
						'click': function() { currentPage--; updateContent(); }
					}, '« 上一页'),
					E('span', { 'style': 'padding:4px 12px;background:#f5f5f5;border-radius:3px' }, '第 %d / %d 页'.format(page, totalPages)),
					E('button', {
						'class': 'btn',
						'disabled': page >= totalPages ? 'disabled' : null,
						'click': function() { currentPage++; updateContent(); }
					}, '下一页 »')
				])
			]);

			return E('div', {}, [
				E('table', { 'class': 'table' }, [
					E('thead', {}, E('tr', {}, [
						E('th', { 'style': 'width:160px' }, '时间'),
						E('th', { 'style': 'width:100px' }, '来源'),
						E('th', { 'style': 'width:140px' }, '事件'),
						E('th', { 'style': 'width:80px' }, '级别'),
						E('th', { 'style': 'width:180px' }, '标题'),
						E('th', {}, '消息')
					])),
					E('tbody', {}, rows)
				]),
				pagination
			]);
		}

		function updateContent() {
			var content = container.querySelector('#log-content');
			if (content) {
				dom.content(content, renderPage(allEntries, currentPage));
			}
		}

		function refreshLogs() {
			var content = container.querySelector('#log-content');
			if (content) {
				dom.content(content, E('p', { 'style': 'text-align:center;padding:20px;color:#888' }, '加载中...'));
			}
			L.resolveDefault(fs.read(logPath), '').then(function(raw) {
				allEntries = parseLog(typeof raw === 'string' ? raw : '');
				// Show newest first
				allEntries.reverse();
				currentPage = 1;
				updateContent();
			}).catch(function() {
				allEntries = [];
				updateContent();
			});
		}

		// Initial load
		refreshLogs();

		// Auto-refresh every 30 seconds
		poll.add(function() {
			L.resolveDefault(fs.read(logPath), '').then(function(raw) {
				var newEntries = parseLog(typeof raw === 'string' ? raw : '');
				newEntries.reverse();
				// Only update if data changed
				if (newEntries.length !== allEntries.length ||
					(newEntries.length > 0 && allEntries.length > 0 && newEntries[0].time !== allEntries[0].time)) {
					allEntries = newEntries;
					updateContent();
				}
			});
		}, 30);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
