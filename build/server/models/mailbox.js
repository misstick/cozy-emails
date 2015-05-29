// Generated by CoffeeScript 1.9.1
var Break, FETCH_AT_ONCE, ImapPool, ImapReporter, Mailbox, Message, NotFound, RefreshStep, _, async, cozydb, log, mailutils, ref,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

cozydb = require('cozydb');

Mailbox = (function(superClass) {
  extend(Mailbox, superClass);

  function Mailbox() {
    return Mailbox.__super__.constructor.apply(this, arguments);
  }

  Mailbox.docType = 'Mailbox';

  Mailbox.schema = {
    accountID: String,
    label: String,
    path: String,
    lastSync: String,
    tree: [String],
    delimiter: String,
    uidvalidity: Number,
    attribs: [String],
    lastHighestModSeq: String,
    lastTotal: Number
  };

  Mailbox.RFC6154 = {
    draftMailbox: '\\Drafts',
    sentMailbox: '\\Sent',
    trashMailbox: '\\Trash',
    allMailbox: '\\All',
    junkMailbox: '\\Junk',
    flaggedMailbox: '\\Flagged'
  };

  Mailbox.imapcozy_create = function(account, parent, label, callback) {
    var mailbox, path, tree;
    if (parent) {
      path = parent.path + parent.delimiter + label;
      tree = parent.tree.concat(label);
    } else {
      path = label;
      tree = [label];
    }
    mailbox = {
      accountID: account.id,
      label: label,
      path: path,
      tree: tree,
      delimiter: (parent != null ? parent.delimiter : void 0) || '/',
      attribs: []
    };
    return ImapPool.get(account.id).doASAP(function(imap, cbRelease) {
      return imap.addBox2(path, cbRelease);
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return Mailbox.create(mailbox, callback);
    });
  };

  Mailbox.getBoxes = function(accountID, callback) {
    return Mailbox.rawRequest('treeMap', {
      startkey: [accountID],
      endkey: [accountID, {}],
      include_docs: true
    }, function(err, rows) {
      if (err) {
        return callback(err);
      }
      rows = rows.map(function(row) {
        return new Mailbox(row.doc);
      });
      return callback(null, rows);
    });
  };

  Mailbox.getBoxesIndexedByID = function(accountID, callback) {
    return Mailbox.getBoxes(accountID, function(err, boxes) {
      var box, boxIndex, i, len;
      if (err) {
        return callback(err);
      }
      boxIndex = {};
      for (i = 0, len = boxes.length; i < len; i++) {
        box = boxes[i];
        boxIndex[box.id] = box;
      }
      return callback(null, boxIndex);
    });
  };

  Mailbox.removeOrphans = function(existings, callback) {
    log.debug("removeOrphans");
    return Mailbox.rawRequest('treemap', {}, function(err, rows) {
      var boxes;
      if (err) {
        return callback(err);
      }
      boxes = [];
      return async.eachSeries(rows, function(row, cb) {
        var accountID;
        accountID = row.key[0];
        if (indexOf.call(existings, accountID) >= 0) {
          boxes.push(row.id);
          return cb(null);
        } else {
          log.debug("removeOrphans - found orphan", row.id);
          return Mailbox.destroy(row.id, function(err) {
            log.error('failed to delete box', row.id);
            return cb(null);
          });
        }
      }, function(err) {
        return callback(err, boxes);
      });
    });
  };

  Mailbox.getCounts = function(mailboxID, callback) {
    var options;
    options = mailboxID ? {
      startkey: ['date', mailboxID],
      endkey: ['date', mailboxID, {}]
    } : {
      startkey: ['date', ""],
      endkey: ['date', {}]
    };
    options.reduce = true;
    options.group_level = 3;
    return Message.rawRequest('byMailboxRequest', options, function(err, rows) {
      var result;
      if (err) {
        return callback(err);
      }
      result = {};
      rows.forEach(function(row) {
        var DATEFLAG, boxID, flag, ref;
        ref = row.key, DATEFLAG = ref[0], boxID = ref[1], flag = ref[2];
        if (result[boxID] == null) {
          result[boxID] = {
            unread: 0,
            total: 0,
            recent: 0
          };
        }
        if (flag === "!\\Recent") {
          result[boxID].recent = row.recent;
        }
        if (flag === "!\\Seen") {
          return result[boxID].unread = row.value;
        } else if (flag === null) {
          return result[boxID].total = row.value;
        }
      });
      return callback(null, result);
    });
  };

  Mailbox.prototype.isInbox = function() {
    return this.path === 'INBOX';
  };

  Mailbox.prototype.isSelectable = function() {
    return indexOf.call(this.attribs || [], '\\Noselect') < 0;
  };

  Mailbox.prototype.RFC6154use = function() {
    var attribute, field, ref;
    ref = Mailbox.RFC6154;
    for (field in ref) {
      attribute = ref[field];
      if (indexOf.call(this.attribs, attribute) >= 0) {
        return field;
      }
    }
  };

  Mailbox.prototype.guessUse = function() {
    var path;
    path = this.path.toLowerCase();
    if (/sent/i.test(path)) {
      return 'sentMailbox';
    } else if (/draft/i.test(path)) {
      return 'draftMailbox';
    } else if (/flagged/i.test(path)) {
      return 'flaggedMailbox';
    } else if (/trash/i.test(path)) {
      return 'trashMailbox';
    }
  };

  Mailbox.prototype.doASAP = function(operation, callback) {
    return ImapPool.get(this.accountID).doASAP(operation, callback);
  };

  Mailbox.prototype.doASAPWithBox = function(operation, callback) {
    return ImapPool.get(this.accountID).doASAPWithBox(this, operation, callback);
  };

  Mailbox.prototype.doLaterWithBox = function(operation, callback) {
    return ImapPool.get(this.accountID).doLaterWithBox(this, operation, callback);
  };

  Mailbox.prototype.getSelfAndChildren = function(callback) {
    return Mailbox.rawRequest('treemap', {
      startkey: [this.accountID].concat(this.tree),
      endkey: [this.accountID].concat(this.tree, {}),
      include_docs: true
    }, function(err, rows) {
      if (err) {
        return callback(err);
      }
      rows = rows.map(function(row) {
        return new Mailbox(row.doc);
      });
      return callback(null, rows);
    });
  };

  Mailbox.destroyByAccount = function(accountID, callback) {
    return Mailbox.rawRequest('treemap', {
      startkey: [accountID],
      endkey: [accountID, {}]
    }, function(err, rows) {
      if (err) {
        return callback(err);
      }
      return async.eachSeries(rows, function(row, cb) {
        return Mailbox.destroy(row.id, function(err) {
          if (err) {
            log.error("Fail to delete box", err.stack || err);
          }
          return cb(null);
        });
      }, callback);
    });
  };

  Mailbox.getAllMessageIDs = function(boxID, callback) {
    var options;
    options = {
      startkey: ['uid', boxID, 0],
      endkey: ['uid', boxID, 'a'],
      reduce: false
    };
    return Message.rawRequest('byMailboxRequest', options, function(err, rows) {
      return callback(err, rows != null ? rows.map(function(row) {
        return row.id;
      }) : void 0);
    });
  };

  Mailbox.markAllMessagesAsIgnored = function(boxID, callback) {
    return Mailbox.getAllMessageIDs(boxID, function(err, ids) {
      var changes, lastError;
      if (err) {
        return callback(err);
      }
      changes = {
        ignoreInCount: true
      };
      lastError = null;
      return async.eachSeries(ids, function(id, cbLoop) {
        return Message.updateAttributes(id, changes, function(err) {
          if (err) {
            log.error(err);
            lastError = err;
          }
          return cbLoop(null);
        });
      }, function(err) {
        return callback(err || lastError);
      });
    });
  };

  Mailbox.prototype.imapcozy_rename = function(newLabel, newPath, callback) {
    log.debug("imapcozy_rename", newLabel, newPath);
    return this.imap_rename(newLabel, newPath, (function(_this) {
      return function(err) {
        log.debug("imapcozy_rename err", err);
        if (err) {
          return callback(err);
        }
        return _this.renameWithChildren(newLabel, newPath, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null);
        });
      };
    })(this));
  };

  Mailbox.prototype.imap_rename = function(newLabel, newPath, callback) {
    return this.doASAP((function(_this) {
      return function(imap, cbRelease) {
        return imap.renameBox2(_this.path, newPath, cbRelease);
      };
    })(this), callback);
  };

  Mailbox.prototype.imapcozy_delete = function(account, callback) {
    var box;
    log.debug("imapcozy_delete");
    box = this;
    return async.series([
      (function(_this) {
        return function(cb) {
          return _this.imap_delete(cb);
        };
      })(this), function(cb) {
        log.debug("account.forget");
        return account.forgetBox(box.id, cb);
      }, (function(_this) {
        return function(cb) {
          log.debug("destroyAndRemoveAllMessages");
          return _this.destroyAndRemoveAllMessages(cb);
        };
      })(this)
    ], callback);
  };

  Mailbox.prototype.imap_delete = function(callback) {
    log.debug("imap_delete");
    return this.doASAP((function(_this) {
      return function(imap, cbRelease) {
        return imap.delBox2(_this.path, cbRelease);
      };
    })(this), callback);
  };

  Mailbox.prototype.renameWithChildren = function(newLabel, newPath, callback) {
    var depth, path;
    log.debug("renameWithChildren", newLabel, newPath, this.path);
    depth = this.tree.length - 1;
    path = this.path;
    return this.getSelfAndChildren(function(err, boxes) {
      log.debug("imapcozy_rename#boxes", boxes, depth);
      if (err) {
        return callback(err);
      }
      return async.eachSeries(boxes, function(box, cb) {
        var changes, item;
        log.debug("imapcozy_rename#box", box);
        changes = {};
        changes.path = box.path.replace(path, newPath);
        changes.tree = (function() {
          var i, len, ref, results1;
          ref = box.tree;
          results1 = [];
          for (i = 0, len = ref.length; i < len; i++) {
            item = ref[i];
            results1.push(item);
          }
          return results1;
        })();
        changes.tree[depth] = newLabel;
        if (box.tree.length === depth + 1) {
          changes.label = newLabel;
        }
        return box.updateAttributes(changes, cb);
      }, callback);
    });
  };

  Mailbox.prototype.destroyAndRemoveAllMessages = function(callback) {
    return this.getSelfAndChildren(function(err, boxes) {
      if (err) {
        return callback(err);
      }
      return async.eachSeries(boxes, function(box, cb) {
        return box.destroy(function(err) {
          if (err) {
            log.error("fail to destroy box " + box.id, err);
          }
          return Message.safeRemoveAllFromBox(box.id, function(err) {
            if (err) {
              log.error("\"\nfail to remove msg of box " + box.id, err);
            }
            return cb();
          });
        });
      }, callback);
    });
  };

  Mailbox.prototype.imap_refresh = function(options, callback) {
    log.debug("refreshing box");
    if (!options.supportRFC4551) {
      log.debug("account doesnt support RFC4551");
      return this.imap_refreshDeep(options, callback);
    } else if (this.lastHighestModSeq) {
      return this.imap_refreshFast(options, (function(_this) {
        return function(err, shouldNotif) {
          if (err) {
            log.warn("refreshFast fail (" + err.stack + "), trying deep");
            options.storeHighestModSeq = true;
            return _this.imap_refreshDeep(options, callback);
          } else {
            log.debug("refreshFastWorked");
            return callback(null, shouldNotif);
          }
        };
      })(this));
    } else {
      log.debug("no highestmodseq, first refresh ?");
      options.storeHighestModSeq = true;
      return this.imap_refreshDeep(options, callback);
    }
  };

  Mailbox.prototype.imap_refreshFast = function(options, callback) {
    var box, noChange;
    box = this;
    noChange = false;
    return box._refreshGetImapStatus(box.lastHighestModSeq, function(err, status) {
      var changes, highestmodseq, total;
      if (err) {
        return callback(err);
      }
      changes = status.changes, highestmodseq = status.highestmodseq, total = status.total;
      return box._refreshCreatedAndUpdated(changes, function(err, info) {
        var nbAdded, shouldNotif;
        if (err) {
          return callback(err);
        }
        log.debug("_refreshFast#aftercreates", info);
        shouldNotif = info.shouldNotif;
        nbAdded = info.nbAdded;
        noChange || (noChange = info.noChange);
        return box._refreshDeleted(total, info.nbAdded, function(err, info) {
          if (err) {
            return callback(err);
          }
          log.debug("_refreshFast#afterdelete", info);
          noChange || (noChange = info.noChange);
          if (noChange) {
            return callback(null, false);
          } else {
            changes = {
              lastHighestModSeq: highestmodseq,
              lastTotal: total,
              lastSync: new Date().toISOString()
            };
            return box.updateAttributes(changes, function(err) {
              return callback(err, shouldNotif);
            });
          }
        });
      });
    });
  };

  Mailbox.prototype._refreshGetImapStatus = function(modseqno, callback) {
    return this.doLaterWithBox(function(imap, imapbox, cbReleaseImap) {
      var changes, highestmodseq, total;
      highestmodseq = imapbox.highestmodseq;
      total = imapbox.messages.total;
      changes = {};
      if (highestmodseq === modseqno) {
        return cbReleaseImap(null, {
          changes: changes,
          highestmodseq: highestmodseq,
          total: total
        });
      } else {
        return imap.fetchMetadataSince(modseqno, function(err, changes) {
          return cbReleaseImap(err, {
            changes: changes,
            highestmodseq: highestmodseq,
            total: total
          });
        });
      }
    }, callback);
  };

  Mailbox.prototype._refreshCreatedAndUpdated = function(changes, callback) {
    var box, nbAdded, shouldNotif, uids;
    box = this;
    uids = Object.keys(changes);
    if (uids.length === 0) {
      return callback(null, {
        shouldNotif: false,
        nbAdded: 0,
        noChange: true
      });
    } else {
      nbAdded = 0;
      shouldNotif = false;
      return Message.indexedByUIDs(box.id, uids, function(err, messages) {
        if (err) {
          return callback(err);
        }
        return async.eachSeries(uids, function(uid, next) {
          var flags, message, mid, ref;
          ref = changes[uid], mid = ref[0], flags = ref[1];
          uid = parseInt(uid);
          message = messages[uid];
          if (message) {
            return message.updateAttributes({
              flags: flags
            }, next);
          } else {
            return Message.fetchOrUpdate(box, {
              mid: mid,
              uid: uid
            }, function(err, info) {
              shouldNotif = shouldNotif || info.shouldNotif;
              if (info != null ? info.actuallyAdded : void 0) {
                nbAdded += 1;
              }
              return next(err);
            });
          }
        }, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, {
            shouldNotif: shouldNotif,
            nbAdded: nbAdded
          });
        });
      });
    }
  };

  Mailbox.prototype._refreshDeleted = function(imapTotal, nbAdded, callback) {
    var box, error, lastTotal;
    lastTotal = this.lastTotal || 0;
    log.debug("refreshDeleted L=" + lastTotal + " A=" + nbAdded + " I=" + imapTotal);
    if (lastTotal + nbAdded === imapTotal) {
      error = "    NOTHING TO DO";
      return callback(null, {
        noChange: true
      });
    } else if (lastTotal + nbAdded < imapTotal) {
      error = "    WRONG STATE";
      return callback(new Error(error), {
        noChange: true
      });
    } else {
      error = "    NEED DELETION";
      box = this;
      return async.series([
        function(cb) {
          return Message.UIDsInCozy(box.id, cb);
        }, function(cb) {
          return box.imap_UIDs(cb);
        }
      ], function(err, results) {
        var cozyUIDs, deleted, imapUIDs, uid;
        cozyUIDs = results[0], imapUIDs = results[1];
        log.debug("refreshDeleted#uids", cozyUIDs.length, imapUIDs.length);
        deleted = (function() {
          var i, len, results1;
          results1 = [];
          for (i = 0, len = cozyUIDs.length; i < len; i++) {
            uid = cozyUIDs[i];
            if (indexOf.call(imapUIDs, uid) < 0) {
              results1.push(uid);
            }
          }
          return results1;
        })();
        log.debug("refreshDeleted#toDelete", deleted);
        return Message.byUIDs(box.id, deleted, function(err, messages) {
          log.debug("refreshDeleted#toDeleteMsgs", messages.length);
          return async.eachSeries(messages, function(message, next) {
            return message.removeFromMailbox(box, false, next);
          }, function(err) {
            return callback(err, {
              noChange: false
            });
          });
        });
      });
    }
  };

  Mailbox.prototype.imap_refreshDeep = function(options, callback) {
    var firstImport, limitByBox, step, storeHighestModSeq;
    limitByBox = options.limitByBox, firstImport = options.firstImport, storeHighestModSeq = options.storeHighestModSeq;
    log.debug("imap_refreshDeep", limitByBox);
    step = RefreshStep.initial(options);
    return this.imap_refreshStep(step, (function(_this) {
      return function(err, info) {
        var changes;
        log.debug("imap_refreshDeepEnd", limitByBox);
        if (err) {
          return callback(err);
        }
        if (!limitByBox) {
          changes = {
            lastSync: new Date().toISOString()
          };
          if (storeHighestModSeq) {
            changes.lastHighestModSeq = info.highestmodseq;
            changes.lastTotal = info.total;
          }
          return _this.updateAttributes(changes, callback);
        } else {
          return callback(null, info.shouldNotif);
        }
      };
    })(this));
  };

  Mailbox.prototype.getDiff = function(laststep, callback) {
    var box, step;
    log.debug("diff", laststep);
    step = null;
    box = this;
    return this.doLaterWithBox(function(imap, imapbox, cbRelease) {
      step = laststep.getNext(imapbox.uidnext);
      step.highestmodseq = imapbox.highestmodseq;
      step.total = imapbox.messages.total;
      if (step === RefreshStep.finished) {
        return cbRelease(null);
      }
      log.info("IMAP REFRESH", box.label, "UID " + step.min + ":" + step.max);
      return async.series([
        function(cb) {
          return Message.UIDsInRange(box.id, step.min, step.max, cb);
        }, function(cb) {
          return imap.fetchMetadata(step.min, step.max, cb);
        }
      ], cbRelease);
    }, function(err, results) {
      var cozyFlags, cozyIDs, cozyMessage, diff, flagsChange, id, imapFlags, imapMessage, imapUIDs, needApply, toFetch, toRemove, uid;
      log.debug("diff#results");
      if (err) {
        return callback(err);
      }
      if (!results) {
        return callback(null, null, step);
      }
      cozyIDs = results[0], imapUIDs = results[1];
      toFetch = [];
      toRemove = [];
      flagsChange = [];
      for (uid in imapUIDs) {
        imapMessage = imapUIDs[uid];
        cozyMessage = cozyIDs[uid];
        if (cozyMessage) {
          imapFlags = imapMessage[1];
          cozyFlags = cozyMessage[1];
          diff = _.xor(imapFlags, cozyFlags);
          needApply = diff.length > 2 || diff.length === 1 && diff[0] !== '\\Draft';
          if (needApply) {
            id = cozyMessage[0];
            flagsChange.push({
              id: id,
              flags: imapFlags
            });
          }
        } else {
          toFetch.push({
            uid: parseInt(uid),
            mid: imapMessage[0]
          });
        }
      }
      for (uid in cozyIDs) {
        cozyMessage = cozyIDs[uid];
        if (!imapUIDs[uid]) {
          toRemove.push(id = cozyMessage[0]);
        }
      }
      return callback(null, {
        toFetch: toFetch,
        toRemove: toRemove,
        flagsChange: flagsChange
      }, step);
    });
  };

  Mailbox.prototype.applyToRemove = function(toRemove, reporter, callback) {
    log.debug("applyRemove", toRemove.length);
    return async.eachSeries(toRemove, (function(_this) {
      return function(id, cb) {
        return Message.removeFromMailbox(id, _this, function(err) {
          if (err) {
            reporter.onError(err);
          }
          reporter.addProgress(1);
          return cb(null);
        });
      };
    })(this), callback);
  };

  Mailbox.prototype.applyFlagsChanges = function(flagsChange, reporter, callback) {
    log.debug("applyFlagsChanges", flagsChange.length);
    return async.eachSeries(flagsChange, function(change, cb) {
      return Message.applyFlagsChanges(change.id, change.flags, function(err) {
        if (err) {
          reporter.onError(err);
        }
        reporter.addProgress(1);
        return cb(null);
      });
    }, callback);
  };

  Mailbox.prototype.applyToFetch = function(toFetch, reporter, callback) {
    var box, shouldNotif;
    log.debug("applyFetch", toFetch.length);
    box = this;
    toFetch.reverse();
    shouldNotif = false;
    return async.eachSeries(toFetch, function(msg, cb) {
      return Message.fetchOrUpdate(box, msg, function(err, result) {
        if (err) {
          reporter.onError(err);
        }
        reporter.addProgress(1);
        if ((result != null ? result.shouldNotif : void 0) === true) {
          shouldNotif = true;
        }
        return setTimeout((function() {
          return cb(null);
        }), 50);
      });
    }, function(err) {
      return callback(err, shouldNotif);
    });
  };

  Mailbox.prototype.applyOperations = function(ops, isFirstImport, callback) {
    var flagsChange, nbTasks, outShouldNotif, reporter, toFetch, toRemove;
    toFetch = ops.toFetch, toRemove = ops.toRemove, flagsChange = ops.flagsChange;
    nbTasks = toFetch.length + toRemove.length + flagsChange.length;
    outShouldNotif = false;
    if (nbTasks > 0) {
      reporter = ImapReporter.boxFetch(this, nbTasks, isFirstImport);
      return async.series([
        (function(_this) {
          return function(cb) {
            return _this.applyToRemove(toRemove, reporter, cb);
          };
        })(this), (function(_this) {
          return function(cb) {
            return _this.applyFlagsChanges(flagsChange, reporter, cb);
          };
        })(this), (function(_this) {
          return function(cb) {
            return _this.applyToFetch(toFetch, reporter, function(err, shouldNotif) {
              if (err) {
                return cb(err);
              }
              outShouldNotif = shouldNotif;
              return cb(null);
            });
          };
        })(this)
      ], function(err) {
        if (err) {
          reporter.onError(err);
        }
        reporter.onDone();
        return callback(err, outShouldNotif);
      });
    } else {
      return callback(null, outShouldNotif);
    }
  };

  Mailbox.prototype.imap_refreshStep = function(laststep, callback) {
    var box;
    log.debug("imap_refreshStep", laststep);
    box = this;
    return this.getDiff(laststep, (function(_this) {
      return function(err, ops, step) {
        var firstImport, info;
        log.debug("imap_refreshStep#diff", err, ops);
        if (err) {
          return callback(err);
        }
        info = {
          shouldNotif: false,
          total: step.total,
          highestmodseq: step.highestmodseq
        };
        if (!ops) {
          return callback(null, info);
        } else {
          firstImport = laststep.firstImport;
          return _this.applyOperations(ops, firstImport, function(err, shouldNotif) {
            if (err) {
              return callback(err);
            }
            return _this.imap_refreshStep(step, function(err, infoNext) {
              info.shouldNotif = shouldNotif || infoNext.shouldNotif;
              return callback(err, info);
            });
          });
        }
      };
    })(this));
  };

  Mailbox.prototype.imap_UIDByMessageID = function(messageID, callback) {
    return this.doLaterWithBox(function(imap, imapbox, cb) {
      return imap.search([['HEADER', 'MESSAGE-ID', messageID]], cb);
    }, function(err, uids) {
      return callback(err, uids != null ? uids[0] : void 0);
    });
  };

  Mailbox.prototype.imap_UIDs = function(callback) {
    return this.doLaterWithBox(function(imap, imapbox, cb) {
      return imap.fetchBoxMessageUIDs(cb);
    }, function(err, uids) {
      return callback(err, uids);
    });
  };

  Mailbox.prototype.imap_createMailNoDuplicate = function(account, message, callback) {
    var mailbox, messageID;
    messageID = message.headers['message-id'];
    mailbox = this;
    return this.imap_UIDByMessageID(messageID, function(err, uid) {
      if (err) {
        return callback(err);
      }
      if (uid) {
        return callback(null, uid);
      }
      return account.imap_createMail(mailbox, message, callback);
    });
  };

  Mailbox.prototype.imap_removeMail = function(uid, callback) {
    return this.doASAPWithBox(function(imap, imapbox, cbRelease) {
      return async.series([
        function(cb) {
          return imap.addFlags(uid, '\\Deleted', cb);
        }, function(cb) {
          return imap.expunge(uid, cb);
        }, function(cb) {
          return imap.closeBox(cb);
        }
      ], cbRelease);
    }, callback);
  };

  Mailbox.prototype.recoverChangedUIDValidity = function(imap, callback) {
    var box;
    box = this;
    return imap.openBox(this.path, function(err) {
      if (err) {
        return callback(err);
      }
      return imap.fetchBoxMessageIDs(function(err, messages) {
        var reporter, uids;
        uids = Object.keys(messages);
        reporter = ImapReporter.recoverUIDValidty(box, uids.length);
        return async.eachSeries(uids, function(newUID, cb) {
          var messageID;
          messageID = mailutils.normalizeMessageID(messages[newUID]);
          return Message.recoverChangedUID(box, messageID, newUID, function(err) {
            if (err) {
              reporter.onError(err);
            }
            reporter.addProgress(1);
            return cb(null);
          });
        }, function(err) {
          reporter.onDone();
          return callback(null);
        });
      });
    });
  };

  Mailbox.prototype.imap_expungeMails = function(callback) {
    var box;
    box = this;
    return this.doASAPWithBox(function(imap, imapbox, cbRelease) {
      return imap.fetchBoxMessageUIDs(function(err, uids) {
        if (err) {
          return cbRelease(err);
        }
        if (uids.length === 0) {
          return cbRelease(null);
        }
        return async.series([
          function(cb) {
            return imap.addFlags(uids, '\\Deleted', cb);
          }, function(cb) {
            return imap.expunge(uids, cb);
          }, function(cb) {
            return imap.closeBox(cb);
          }, function(cb) {
            return Message.safeRemoveAllFromBox(box.id, function(err) {
              if (err) {
                log.error("fail to remove msg of box " + box.id, err);
              }
              return cb();
            });
          }
        ], cbRelease);
      });
    }, callback);
  };

  Mailbox.prototype.imap_fetchOneMail = function(uid, callback) {
    return this.doLaterWithBox(function(imap, imapbox, cb) {
      return imap.fetchOneMail(uid, cb);
    }, (function(_this) {
      return function(err, mail) {
        var shouldNotif;
        if (err) {
          return callback(err);
        }
        shouldNotif = indexOf.call(mail.flags || [], '\\Seen') >= 0;
        return Message.createFromImapMessage(mail, _this, uid, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, {
            shouldNotif: shouldNotif,
            actuallyAdded: true
          });
        });
      };
    })(this));
  };

  Mailbox.prototype.ignoreInCount = function() {
    var ref, ref1, ref2;
    return (ref = Mailbox.RFC6154.trashMailbox, indexOf.call(this.attribs, ref) >= 0) || (ref1 = Mailbox.RFC6154.junkMailbox, indexOf.call(this.attribs, ref1) >= 0) || ((ref2 = this.guessUse()) === 'trashMailbox' || ref2 === 'junkMailbox');
  };

  return Mailbox;

})(cozydb.CozyModel);

