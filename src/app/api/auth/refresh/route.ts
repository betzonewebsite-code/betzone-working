import { getIp, getUA, handler, HttpError, json } from "@/lib/server/http";
import { clearAuthCookies, REFRESH_COOKIE, rotateSession, setAuthCookies } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) throw new HttpError(401, "Please log in.", "UNAUTHENTICATED");
  try {
    const res = json({ ok: true });
    setAuthCookies(res, await rotateSession(token, { ip: getIp(req), ua: getUA(req) }));
    return res;
  } catch (e) {
    if (e instanceof HttpError && e.code === "SESSION_EXPIRED") {
      const res = json({ error: e.message, code: e.code }, 401);
      clearAuthCookies(res);
      return res;
    }
    throw e;
  }
});
