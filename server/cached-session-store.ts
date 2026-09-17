import session from "express-session";

type SessionData = session.SessionData;

/**
 * Thin in-memory cache around a durable session store.
 * Cuts a remote Postgres round-trip on every authenticated API request.
 */
export function createCachedSessionStore(
  backing: session.Store,
  ttlMs = 60_000,
): session.Store {
  const cache = new Map<string, { data: SessionData; expiresAt: number }>();

  const store = new (class CachedSessionStore extends session.Store {
    get(sid: string, cb: (err: any, session?: SessionData | null) => void) {
      const hit = cache.get(sid);
      if (hit && hit.expiresAt > Date.now()) {
        return cb(null, hit.data);
      }
      backing.get(sid, (err, sess) => {
        if (!err && sess) {
          cache.set(sid, { data: sess, expiresAt: Date.now() + ttlMs });
        }
        cb(err, sess ?? null);
      });
    }

    set(sid: string, sess: SessionData, cb?: (err?: any) => void) {
      cache.set(sid, { data: sess, expiresAt: Date.now() + ttlMs });
      backing.set(sid, sess, cb);
    }

    destroy(sid: string, cb?: (err?: any) => void) {
      cache.delete(sid);
      backing.destroy(sid, cb);
    }

    touch(sid: string, sess: SessionData, cb?: (err?: any) => void) {
      cache.set(sid, { data: sess, expiresAt: Date.now() + ttlMs });
      if (typeof (backing as any).touch === "function") {
        return (backing as any).touch(sid, sess, cb);
      }
      backing.set(sid, sess, cb);
    }
  })();

  return store;
}
