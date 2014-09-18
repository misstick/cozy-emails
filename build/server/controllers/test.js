// Generated by CoffeeScript 1.7.1
var Account, CozyInstance, async, fixtures;

async = require('async');

Account = require('../models/account');

CozyInstance = require('../models/cozy_instance');

fixtures = require('cozy-fixtures');

module.exports.main = function(req, res, next) {
  return async.parallel([
    function(cb) {
      return CozyInstance.getLocale(cb);
    }, function(cb) {
      return Account.getAll(cb);
    }
  ], function(err, results) {
    var accounts, locale;
    if (err != null) {
      console.log(err);
      return res.render('test.jade', {
        imports: "console.log(\"" + err + "\")\nwindow.locale = \"en\";\nwindow.accounts = {};"
      });
    } else {
      locale = results[0], accounts = results[1];
      accounts = accounts.map(Account.clientVersion);
      return res.render('test.jade', {
        imports: "window.locale   = \"" + locale + "\";\nwindow.accounts = " + (JSON.stringify(accounts)) + ";"
      });
    }
  });
};
