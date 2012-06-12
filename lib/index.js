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
	this.moderatorsList = [];

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
		hashbot.currentRoom = data.room;
		console.log('Joined room: '+hashbot.currentRoom.name);
		hashbot.moderatorsList = data.room.metadata.moderator_id;
	});
};

hashbot.prototype.eventSpeak = function() {
	var hashbot = this;
	this.bot.on('speak', function(data) {
		console.log(util.inspect(data, true, null));
		if (data.text.match(/^!dj .*/i)) {
     	   hashbot.commandDj(data);
	    }
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
					if (hashbot.currentRoom.roomid === data.roomId) {
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
		var mongoose = hashbot.getMongoClient();
		var SongPlayHistory = new Schema({
			_id: String,
			dj_id: String,
			room_id: String,
			datetime: Date,
			awesomes: Number,
			lames: Number,
			snags: Number
		});
		var SongInfo = new Schema({
			_id: String,
			artist: String,
			song: String,
			album: String,
			playhistory: [SongPlayHistory]
		});

		var Song = mongoose.model('SongInfo', SongInfo);
		var SongHistory = mongoose.model('SongPlayHistory', SongPlayHistory);

		Song.findOne({
			'_id': current_song._id
		},
		function(err, docs) {
			if (err) {
				console.log('newsong find err: ' + util.inspect(err, true, null));
			}
			else if (docs == null) {
				console.log('newsong find new entry being made');
				var history = new SongHistory({
					_id: current_song.starttime,
					dj_id: current_song.djid,
					room_id: data.room.roomid,
					datetime: new Date(),
					awesomes: 0,
					lames: 0,
					snags: 0
				});
				var song = new Song({
					_id: current_song._id,
					artist: metadata.artist,
					song: metadata.song,
					album: metadata.album,
					playhistory: [history]
				});
				song.save(function(err, data) {
					if (err) {
						console.log('newsong find new save err: ' + util.inspect(err, true, null));
					}
				});
			}
			else {
				console.log('newsong find docs: ' + util.inspect(docs, true, null));
				var history = new SongHistory({
					_id: current_song.djid,
					datetime: new Date(),
					starttime: current_song.starttime,
					awesomes: 0,
					lames: 0,
					snags: 0
				});
				docs.playhistory.push([history]);
				docs.save(function(err, data) {
					if (err) {
						console.log('newsong find upd save err: ' + util.inspect(err, true, null));
					}
				});
			}
		});
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
		var metadata = data.room.metadata;
		var current_song = metadata.current_song;

		var mongoose = hashbot.getMongoClient();

		var SongPlayHistory = new Schema({
			_id: String,
			dj_id: String,
			room_id: String,
			datetime: Date,
			awesomes: Number,
			lames: Number,
			snags: Number
		});
		var SongInfo = new Schema({
			_id: String,
			artist: String,
			song: String,
			album: String,
			playhistory: [SongPlayHistory]
		});

		var Song = mongoose.model('SongInfo', SongInfo);

		var query = { $elemMatch: { _id: current_song.starttime } };

		Song.findOne({ playhistory: { $all: [query] }}, function(err, docs) {
			if (err) {
				console.log('endsong find err: ' + util.inspect(err, true, null));
			}
			else if (docs == null) {
				console.log('endsong find song not located.');
			}
			else {
				console.log('endsong find docs: ' + util.inspect(docs, true, null));
/*
				docs.playhistory.findById(current_song._id, function(err, docs) {
					docs.awesomes = metadata.upvotes;
					docs.lames = metadata.downvotes;
					docs.save();
				});
*/
			}
		});
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
		var regUser = data.user[0];
		var mongoose = hashbot.getMongoClient();

		var SongPlayHistory = new Schema({
			_id: String,
			datetime: Date,
			starttime: String,
			room_id: String,
			awesomes: Number,
			lames: Number,
			snags: Number
		});

		var UserRoomHistory = new Schema({
			_id: String,
			lastseen: Date
		});

		var UserInfo = new Schema({
			_id: String,
			name: String,
			aliases: [String],
			roomhistory: [UserRoomHistory],
			playhistory: [SongPlayHistory]
		});

		var User = mongoose.model('UserInfo', UserInfo);
		var SongHistory = mongoose.model('SongPlayHistory', SongPlayHistory);
		var RoomHistory = mongoose.model('UserRoomHistory', UserRoomHistory);

		User.findOne({
			'_id': regUser.userid
		},
		function(err, docs) {
			if (err) {
				console.log('registered find err: ' + util.inspect(err, true, null));
			}
			else if (docs == null) {
				console.log('registered find new entry being made');
				var roomhistory = new RoomHistory({
					_id: data.roomid,
					lastseen: new Date
				});

				var user = new User({
					_id: regUser.userid,
					name: regUser.name,
					aliases: [regUser.name],
					roomhistory: [roomhistory]
				});

				user.save(function(err, data) {
					if (err) {
						console.log('registered find new save err: ' + util.inspect(err, true, null));
					}
				});
			}
			else {
				console.log('registered find docs: ' + util.inspect(docs, true, null));
			}
		});
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
		mongo = require('mongoose').connect('mongodb://localhost/turntable');
	} catch(e) {}
	return mongo;
};

hashbot.prototype.commandDj = function(data) {
	var hashbot = this;
	if (data.userid === MASTERID || contains(hashbot.moderatorsList, data.userid)) {
		var option = data.text.slice(data.text.indexOf(' ')).trim();
		if (option.match(/on/i)) {
			hashbot.bot.addDj();
		}
		else if (option.match(/off/i)) {
			hashbot.bot.remDj();
		}
	}
	else {
		console.log('commandDj: Requestor userid does not equal MASTERID and not contained in moderatorsList');
		console.log(util.inspect(data,true,null));
	}
};

function contains(a, obj) {
	var i = a.length;
	while (i--) {
		if (a[i] === obj) {
			return true;
		}
	}
	return false;
}

module.exports = hashbot;

