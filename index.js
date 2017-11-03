/*jslint node: true, vars: true, indent: 4 */
'use strict';

var util = require('util'),
    Imap = require('imap'),
    debug = require('debug'),
    async = require('async'),
    MailParser = require('mailparser').MailParser,
    EventEmitter = require('events').EventEmitter;

var dbg = debug('mailnotifier');

function Notifier(opts, dbg) {
    EventEmitter.call(this);
    var self = this;
    self.options = opts;
    if (self.options.username) { //backward compat
        self.options.user = self.options.username;
    }
    self.options.box = self.options.box || 'INBOX';
    self.options.debug = self.options.debug || debug('imap');

    if(dbg) {
        self.dbg = dbg;
    }
}
util.inherits(Notifier, EventEmitter);

module.exports = function (opts, customDbg) {
    return new Notifier(opts, customDbg);
};

Notifier.prototype.start = function () {
    var self = this;
    
	var q = async.queue(function(task, callback) {
		self.dbg('process queue ' + task.name);
		self.scan(callback);
	}, 1);	

	// assign a callback
	q.drain = function() {
		self.dbg('all items have been processed');
	};
	
	self.imap = new Imap(self.options);
    self.imap.once('end', function () {
        self.dbg('imap end');
        self.emit('end');
    });
    self.imap.once('error', function (err) {
        self.dbg('imap error : %s', err);
        self.emit('error', err);
    });
    self.imap.once('close', function (haserr) {
        self.dbg('imap close : %s', haserr ? 'errored ' + haserr : 'normal');
    });
    self.imap.on('uidvalidity', function (uidvalidity) {
        self.dbg('new uidvalidity : %s', uidvalidity);
    });
    self.imap.once('ready', function () {
        self.emit('connected');
        self.imap.openBox(self.options.box, false, function (err, box) {
            if (err) {
                self.dbg('unable to open box : %s', err);
                self.emit('error', err);
                return;
            }
            
			q.push({name: 'scan initial'}, function(err) {
				self.dbg('finished processing scan initial');
			});
			
            self.imap.on('mail', function (id) {
                self.dbg('mail event : %s', id);
                q.push({name: 'scan', id : id}, function(err) {
					self.dbg('finished processing scan '+id);
				});
            });
        });
    });
    self.imap.connect();
    return this;
};

Notifier.prototype.scan = function (callback) {
    var self = this, search = self.options.search || ['UNSEEN'];
    self.dbg('scanning %s with filter `%s`.', self.options.box,  search);
    self.imap.search(search, function (err, seachResults) {
        if (err) {
            self.emit('error', err);
            callback();
			return;
        }
        if (!seachResults || seachResults.length === 0) {
            self.dbg('no new mail in %s', self.options.box);
            callback();
            return;
        }
        self.dbg('found %d new messages', seachResults.length);
        var fetch = self.imap.fetch(seachResults, {
            markSeen: self.options.markSeen !== false,
            bodies: ''
        });
        fetch.on('message', function (msg) {
            var uid, flags;
            msg.on('attributes', function(attrs) {                                                           
                uid = attrs.uid;
                flags = attrs.flags;
                self.dbg("Message uid", attrs.uid);                                                               
            }); 
            var mp = new MailParser();
            mp.once('end', function (mail) {
                mail.uid = uid;
                mail.flags = flags;
                self.emit('mail', mail);
				self.dbg('found mail '+mail.headers["message-id"]);
            });
            msg.once('body', function (stream, info) {
                stream.pipe(mp);
            });
        });
        fetch.once('end', function () {
            self.dbg('Done fetching all messages!');
            callback();
        });
        fetch.once('error', function (err) {
            self.dbg('fetch error : ', err);
            self.emit('error', err);
             callback();
       });
    });
    return this;
};

Notifier.prototype.stop = function () {
    var self = this;
    self.dbg('imap.state before stopping: %s', this.imap.state);

    if (this.imap.state !== 'disconnected') {
        this.imap.end();
    }

    self.dbg('notifier stopped');
    return this;
};

Notifier.prototype.dbg = dbg;
