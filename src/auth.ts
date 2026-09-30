
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type Role = "staff" | "doctor";
export interface AuthUser { role: Role; email: string; }

const TOKEN_TTL_SECONDS = 60 * 60 * 8;
function configuredUser(role: Role) {
  return role === "staff"
    ? { email: process.env.HOSPITAL_STAFF_EMAIL, password: process.env.HOSPITAL_STAFF_PASSWORD }
    : { email: process.env.DOCTOR_LOGIN_EMAIL, password: process.env.DOCTOR_LOGIN_PASSWORD };
}
function secret() { return process.env.AUTH_TOKEN_SECRET ?? ""; }
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }

export function authenticate(email: string, password: string, role: Role): AuthUser | undefined {
  const configured = configuredUser(role);
  if (!configured.email || !configured.password || !secret()) return undefined;
  const passwordHash = scryptSync(password, "hospital-login-v1", 32);
  const expectedHash = scryptSync(configured.password, "hospital-login-v1", 32);
  if (email.trim().toLowerCase() !== configured.email.toLowerCase() || !timingSafeEqual(passwordHash, expectedHash)) return undefined;
  return { role, email: configured.email };
}

export function createToken(user: AuthUser): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || !secret()) return res.status(401).json({ error: "Please sign in to continue." });
    const [payload, supplied, extra] = token.split(".");
    const expected = signature(payload ?? "");
    const suppliedBytes = Buffer.from(supplied ?? "");
    const expectedBytes = Buffer.from(expected);
    if (!payload || !supplied || extra || suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes))
      return res.status(401).json({ error: "Your session is invalid. Please sign in again." });
    try {
      const user = JSON.parse(Buffer.from(payload, "base64url").toString()) as AuthUser & { exp: number };
      if (user.exp <= Date.now() / 1000) return res.status(401).json({ error: "Your session expired. Please sign in again." });
      if (!roles.includes(user.role)) return res.status(403).json({ error: "You are not authorized to perform this action." });
      (req as Request & { authUser?: AuthUser }).authUser = user;
      next();
    } catch {
      return res.status(401).json({ error: "Your session is invalid. Please sign in again." });
    }
  };
}
