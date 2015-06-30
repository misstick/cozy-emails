// Generated by CoffeeScript 1.9.2
var Account, AccountConfigError, _, async, log, notifications;

_ = require('lodash');

Account = require('../models/account');

AccountConfigError = require('../utils/errors').AccountConfigError;

log = require('../utils/logging')({
  prefix: 'accounts:controller'
});

async = require('async');

notifications = require('../utils/notifications');

module.exports.fetch = function(req, res, next) {
  var id, ref, ref1;
  id = req.params.accountID || req.body.accountID || ((ref = req.mailbox) != null ? ref.accountID : void 0) || ((ref1 = req.message) != null ? ref1.accountID : void 0);
  return Account.findSafe(id, function(err, found) {
    if (err) {
      return next(err);
    }
    req.account = found;
    return next();
  });
};

module.exports.format = function(req, res, next) {
  log.debug("FORMATTING ACCOUNT");
  return res.account.toClientObject(function(err, formated) {
    log.debug("SENDING ACCOUNT");
    if (err) {
      return next(err);
    }
    return res.send(formated);
  });
};

module.exports.formatList = function(req, res, next) {
  return async.mapSeries(res.accounts, function(account, callback) {
    return account.toClientObject(callback);
  }, function(err, formateds) {
    if (err) {
      return next(err);
    }
    return res.send(formateds);
  });
};

module.exports.create = function(req, res, next) {
  var data;
  data = req.body;
  return Account.createIfValid(data, function(err, created) {
    if (err) {
      return next(err);
    }
    res.account = created;
    next();
    return res.account.imap_fetchMailsTwoSteps(function(err) {
      if (err) {
        log.error("FETCH MAIL FAILED", err.stack || err);
      }
      return notifications.accountFirstImportComplete(res.account);
    });
  });
};

module.exports.check = function(req, res, next) {
  var tmpAccount;
  if (req.body.imapLogin) {
    req.body.login = req.body.imapLogin;
  }
  tmpAccount = new Account(req.body);
  return tmpAccount.testConnections(function(err) {
    if (err) {
      return next(err);
    }
    return res.send({
      check: 'ok'
    });
  });
};

module.exports.list = function(req, res, next) {
  return Account.request('all', function(err, founds) {
    if (err) {
      return next(err);
    }
    res.accounts = founds;
    return next();
  });
};

module.exports.edit = function(req, res, next) {
  var updated;
  updated = new Account(req.body);
  if (!(updated.password && updated.password !== '')) {
    updated.password = req.account.password;
  }
  return updated.testConnections(function(err) {
    var changes;
    if (err) {
      return next(err);
    }
    changes = _.pick(req.body, Object.keys(Account.schema));
    return req.account.updateAttributes(changes, function(err, updated) {
      res.account = updated;
      return next(err);
    });
  });
};

module.exports.remove = function(req, res, next) {
  return req.account.destroyEverything(function(err) {
    if (err) {
      return next(err);
    }
    return res.status(204).end();
  });
};
