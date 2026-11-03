import { audit } from "@/lib/server/audit";
import { getIp, handler, json } from "@/lib/server/http";
import { clearAuthCookies, REFRESH_COOKIE, revokeByToken } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (token) await revokeByToken(token);
  audit("auth.logout", { ip: getIp(req) });
  const res = json({ ok: true });
  clearAuthCookies(res);
  return res;
});
