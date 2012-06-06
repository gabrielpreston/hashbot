var AUTH = 'auth+live+abcc874113e427110587f31350db9b7896b7e6c2';
var USERID = '4ec3c7654fe7d07268001eb5';
var ROOMID = '4ebfcd164fe7d0726b0012e5';
var MASTERID = '4e720e5b4fe7d045b01641ad';

var Bot = require('ttapi');
var util = require('util');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

process.on('uncaughtException', function(err) {
	console.log("uncaughtException: ", err);
	console.log("stack trace: ", err.stack);
});

var hashbot = function(_options) {
	var hashbot = this;

	this.bot = new Bot(AUTH, USERID, ROOMID);

	this.currentRoom = null;
	this.currentSong = null;
	this.usersList = {};
	this.djsList = {};

	this.eventReady();
	this.eventRoomChanged();
	this.eventSpeak();
	this.eventPM();
	this.eventUpdateVotes();
	this.eventNewSong();
	this.eventNoSong();
	this.eventEndSong();
	this.eventAddDj();
	this.eventRemDj();
	this.eventUpdateUser();
	this.eventNewModerator();
	this.eventRemModerator();
	this.eventRegistered();
	this.eventDeregistered();
	this.eventBootedUser();
	this.eventSnagged();
	this.getMongoClient();
}

hashbot.prototype.eventReady = function() {
	var hashbot = this;
	this.bot.on('ready', function() {
		hashbot.bot.roomRegister(ROOMID);
	});
};

hashbot.prototype.eventRoomChanged = function() {
	var hashbot = this;
	this.bot.on('roomChanged', function(data) {
		currentRoom = data.room;
	});
};

hashbot.prototype.eventSpeak = function() {
	var hashbot = this;
	this.bot.on('speak', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventPM = function() {
	var hashbot = this;
	this.bot.on('pmmed', function(data) {
		console.log(util.inspect(data, true, null));
		if (data.senderid === MASTERID) {
			console.log('Master PMed me.');
			if (data.text.match(/^follow$/i)) {
				hashbot.bot.stalk(MASTERID, function(data) {
					console.log(util.inspect(data, true, null));
					if (currentRoom.roomid === data.roomId) {
						hashbot.bot.pm('Turntable.fm says we are in the same room!', MASTERID);
					} else {
						hashbot.bot.pm('Coming right over!', MASTERID);
						hashbot.bot.roomRegister(data.roomId);
					}
				});
			}
			if (data.text.match(/^home$/i)) {
				hashbot.bot.pm('Going back home!', MASTERID);
				hashbot.bot.roomRegister(ROOMID);
			}
		}
	});
};

hashbot.prototype.eventUpdateVotes = function() {
	var hashbot = this;
	this.bot.on('update_votes', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventNewSong = function() {
	var hashbot = this;
	this.bot.on('newsong', function(data) {
		console.log(util.inspect(data, true, null));
		var current_song = data.room.metadata.current_song;
		var metadata = current_song.metadata;

		// Setup the MongoDB Schema here for now
		var mongoose = this.getMongoClient();
		var PlayHistory = new Schema({
			id: String,
			count: Number
		});
		var SongInfo = new Schema({
			id: String,
			artist: String,
			song: String,
			album: String,
			lastplayed: Date,
			awesomes: Number,
			lames: Number,
			count: Number,
			playhistory: [PlayHistory]
		});

		var Song = mongoose.model('SongInfo');
		var song = new Song({
			id: current_song._id,
			artist: metadata.artist,
			song: metadata.song,
			album: metadata.album
		});
		song.save();

	});
};

hashbot.prototype.eventNoSong = function() {
	var hashbot = this;
	this.bot.on('nosong', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventEndSong = function() {
	var hashbot = this;
	this.bot.on('endsong', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventAddDj = function() {
	var hashbot = this;
	this.bot.on('add_dj', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventRemDj = function() {
	var hashbot = this;
	this.bot.on('rem_dj', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventUpdateUser = function() {
	var hashbot = this;
	this.bot.on('update_user', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventNewModerator = function() {
	var hashbot = this;
	this.bot.on('new_moderator', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventRemModerator = function() {
	var hashbot = this;
	this.bot.on('rem_moderator', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventRegistered = function() {
	var hashbot = this;
	this.bot.on('registered', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventDeregistered = function() {
	var hashbot = this;
	this.bot.on('deregistered', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventBootedUser = function() {
	var hashbot = this;
	this.bot.on('booted_user', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.eventSnagged = function() {
	var hashbot = this;
	this.bot.on('snagged', function(data) {
		console.log(util.inspect(data, true, null));
	});
};

hashbot.prototype.getMongoClient = function() {
	var hashbot = this;
	var mongo = null;
	try {
		mongo = require('mongoose').connect('mongodb://localhost/my_database');
	} catch(e) {}
	return mongo;
};

module.exports = hashbot;

