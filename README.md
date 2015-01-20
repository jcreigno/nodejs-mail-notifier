mail-notifier
=============

> Notify your nodejs scripts of incoming imap mail.

introduction
------------
Send `mail` event for each new email in IMAP INBOX. 

synopsis
--------
Start listening new mails :

```javascript
var notifier = require('mail-notifier');

var imap = {
  user: "yourimapuser",
  password: "yourimappassword",
  host: "imap.host.com",
  port: 993, // imap port
  tls: true,// use secure connection
  tlsOptions: { rejectUnauthorized: false }
};

notifier(imap).on('mail',function(mail){console.log(mail);}).start();
```  

installation
------------

    $ npm install mail-notifier

API
===

notifier(config)
----------------
The constructor function creates a new `notifier`. Parameter provide options needed for imap connection.
`config` :

* `host` :  imap server host
* `port` :  imap server port number
* `user` :  imap user name
* `password` :  imap password
* `tls` :  need a tle connection to server
* `tlsOptions` : see `tls` module options
* `markSeen`: mark mail as read defaults to true
* `box` : mail box read from defaults to 'INBOX'
* `search`: search query defaults to ['UNSEEN']
* `hideLogs`: hides all logging, defaults to false

For backward compatibility `username` is also supported.

.start()
------------------------------------
Start listening for incomming emails.

.stop()
------------------------------------
Stop listening and close IMAP connection.

Events
======

'mail'
-----
Sent on incoming new unread email. The parsed Mail is given as first parameter to the event listener.

'error'
-----
Sent when an error occurs with the IMAP connection. The first parameter is the `err` object.

'end'
-----
Sent when the IMAP connection is closed. This usually happens after a `stop` method call.

Dependencies
============

This module relies heavily on [node-imap](https://github.com/mscdex/node-imap). For more advanced usage, please consider
using it directly.
