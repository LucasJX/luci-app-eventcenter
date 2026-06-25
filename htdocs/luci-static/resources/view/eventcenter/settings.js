'use strict';
'require view';
'require form';
'require fs';
'require uci';

/* ── 卡片样式注入 ── */
var CARD_CSS = [
	'.cbi-map { padding:0 !important }',
	'.cbi-map > h2 { margin-bottom:4px }',
	'.cbi-map > .cbi-map-descr { color:#666;font-size:0.9em;margin-bottom:20px }',
	'.cbi-section { background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px;border-top:3px solid #6b7280 }',
	'.cbi-section > h3 { border-bottom:1px solid #eee;padding-bottom:12px;margin:-20px -20px 16px -20px;padding:16px 20px 12px;font-size:1.05em;font-weight:700 }',
	'.cbi-value { margin-bottom:10px }',
	'.cbi-value > .cbi-value-title { font-weight:600;font-size:0.85em;color:#555;margin-bottom:4px }',
	'.cbi-value input[type=text], .cbi-value input[type=password], .cbi-value textarea, .cbi-value select { border:1px solid #ddd;border-radius:6px;padding:8px 10px }',
	'.cbi-value input:focus, .cbi-value select:focus { border-color:#3b82f6;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,0.15) }',
	'.cbi-value .cbi-input-description { font-size:0.75em;color:#888;margin-top:4px }',
	'.cbi-section .cbi-section-table-row { background:#fff;border:1px solid #eee;border-radius:8px;padding:12px;margin-bottom:8px }',
	'.cbi-button-action { background:#f0f0f0;color:#333;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-weight:600 }',
	'.cbi-button-action:hover { background:#e5e7eb }',
	'.cbi-button-save, .cbi-button-apply { border-radius:8px !important;padding:10px 24px !important;font-weight:600 !important }'
].join('\n');

/* 卡片颜色映射 */
var sectionColors = {
	'全局设置': '#6b7280',
	'Telegram': '#0088cc',
	'企业微信': '#07c160',
	'Bark': '#f59e0b',
	'Server酱 Turbo': '#ef4444',
	'Server酱³': '#8b5cf6',
	'ntfy': '#2563eb',
	'PushPlus': '#06b6d4',
	'OpenClash': '#ea580c',
	'节点故障转移': '#dc2626'
};

function applyCardStyles(mapEl) {
	/* 注入 CSS */
	if (!document.getElementById('ec-card-css')) {
		var style = document.createElement('style');
		style.id = 'ec-card-css';
		style.textContent = CARD_CSS;
		document.head.appendChild(style);
	}

	/* 给每个 section 加颜色 */
	var sections = mapEl.querySelectorAll('.cbi-section');
	sections.forEach(function(sec) {
		var h3 = sec.querySelector('h3');
		if (h3) {
			var title = h3.textContent;
			for (var keyword in sectionColors) {
				if (title.indexOf(keyword) > -1) {
					sec.style.borderTopColor = sectionColors[keyword];
					break;
				}
			}
		}
	});
}

