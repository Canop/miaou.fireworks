// pop
const	auths = require('../../libs/auths.js'),
	removeDiacritics = require('../../libs/naming.js').removeDiacritics,
	MIN_DELAY = 40, // delay in seconds between two fireworks in a room
	lastFireworkPerRoom = new Map; // map roomId -> firework info (0 as key for global)

var	miaou,
	nextFireworkId = Date.now();

exports.init = function(_miaou, pluginpath){
	miaou = _miaou;
}

var launch = exports.launch = function(roomId, user, args, isServerAdmin){
	var	match = args.match(/^([^\/]*\/)?(.*)/),
		modifiers = match[1],
		text = match[2].trim(),
		global = /\bg/i.test(modifiers),
		flash = /\fg/i.test(modifiers);
	if (global && !isServerAdmin) {
		throw "Only a server admin can send global fireworks";
	}
	var firework = {
		text: text,
		id: nextFireworkId++,
		sent: Date.now()/1000,
		author: user.name,
		global: global,
		flash: flash
	};
	firework.text = removeDiacritics(firework.text.replace(/\s/g, ' '));
	var infoKey = firework.global ? 0 : roomId;
	if (firework.text.trim().length<2) throw "Too short";
	if (firework.text.length>50) throw "Too long";
	if (firework.text.split(' ').length>5) throw "Too many words";
	if (!firework.flash) {
		var lastFirework = lastFireworkPerRoom.get(infoKey);
		if (lastFirework && (lastFirework.sent+MIN_DELAY>firework.sent)) {
			throw "Min delay between two fireworks: " + MIN_DELAY + " seconds";
		}
		lastFireworkPerRoom.set(infoKey, firework);
	}
	var sockets = miaou.io.sockets;
	if (!global) sockets = sockets.in(roomId);
	sockets.emit("fireworks.launch", firework);
}
function onCommand(ct){
	ct.silent = true;
	ct.nostore = true;
	launch(ct.shoe.room.id, ct.shoe.publicUser, ct.args, auths.isServerAdmin(ct.shoe.completeUser));
}
function onBotCommand(cmd, args, bot, m){
	launch(m.room, bot, args, false); // TODO make it a silent message
}
function onReplay(ct){
	ct.shoe.emit('fireworks.reset');
	var firework = lastFireworkPerRoom.get(ct.shoe.room.id) || lastFireworkPerRoom.get(0);
	if (firework) ct.shoe.emit("fireworks.launch", firework);
	ct.silent = true;
}

exports.registerCommands = function(cb){
	cb({
		name: 'fireworks',
		fun: onCommand,
		botfun:onBotCommand,
		help: "start some fireworks"
	});
	cb({
		name: 'replay_fireworks',
		fun: onReplay,
		help: "replay last fireworks"
	});
}

exports.onNewShoe = function(shoe){
	setTimeout(function(){
		if (!shoe.room) {
			console.log("fireworks: no room in shoe");
			return;
		}
		var firework = lastFireworkPerRoom.get(shoe.room.id) || lastFireworkPerRoom.get(0);
		if (firework) shoe.emit("fireworks.launch", firework);
	}, 5000);
}
