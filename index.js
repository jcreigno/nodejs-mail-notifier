/*jslint node: true, consts: true, indent: 4 */
'use strict';

const Imap = require('imap'),
    debug = require('debug'),
    async = require('async'),
    MailParser = require('mailparser').MailParser,
    EventEmitter = require('events').EventEmitter;

const defaultDebug = debug('mailnotifier');

/**
 * connection events from imap package, these strings should be used on imap listening
 *
 * source:
 * https://www.npmjs.com/package/imap
 */
const CONNECTION_EVENT_READY = 'ready';
// () - Emitted when a connection to the server has been made and authentication was successful.
const CONNECTION_EVENT_ALERT= 'alert';
// (< string >message) - Emitted when the server issues an alert (e.g. "the server is going down for maintenance").
const CONNECTION_EVENT_MAIL = 'mail';
// (< integer >numNewMsgs) - Emitted when new mail arrives in the currently open mailbox.
const CONNECTION_EVENT_EXPUNGE = 'expunge';
// (< integer >seqno) - Emitted when a message was expunged externally. seqno is the sequence number (instead of the
// unique UID) of the message that was expunged. If you are caching sequence numbers, all sequence numbers higher than
// this value MUST be decremented by 1 in order to stay synchronized with the server and to keep correct continuity.
const CONNECTION_EVENT_UIDVALIDITY = 'uidvalidity';
// (< integer >uidvalidity) - Emitted if the UID validity value for the currently open mailbox changes during the
// current session.
const CONNECTION_EVENT_UPDATE = 'update';
// (< integer >seqno, < object >info) - Emitted when message metadata (e.g. flags) changes externally.
const CONNECTION_EVENT_ERROR = 'error';
// (< Error >err) - Emitted when an error occurs. The 'source' property will be set to indicate where the error
// originated from.
const CONNECTION_EVENT_CLOSE = 'close';
// (< boolean >hadError) - Emitted when the connection has completely closed.
const CONNECTION_EVENT_END = 'end';
// () - Emitted when the connection has ended.

/**
 * this package events
 *
 * source:
 * README.md
 */
const NOTIFIER_EVENT_CONNECTED = 'connected';
// Sent when a connection to the server has been made.
const NOTIFIER_EVENT_MAIL = 'mail';
// (< object > mail) - Sent on incoming new unread email. The parsed Mail is given as first parameter to the event listener.
const NOTIFIER_EVENT_ERROR = 'error';
// (< object >  err) - Sent when an error occurs with the IMAP connection. The first parameter is the err object.
const NOTIFIER_EVENT_END = 'end';
// Sent when the IMAP connection is closed. This usually happens after a stop method call.

class Notifier extends EventEmitter {

    constructor(opts, dbg) {
        super();
        const self = this;
        self.dbg = defaultDebug;
        self.options = opts;
        if (self.options.username) { //backward compatibility
            self.options.user = self.options.username;
        }
        self.options.box = self.options.box || 'INBOX';
        self.options.debug = self.options.debug || debug('imap');

        if (dbg) {
            self.dbg = dbg;
        }
    }

    start() {
        const self = this;

        // q - queue object - https://caolan.github.io/async/docs.html#QueueObject
        const q = async.queue(function(task, callback) { // docs: https://caolan.github.io/async/docs.html#queue
            self.dbg('process queue ' + task.name);
            self.scan(callback);
        });

        // a callback that is called when the last item from the queue has returned from the worker
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
            self.emit('end');
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
    }

    scan(callback) {
        const self = this, search = self.options.search || ['UNSEEN'];
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
            const fetch = self.imap.fetch(seachResults, {
                markSeen: self.options.markSeen !== false,
                bodies: ''
            });
            fetch.on('message', function (msg) {
                let uid, flags;
                msg.on('attributes', function(attrs) {
                    uid = attrs.uid;
                    flags = attrs.flags;
                    self.dbg("Message uid", attrs.uid);
                });
                const mp = new MailParser();
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
    }

    stop() {
        const self = this;
        self.dbg('imap.state before stopping: %s', this.imap.state);

        if (this.imap.state !== 'disconnected') {
            this.imap.end();
        }

        self.dbg('notifier stopped');
        return this;
    }
}

module.exports = function (opts, customDbg) {
    return new Notifier(opts, customDbg);
};