var notifier = require('../index.js');

var imap = {
  username: "jerome.creignou",
  password: "password",
  host: "imap.host.com",
  port: 993, // imap port
  tls: true // use secure connection
};

notifier(imap).on('mail',function(mail){console.log(mail);}).start();
