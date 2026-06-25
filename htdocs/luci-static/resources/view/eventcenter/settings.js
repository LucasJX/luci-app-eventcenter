1|'use strict';
2|'require view';
3|'require form';
4|'require fs';
5|'require uci';
6|
7|/* ── 卡片样式注入 ── */
8|var CARD_CSS = [
9|	'.cbi-map { padding:0 !important }',
10|	'.cbi-map > h2 { margin-bottom:4px }',
11|	'.cbi-map > .cbi-map-descr { color:#666;font-size:0.9em;margin-bottom:20px }',
12|	'.cbi-section { background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px;border-top:3px solid #6b7280 }',
13|	'.cbi-section > h3 { border-bottom:1px solid #eee;padding-bottom:12px;margin:-20px -20px 16px -20px;padding:16px 20px 12px;font-size:1.05em;font-weight:700 }',
14|	'.cbi-value { margin-bottom:10px }',
15|	'.cbi-value > .cbi-value-title { font-weight:600;font-size:0.85em;color:#555;margin-bottom:4px }',
16|	'.cbi-value input[type=text], .cbi-value input[type=password], .cbi-value textarea, .cbi-value select { border:1px solid #ddd;border-radius:6px;padding:8px 10px }',
17|	'.cbi-value input:focus, .cbi-value select:focus { border-color:#3b82f6;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,0.15) }',
18|	'.cbi-value .cbi-input-description { font-size:0.75em;color:#888;margin-top:4px }',
19|	'.cbi-section .cbi-section-table-row { background:#fff;border:1px solid #eee;border-radius:8px;padding:12px;margin-bottom:8px }',
20|	'.cbi-button-action { background:#f0f0f0;color:#333;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-weight:600 }',
21|	'.cbi-button-action:hover { background:#e5e7eb }',
22|	'.cbi-button-save, .cbi-button-apply { border-radius:8px !important;padding:10px 24px !important;font-weight:600 !important }'
23|].join('\n');
24|
25|/* 卡片颜色映射 */
26|var sectionColors = {
27|	'全局设置': '#6b7280',
28|	'Telegram': '#0088cc',
29|	'企业微信': '#07c160',
30|	'Bark': '#f59e0b',
31|	'Server酱 Turbo': '#ef4444',
32|	'Server酱³': '#8b5cf6',
33|	'ntfy': '#2563eb',
34|	'PushPlus': '#06b6d4',
35|	'OpenClash': '#ea580c',
36|	'节点故障转移': '#dc2626'
37|};
38|
39|function applyCardStyles(mapEl) {
40|	/* 注入 CSS */
41|	if (!document.getElementById('ec-card-css')) {
42|		var style = document.createElement('style');
43|		style.id = 'ec-card-css';
44|		style.textContent = CARD_CSS;
45|		document.head.appendChild(style);
46|	}
47|
48|	/* 给每个 section 加颜色 */
49|	var sections = mapEl.querySelectorAll('.cbi-section');
50|	sections.forEach(function(sec) {
51|		var h3 = sec.querySelector('h3');
52|		if (h3) {
53|			var title = h3.textContent;
54|			for (var keyword in sectionColors) {
55|				if (title.indexOf(keyword) > -1) {
56|					sec.style.borderTopColor = sectionColors[keyword];
57|					break;
58|				}
59|			}
60|		}
61|	});
62|}
63|
64|return view.extend({
65|
66|	load: function() {
67|		return Promise.all([
68|			uci.load('eventcenter')
69|		]);
70|	},
71|
72|	render: function() {
73|		var m, s, o;
74|
75|		// --- Main Map ---
76|		m = new form.Map('eventcenter', '事件中心',
77|			'配置事件中心监控和通知系统。');
78|
79|		// --- Global Settings ---
80|		s = m.section(form.NamedSection, 'global', 'eventcenter', '全局设置');
81|		s.addremove = false;
82|		s.anonymous = false;
83|
84|		o = s.option(form.Flag, 'enable', '启用',
85|			'启用或禁用事件中心服务');
86|		o.default = '1';
87|		o.rmempty = false;
88|
89|		o = s.option(form.Value, 'log_path', '日志路径',
90|			'事件日志文件路径');
91|		o.default = '/tmp/eventcenter.log';
92|		o.rmempty = false;
93|
94|		o = s.option(form.Value, 'log_max_lines', '最大日志行数',
95|			'超过此行数将自动截断旧日志');
96|		o.default = '1000';
97|		o.datatype = 'uinteger';
98|		o.rmempty = false;
99|
100|		o = s.option(form.Value, 'dedup_ttl', '去重时间窗口(秒)',
101|			'在此时间窗口内相同事件只通知一次');
102|		o.default = '300';
103|		o.datatype = 'uinteger';
104|		o.rmempty = false;
105|
106|		o = s.option(form.Value, 'dedup_path', '去重缓存路径',
107|			'去重缓存文件路径');
108|		o.default = '/tmp/eventcenter_dedup';
109|		o.rmempty = false;
110|
111|		o = s.option(form.Value, 'dedup_max', '去重最大条目数',
112|			'去重缓存最大条目数');
113|		o.default = '500';
114|		o.datatype = 'uinteger';
115|		o.rmempty = false;
116|
442|		// ============================================================
443|		//  OpenClash Monitor
444|		// ============================================================
445|		s = m.section(form.NamedSection, 'openclash', 'monitor', 'OpenClash 订阅监控');
446|		s.addremove = false;
447|		s.anonymous = false;
448|
449|		o = s.option(form.Flag, 'enable', '启用',
450|			'启用 OpenClash 订阅配置变更监控');
451|		o.default = '1';
452|		o.rmempty = false;
453|
454|		o = s.option(form.ListValue, 'interval', '检查间隔',
455|			'定期检查订阅变化的时间间隔');
456|		o.value('1', '1 分钟');
457|		o.value('2', '2 分钟');
458|		o.value('3', '3 分钟');
459|		o.value('5', '5 分钟');
460|		o.value('10', '10 分钟');
461|		o.value('15', '15 分钟');
462|		o.value('30', '30 分钟');
463|		o.value('60', '1 小时');
464|		o.value('120', '2 小时');
465|		o.value('360', '6 小时');
466|		o.value('720', '12 小时');
467|		o.value('1440', '24 小时');
468|		o.default = '5';
469|		o.rmempty = false;
470|
471|		o = s.option(form.Flag, 'realtime', '实时监听',
472|			'inotifywait 监听配置目录，变更后立即推送');
473|		o.default = '1';
474|		o.rmempty = false;
475|
476|		o = s.option(form.ListValue, 'debounce', '防抖延迟',
477|			'配置变更后等待多久再触发检查');
478|		o.value('3', '3 秒');
479|		o.value('5', '5 秒');
480|		o.value('10', '10 秒');
481|		o.value('15', '15 秒');
482|		o.value('30', '30 秒');
483|		o.value('60', '60 秒');
484|		o.default = '5';
485|		o.rmempty = false;
486|		o.depends('realtime', '1');
487|
488|		o = s.option(form.Value, 'paths', '配置目录',
489|			'OpenClash 配置文件路径，逗号分隔');
490|		o.rmempty = true;
491|		o.placeholder = '/etc/openclash/config';
492|
493|		// ============================================================
494|		//  Node Health Monitor
495|		// ============================================================
496|		s = m.section(form.NamedSection, 'health', 'health', '节点故障转移通知');
497|		s.addremove = false;
498|		s.anonymous = false;
499|
500|		o = s.option(form.Flag, 'enable', '启用',
501|