module.exports = Mailbox;

Message = require('./message');

log = require('../utils/logging')({
  prefix: 'models:mailbox'
});

_ = require('lodash');

async = require('async');

mailutils = require('../utils/jwz_tools');

ImapPool = require('../imap/pool');

ImapReporter = require('../imap/reporter');

ref = require('../utils/errors'), Break = ref.Break, NotFound = ref.NotFound;

FETCH_AT_ONCE = require('../utils/constants').FETCH_AT_ONCE;

require('../utils/socket_handler').wrapModel(Mailbox, 'mailbox');

RefreshStep = (function() {
  function RefreshStep() {}

  RefreshStep.finished = {
    symbol: 'DONE'
  };

  RefreshStep.initial = function(options) {
    var step;
    step = new RefreshStep();
    step.limitByBox = options.limitByBox;
    step.firstImport = options.firstImport;
    step.initial = true;
    return step;
  };

  RefreshStep.prototype.inspect = function() {
    return ("Step{ limit:" + this.limitByBox + " ") + (this.initial ? "initial" : "[" + this.min + ":" + this.max + "]") + (this.firstImport ? ' firstImport' : '') + '}';
  };

  RefreshStep.prototype.getNext = function(uidnext) {
    var range, step;
    log.debug("computeNextStep", this, "next", uidnext);
    if (this.initial) {
      this.min = uidnext + 1;
    }
    if (this.min === 1) {
      return RefreshStep.finished;
    }
    if (this.limitByBox && !this.initial) {
      return RefreshStep.finished;
    }
    range = this.limitByBox ? this.limitByBox : FETCH_AT_ONCE;
    step = new RefreshStep();
    step.firstImport = this.firstImport;
    step.limitByBox = this.limitByBox;
    step.max = Math.max(1, this.min - 1);
    step.min = Math.max(1, this.min - range);
    return step;
  };

  return RefreshStep;

})();
