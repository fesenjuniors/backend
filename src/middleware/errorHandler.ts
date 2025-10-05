import type { Request, Response, NextFunction } from "express";

/**
 * Global error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error("Unhandled error:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Don't expose internal errors to client
  res.status(500).json({
    error: "Internal server error",
    details: "An unexpected error occurred. Please try again.",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation helper
 */
export function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check if body exists and is valid JSON
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({
        error: "Invalid request body",
        details: "Request body must be a valid JSON object",
      });
      return;
    }
  }

  next();
}

/**
 * Input sanitization
 */
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    return input.trim();
  }
  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

/**
 * Validate string input
 */
export function validateString(
  value: any,
  fieldName: string,
  options: {
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
  } = {}
): { isValid: boolean; error?: string } {
  const { required = true, maxLength = 100, minLength = 1, pattern } = options;

  if (required && (!value || value === "")) {
    return {
      isValid: false,
      error: `${fieldName} is required`,
    };
  }

  if (value && typeof value !== "string") {
    return {
      isValid: false,
      error: `${fieldName} must be a string`,
    };
  }

  if (value) {
    const trimmed = value.trim();

    if (required && trimmed.length === 0) {
      return {
        isValid: false,
        error: `${fieldName} cannot be empty`,
      };
    }

    if (trimmed.length > maxLength) {
      return {
        isValid: false,
        error: `${fieldName} must be ${maxLength} characters or less`,
      };
    }

    if (trimmed.length < minLength) {
      return {
        isValid: false,
        error: `${fieldName} must be at least ${minLength} characters`,
      };
    }

    if (pattern && !pattern.test(trimmed)) {
      return {
        isValid: false,
        error: `${fieldName} format is invalid`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Safe JSON response helper
 */
export function safeJsonResponse(
  res: Response,
  statusCode: number,
  data: any
): void {
  try {
    res.status(statusCode).json(data);
  } catch (error) {
    console.error("Error sending JSON response:", error);
    res.status(500).json({
      error: "Response error",
      details: "Failed to send response",
    });
  }
}
