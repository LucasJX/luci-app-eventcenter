'use strict';
'require view';
'require form';
'require fs';
'require uci';

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

		// --- Telegram Notifier ---
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
			fs.exec('eventcenter', ['test']).then(function() {
				btn.textContent = '测试已发送!';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			}).catch(function() {
				btn.textContent = '失败';
				setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
			});
		};

		// --- OpenClash Monitor ---
		s = m.section(form.NamedSection, 'openclash', 'monitor', 'OpenClash 订阅监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 OpenClash 订阅配置变更监控');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'realtime', '实时监听',
			'使用 inotifywait 监听配置目录，订阅更新后立即推送通知（需安装 inotify-tools）');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'debounce', '防抖延迟',
			'配置变更后等待多久再触发检查，防止批量更新重复触发');
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
			'OpenClash 配置文件路径，逗号分隔。留空自动监听 /etc/openclash/config/');
		o.rmempty = true;
		o.placeholder = '/etc/openclash/config';

		// --- Node Health Monitor ---
		s = m.section(form.NamedSection, 'health', 'health', '节点故障转移通知');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'监测代理组节点切换，故障转移时发送 Telegram 通知');
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
			'原节点延迟超过此值判定为不可达（故障转移），低于此值认为是手动切换不通知');
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
			'只监控指定的代理组，逗号分隔。留空监控所有 url-test 组');
		o.rmempty = true;
		o.placeholder = '🇭🇰 香港节点,🇯🇵 日本节点';

		// --- System Health Monitor ---
		s = m.section(form.NamedSection, 'system_health', 'system_health', '系统健康监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'监控 CPU、内存、温度、磁盘使用率，超阈值告警');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检测间隔',
			'系统健康检查的间隔时间');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.default = '2';
		o.rmempty = false;

		o = s.option(form.ListValue, 'cpu_threshold', 'CPU 告警阈值',
			'CPU 使用率超过此值时发送告警');
		o.value('50', '50%');
		o.value('60', '60%');
		o.value('70', '70%');
		o.value('80', '80% (推荐)');
		o.value('90', '90%');
		o.value('95', '95%');
		o.default = '80';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mem_threshold', '内存告警阈值',
			'内存使用率超过此值时发送告警');
		o.value('70', '70%');
		o.value('75', '75%');
		o.value('80', '80%');
		o.value('85', '85% (推荐)');
		o.value('90', '90%');
		o.value('95', '95%');
		o.default = '85';
		o.rmempty = false;

		o = s.option(form.ListValue, 'disk_threshold', '磁盘告警阈值',
			'磁盘使用率超过此值时发送告警');
		o.value('80', '80%');
		o.value('85', '85%');
		o.value('90', '90% (推荐)');
		o.value('95', '95%');
		o.default = '90';
		o.rmempty = false;

		o = s.option(form.ListValue, 'temp_threshold', '温度告警阈值',
			'温度超过此值时发送告警（需要硬件支持温度传感器）');
		o.value('60', '60°C');
		o.value('65', '65°C');
		o.value('70', '70°C');
		o.value('75', '75°C (推荐)');
		o.value('80', '80°C');
		o.value('85', '85°C');
		o.default = '75';
		o.rmempty = false;

		o = s.option(form.Flag, 'notify_recovery', '恢复通知',
			'系统恢复正常时也发送通知');
		o.default = '1';
		o.rmempty = false;

		// --- Device Monitor ---
		s = m.section(form.NamedSection, 'device_monitor', 'device_monitor', '设备上下线监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'监控指定设备的上线和离线状态');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检测间隔',
			'检查设备状态的间隔时间');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'track_macs', '监控设备 MAC',
			'要监控的设备 MAC 地址，逗号分隔（大写，如 AA:BB:CC:DD:EE:FF）');
		o.rmempty = true;
		o.placeholder = 'AA:BB:CC:DD:EE:FF,11:22:33:44:55:66';

		o = s.option(form.Flag, 'notify_recovery', '上线通知',
			'设备重新上线时也发送通知');
		o.default = '1';
		o.rmempty = false;

		return m.render();
	}
});
