// =============================================================================
// Typed Forbidden Error for the Authorisation Layer
// =============================================================================

export interface ForbiddenErrorDetails {
  reason: string;
  requiredPermission?: string;
  matterId?: string;
  requiredLevel?: "VIEW" | "EDIT" | "MANAGE";
  entityType?: string;
  entityId?: string;
}

export class ForbiddenError extends Error {
  public readonly code = "FORBIDDEN";
  public readonly details?: ForbiddenErrorDetails;

  constructor(message: string, details?: ForbiddenErrorDetails) {
    super(message);
    this.name = "ForbiddenError";
    this.details = details;
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class NotFoundError extends Error {
  public readonly code = "NOT_FOUND";
  public readonly details?: Record<string, any>;

  constructor(message: string, details?: Record<string, any>) {
    super(message);
    this.name = "NotFoundError";
    this.details = details;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

