// pop
const	auths = require('../../libs/auths.js'),
	removeDiacritics = require('../../libs/naming.js').removeDiacritics,
	MIN_DELAY = 40, // delay in seconds between two fireworks in a room
	lastFireworkPerRoom = new Map; // map roomId -> firework info (0 as key for global)

var	nextFireworkId = Date.now();

function onLaunch(ct){
	var	room = ct.shoe.room,
		match = ct.args.match(/^([^\/]*\/)?(.*)/),
		modifiers = match[1],
		text = match[2].trim(),
		firework = {
			text: text,
			id: nextFireworkId++,
			sent: Date.now()/1000,
			global: /\bg/i.test(modifiers),
			flash: /\fg/i.test(modifiers)
		},
		infoKey = firework.global ? 0 : room.id;
	if (firework.global && !auths.isServerAdmin(ct.shoe.completeUser)) {
		throw "Only a server admin can send global fireworks";
	}

	firework.text = removeDiacritics(firework.text.replace(/\s/g,' '));
	if (firework.text.trim().length<2) throw "Too short";
	if (firework.text.split(' ').length>5) throw "Too many words";
	if (!firework.flash) {
		var lastFirework = lastFireworkPerRoom.get(infoKey);
		if (lastFirework && (lastFirework.sent+MIN_DELAY>firework.sent)) {
			throw "Min delay between two fireworks: " + MIN_DELAY + " seconds";
		}
		lastFireworkPerRoom.set(infoKey, firework);
	}
	var sockets = ct.shoe.io().sockets;
	if (!firework.global) sockets = sockets.in(room.id);
	sockets.emit("fireworks.launch", firework);
}
function onReplay(ct){
	ct.shoe.emit('fireworks.reset');
	var firework = lastFireworkPerRoom.get(ct.shoe.room.id) || lastFireworkPerRoom.get(0);
	if (firework) ct.shoe.emit("fireworks.launch", firework);
}

exports.registerCommands = function(cb){
	cb({
		name: 'fireworks',
		fun: onLaunch,
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
