var util = require('util'), 
    ImapConnection = require ('imap').ImapConnection, 
    MailParser = require('mailparser').MailParser, 
    Seq = require('seq'),
    EventEmitter = require('events').EventEmitter;


function Notifier(opts) {
    EventEmitter.call(this);
    this.options = opts;
    this.imap = new ImapConnection({
        username: opts.username,
        password: opts.password,
        host: opts.host,
        port: opts.port,
        secure: opts.secure
    });
}
util.inherits(Notifier, EventEmitter);

module.exports = function(opts){
    return new Notifier(opts);
};


Notifier.prototype.start = function(){
    var self = this;
    Seq()
        .seq(function(){ self.imap.connect(this); })
        .seq(function(){ self.imap.openBox('INBOX',false,this);})
        .seq(function(){ 
            util.log('successfully opened mail box');
            self.imap.on('mail', function(id){ self.scan(); });
            self.scan();
        });
    return this;
};

Notifier.prototype.scan = function(){
    var self = this;
    Seq()
        .seq(function(){ 
            self.imap.search(['UNSEEN'],this);
        })
        .seq(function(seachResults){
            if(!seachResults || seachResults.length==0){
                util.log('no new mail in INBOX');
                return;
            }
            var fetch = self.imap.fetch(seachResults,{markSeen:true,request:{headers:false,body: "full"}});
            fetch.on('message', function(msg) {
                var mp = new MailParser();
                mp.on('end',function(mail){
                    self.emit('mail',mail);
                });
                msg.on('data', function(chunk) {
                    mp.write(chunk.toString());
                });
                msg.on('end', function() {
                    mp.end();
                });
            });
            fetch.on('end', function() {
                util.log('Done fetching all messages!');
            });  
        })
    ;
    return this;
};

Notifier.prototype.stop = function(){
    this.imap.logout();
    this.emit('end');
    return this;
};
