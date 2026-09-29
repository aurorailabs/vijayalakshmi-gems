import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync("not-a-login-password", 10);
const attempts = new Map();

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function checkPassword(password, hash) {
  return bcrypt.compareSync(String(password), hash || DUMMY_HASH);
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function phoneKey(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function isEmail(value) {
  return EMAIL.test(String(value || "").trim());
}

export function isPhone(value) {
  const key = phoneKey(value);
  return key.length >= 10 && key.length <= 15 && !String(value || "").includes("@");
}

export function registrationError({ name, email, password, phone }) {
  if (!String(name || "").trim() || String(name).trim().length < 2) return { field: "name", error: "Enter your name." };
  if (!isEmail(email)) return { field: "email", error: "Enter a valid email." };
  if (!isPhone(phone)) return { field: "phone", error: "Enter a valid phone number." };
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || password.length < 8) {
    return { field: "password", error: "Password must be at least 8 characters and include a letter and a number." };
  }
  return null;
}

export function signUser(user) {
  return jwt.sign(
    { sub: String(user.id), id: user.id, role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function tooManyAttempts(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((at) => now - at < 15 * 60 * 1000);
  attempts.set(key, recent);
  return recent.length >= 8;
}

export function recordAttempt(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((at) => now - at < 15 * 60 * 1000);
  recent.push(now);
  attempts.set(key, recent);
}

export function clearAttempts(key) {
  attempts.delete(key);
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
  };
}

export function attachUser(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in required" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
