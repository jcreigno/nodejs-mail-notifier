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
  username: "yourimapuser",
  password: "yourimappassword",
  host: "imap.host.com",
  port: 993, // imap port
  secure: true // use secure connection
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
 * `username` :  imap user name
 * `password` :  imap password
 * `secure` :  need secure connection to server

.start()
------------------------------------
Start listening for incomming emails.

Events
======

'mail'
-----
Sent on incoming new unread email. The parsed Mail is given as first parameter to the event listener.

