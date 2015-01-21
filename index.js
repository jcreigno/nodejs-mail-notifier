/*jslint node: true, vars: true, indent: 4 */
'use strict';

var util = require('util'),
    Imap = require('imap'),
    MailParser = require('mailparser').MailParser,
    EventEmitter = require('events').EventEmitter;


function Notifier(opts) {
    EventEmitter.call(this);
    var self = this;
    self.options = opts;
    if (self.options.username) { //backward compat
        self.options.user = self.options.username;
    }
    self.hideLogs = (self.options.hideLogs) ? true : false;
    self.connected = false;
    self.imap = new Imap(opts);
    self.imap.on('end', function () {
        self.connected = false;
        self.emit('end');
    });
    self.imap.on('error', function (err) {
        self.emit('error', err);
    });
}
util.inherits(Notifier, EventEmitter);

module.exports = function (opts) {
    return new Notifier(opts);
};


Notifier.prototype.start = function () {
    var self = this;
    self.imap.once('ready', function () {
        self.connected = true;
        self.imap.openBox(self.options.box || 'INBOX', false, function () {
            self.scan();
            self.imap.on('mail', function (id) {
                self.scan();
            });
        });
    });
    self.imap.connect();
    return this;
};

Notifier.prototype.scan = function () {
    var self = this;
    self.imap.search(self.options.search || ['UNSEEN'], function (err, seachResults) {
        if (err) {
            self.emit('error', err);
        }
        if (!seachResults || seachResults.length === 0) {
            if(!self.options.hideLogs) {
                util.log('no new mail in INBOX');
            }
            return;
        }
        var fetch = self.imap.fetch(seachResults, {
            markSeen: self.options.markSeen !== false,
            bodies: ''
        });
        fetch.on('message', function (msg) {
            var mp = new MailParser();
            mp.once('end', function (mail) {
                self.emit('mail', mail);
            });
            msg.once('body', function (stream, info) {
                stream.pipe(mp);
            });
        });
        fetch.once('end', function () {
            if(!self.options.hideLogs) {
                util.log('Done fetching all messages!');
            }
        });
        fetch.on('error', function () {
            self.emit('error', err);
        });
    });
    return this;
};

Notifier.prototype.stop = function () {
    if (this.connected) {
        this.imap.end();
    }
    return this;
};