return view.extend({

	load: function() {
		return Promise.all([
			uci.load('eventcenter')
		]);
	},

	render: function() {
		var m, s, o;

		// --- Main Map ---
		m = new form.Map('eventcenter', '事件中心',
			'配置事件中心监控和通知系统。');

		// --- Global Settings ---
		s = m.section(form.NamedSection, 'global', 'eventcenter', '全局设置');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用或禁用事件中心服务');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'log_path', '日志路径',
			'事件日志文件路径');
		o.default = '/tmp/eventcenter.log';
		o.rmempty = false;

		o = s.option(form.Value, 'log_max_lines', '最大日志行数',
			'超过此行数将自动截断旧日志');
		o.default = '1000';
		o.datatype = 'uinteger';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_ttl', '去重时间窗口(秒)',
			'在此时间窗口内相同事件只通知一次');
		o.default = '300';
		o.datatype = 'uinteger';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_path', '去重缓存路径',
			'去重缓存文件路径');
		o.default = '/tmp/eventcenter_dedup';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_max', '去重最大条目数',
			'去重缓存最大条目数');
		o.default = '500';
		o.datatype = 'uinteger';
		o.rmempty = false;

		// ============================================================
		//  Telegram Notifier
		// ============================================================
		s = m.section(form.NamedSection, 'telegram', 'notifier', 'Telegram 通知');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 Telegram 通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'token', 'Bot Token',
			'Telegram Bot API Token (从 @BotFather 获取)');
		o.password = true;
		o.rmempty = true;

		o = s.option(form.Value, 'chatid', 'Chat ID',
			'Telegram 聊天 ID，消息将发送到此对话');
		o.rmempty = true;

		o = s.option(form.ListValue, 'parse_mode', '解析模式',
			'消息格式化模式');
		o.value('Markdown', 'Markdown');
		o.value('HTML', 'HTML');
		o.default = 'Markdown';
		o.rmempty = false;

		o = s.option(form.Button, '_test_telegram', '测试 Telegram',
			'发送测试通知以验证配置');
		o.inputtitle = '发送测试';
		o.inputstyle = 'action';
		o.onclick = function() {
			var btn = this;
			btn.textContent = '发送中...';
			btn.disabled = true;
			fs.exec('eventcenter', ['test']).then(function(res) {
				btn.textContent = (res && res.code !== 0) ? '发送失败' : '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// ============================================================
		//  WeChat Work Notifier (企业微信)
		// ============================================================
		s = m.section(form.NamedSection, 'wechat', 'notifier', '企业微信通知');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用企业微信 Webhook 通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'webhook', 'Webhook URL',
			'企业微信群机器人 Webhook 地址');
		o.rmempty = true;

		o = s.option(form.Value, 'mention', '@成员',
			'需要 @ 的成员 Userid，多个用 | 分隔');
		o.rmempty = true;
		o.placeholder = 'zhangsan|lisi';

		o = s.option(form.Button, '_test_wechat', '测试企业微信',
			'发送测试通知');
		o.inputtitle = '发送测试';
		o.inputstyle = 'action';
		o.onclick = function() {
			var btn = this;
			btn.textContent = '发送中...';
			btn.disabled = true;
			fs.exec('notifier_wechat.sh', ['企业微信测试消息 - Event Center']).then(function(res) {
				btn.textContent = (res && res.code !== 0) ? '发送失败' : '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// ============================================================
		//  Bark Notifier (iOS Push)
		// ============================================================
		s = m.section(form.NamedSection, 'bark', 'notifier', 'Bark 推送 (iOS)');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 Bark 推送通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'server', '服务器地址',
			'Bark 服务端地址。自建服务填你自己的地址');
		o.default = 'https://api.day.app';
		o.rmempty = false;

		o = s.option(form.Value, 'device_key', 'Device Key',
			'Bark App 中的设备 Key');
		o.rmempty = true;

		o = s.option(form.ListValue, 'sound', '推送铃声',
			'推送时的铃声');
		o.value('minuet', 'minuet (默认)');
		o.value('healthnote', 'healthnote');
		o.value('alarm', 'alarm');
		o.value('antic', 'antic');
		o.value('bell', 'bell');
		o.value('birdsong', 'birdsong');
		o.value('bubble', 'bubble');
		o.value('calypso', 'calypso');
		o.value('chime', 'chime');
		o.value('shake', 'shake');
		o.default = 'minuet';
		o.rmempty = false;

		o = s.option(form.Value, 'group', '消息分组',
			'Bark 中的消息分组名');
		o.default = 'EventCenter';
		o.rmempty = false;

		o = s.option(form.Button, '_test_bark', '测试 Bark',
			'发送测试通知');
		o.inputtitle = '发送测试';
		o.inputstyle = 'action';
		o.onclick = function() {
			var btn = this;
			btn.textContent = '发送中...';
			btn.disabled = true;
			fs.exec('notifier_bark.sh', ['Bark 测试消息 - Event Center']).then(function(res) {
				btn.textContent = (res && res.code !== 0) ? '发送失败' : '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// ============================================================
		//  Server酱 Turbo Notifier
		// ============================================================
		s = m.section(form.NamedSection, 'serverchan', 'notifier', 'Server酱 Turbo');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 Server酱 推送 (sct.ftqq.com)');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'sendkey', 'SendKey',
			'Server酱 Turbo 的 SendKey (在 sct.ftqq.com 获取)');
		o.password = true;
		o.rmempty = true;

		o = s.option(form.Button, '_test_serverchan', '测试 Server酱',
			'发送测试通知');
		o.inputtitle = '发送测试';
		o.inputstyle = 'action';
		o.onclick = function() {
			var btn = this;
			btn.textContent = '发送中...';
			btn.disabled = true;
			fs.exec('notifier_serverchan.sh', ['Server酱测试消息 - Event Center']).then(function(res) {
				btn.textContent = (res && res.code !== 0) ? '发送失败' : '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// ============================================================
		//  Server酱³ Notifier (手机APP推送)
		// ============================================================
		s = m.section(form.NamedSection, 'serverchan3', 'notifier', 'Server酱³ (手机APP)');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 Server酱³ 手机APP推送');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'sendkey', 'SendKey',
			'Server酱³ 的 SendKey (在 Server酱³ APP 中获取)');
		o.password = true;
		o.rmempty = true;

		o = s.option(form.Value, 'uid', 'UID',
			'用户 UID，可从 SendKey 自动提取。留空自动提取');
		o.rmempty = true;
		o.placeholder = '自动提取';

		o = s.option(form.Button, '_test_serverchan3', '测试 Server酱³',
			'发送测试通知');
		o.inputtitle = '发送测试';
		o.inputstyle = 'action';
		o.onclick = function() {
			var btn = this;
			btn.textContent = '发送中...';
			btn.disabled = true;
			fs.exec('notifier_serverchan3.sh', ['Server酱³ 测试消息 - Event Center']).then(function(res) {
				btn.textContent = (res && res.code !== 0) ? '发送失败' : '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// ============================================================
		//  ntfy Notifier (自建推送服务)
		// ============================================================
		s = m.section(form.NamedSection, 'ntfy', 'notifier', 'ntfy 推送');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 ntfy 推送通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'url', '服务器地址',
			'ntfy 服务端地址');
		o.default = 'https://ntfy.sh';
		o.rmempty = false;

		o = s.option(form.Value, 'topic', 'Topic',
			'推送主题名称');
		o.rmempty = true;
		o.placeholder = 'my-router-events';

		o = s.option(form.Value, 'token', 'Access Token',
			'ntfy 访问令牌 (优先于用户名密码)');
		o.password = true;
		o.rmempty = true;

		o = s.option(form.Value, 'user', '用户名',
			'HTTP Basic Auth 用户名');
		o.rmempty = true;
		o.depends('token', '');

		o = s.option(form.Value, 'pass', '密码',
			'HTTP Basic Auth 密码');
		o.password = true;
		o.rmempty = true;
		o.depends('token', '');

		o = s.option(form.ListValue, 'priority', '优先级',
			'消息优先级');
		o.value('min', '最低');
		o.value('low', '低');
		o.value('default', '默认');
		o.value('high', '高');
		o.value('urgent', '紧急');
		o.default = 'default';
		o.rmempty = false;

		o = s.option(form.Button, '_test_ntfy', '测试 ntfy',
			'发送测试通知');
		o.inputtitle = '发送测试';
		o.inputstyle = 'action';
		o.onclick = function() {
			var btn = this;
			btn.textContent = '发送中...';
			btn.disabled = true;
			fs.exec('notifier_ntfy.sh', ['ntfy 测试消息 - Event Center']).then(function(res) {
				btn.textContent = (res && res.code !== 0) ? '发送失败' : '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// ============================================================
		//  PushPlus Notifier (微信推送)
		// ============================================================
		s = m.section(form.NamedSection, 'pushplus', 'notifier', 'PushPlus (微信推送)');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 PushPlus 微信推送通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'token', 'Token',
			'PushPlus 推送令牌');
		o.password = true;
		o.rmempty = true;

		o = s.option(form.Value, 'topic', '群组编码',
			'一对多推送时的群组编码，留空为一对一');
		o.rmempty = true;

		o = s.option(form.ListValue, 'template', '消息模板',
			'消息展示模板');
		o.value('markdown', 'Markdown');
		o.value('html', 'HTML');
		o.value('txt', '纯文本');
		o.default = 'markdown';
		o.rmempty = false;

		o = s.option(form.Button, '_test_pushplus', '测试 PushPlus',
			'发送测试通知');
		o.inputtitle = '发送测试';
		o.inputstyle = 'action';
		o.onclick = function() {
			var btn = this;
			btn.textContent = '发送中...';
			btn.disabled = true;
			fs.exec('notifier_pushplus.sh', ['PushPlus 测试消息 - Event Center']).then(function(res) {
				btn.textContent = (res && res.code !== 0) ? '发送失败' : '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// ============================================================
		//  OpenClash Monitor
		// ============================================================
		s = m.section(form.NamedSection, 'openclash', 'monitor', 'OpenClash 订阅监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 OpenClash 订阅配置变更监控');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检查间隔',
			'定期检查订阅变化的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('3', '3 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.value('60', '1 小时');
		o.value('120', '2 小时');
		o.value('360', '6 小时');
		o.value('720', '12 小时');
		o.value('1440', '24 小时');
		o.default = '5';
		o.rmempty = false;

		o = s.option(form.Flag, 'realtime', '实时监听',
			'inotifywait 监听配置目录，变更后立即推送');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'debounce', '防抖延迟',
			'配置变更后等待多久再触发检查');
		o.value('3', '3 秒');
		o.value('5', '5 秒');
		o.value('10', '10 秒');
		o.value('15', '15 秒');
		o.value('30', '30 秒');
		o.value('60', '60 秒');
		o.default = '5';
		o.rmempty = false;
		o.depends('realtime', '1');

		o = s.option(form.Value, 'paths', '配置目录',
			'OpenClash 配置文件路径，逗号分隔');
		o.rmempty = true;
		o.placeholder = '/etc/openclash/config';

		// ============================================================
		//  Node Health Monitor
		// ============================================================
		s = m.section(form.NamedSection, 'health', 'health', '节点故障转移通知');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'监测代理组节点切换，故障转移时发送通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检测间隔',
			'读取 Clash API 检测节点切换的间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('3', '3 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.value('60', '1 小时');
		o.default = '5';
		o.rmempty = false;

		o = s.option(form.ListValue, 'delay_threshold', '延迟阈值',
			'原节点延迟超过此值判定为不可达');
		o.value('1000', '1 秒');
		o.value('2000', '2 秒');
		o.value('3000', '3 秒 (推荐)');
		o.value('5000', '5 秒');
		o.value('10000', '10 秒');
		o.default = '3000';
		o.rmempty = false;

		o = s.option(form.Value, 'test_url', '测试URL',
			'用于检测节点延迟的测试地址');
		o.default = 'http://www.gstatic.com/generate_204';
		o.rmempty = false;

		o = s.option(form.Flag, 'notify_recovery', '恢复通知',
			'节点从故障中恢复时也发送通知');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'monitor_groups', '监控组过滤',
			'只监控指定的代理组，逗号分隔');
		o.rmempty = true;
		o.placeholder = '🇭🇰 香港节点,🇯🇵 日本节点';

		/* 渲染后注入卡片样式 */
		var mapEl = m.render();
		setTimeout(function() { applyCardStyles(mapEl); }, 50);
		return mapEl;
	}
});
