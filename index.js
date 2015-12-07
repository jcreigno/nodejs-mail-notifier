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
    self.options.box = self.options.box || 'INBOX';
    self.hideLogs = !!self.options.hideLogs;
}
util.inherits(Notifier, EventEmitter);

module.exports = function (opts) {
    return new Notifier(opts);
};


Notifier.prototype.start = function () {
    var self = this;
    self.imap = new Imap(self.options);
    self.imap.on('end', function () {
        self.emit('end');
    });
    self.imap.on('error', function (err) {
        self.emit('error', err);
    });
    self.imap.once('ready', function () {
        self.imap.openBox(self.options.box, false, function () {
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
            if (!self.options.hideLogs) {
                util.log('no new mail in ' + self.options.box);
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
            if (!self.options.hideLogs) {
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
    console.log('state', this.imap.state);
    if (this.imap.state !== 'disconnected') {
        this.imap.end();
    }
    return this;
};
