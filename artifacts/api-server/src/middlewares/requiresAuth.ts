import { type NextFunction, type Request, type Response } from "express";

/**
 * Middleware that rejects unauthenticated requests with 401.
 * Mount after authMiddleware so req.isAuthenticated() is populated.
 */
export function requiresAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
