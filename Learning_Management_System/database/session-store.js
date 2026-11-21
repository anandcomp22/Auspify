const session = require('express-session');

/**
 * Pure SQLite Session Store utilizing Node 22 built-in node:sqlite
 * Zero native C++ compilation dependencies. Fast, persistent, and robust.
 */
class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.getStmt = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?');
    this.setStmt = this.db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)');
    this.destroyStmt = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = this.db.prepare('UPDATE sessions SET expired_at = ? WHERE sid = ?');
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid, Date.now());
      if (!row) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 1000 * 60 * 60 * 24 * 7;
      const expiredAt = Date.now() + maxAge;
      this.setStmt.run(sid, JSON.stringify(sess), expiredAt);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.destroyStmt.run(sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  touch(sid, sess, callback) {
    try {
      const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 1000 * 60 * 60 * 24 * 7;
      const expiredAt = Date.now() + maxAge;
      this.touchStmt.run(expiredAt, sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

module.exports = SqliteSessionStore;
