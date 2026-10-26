import { Role, UserStatus } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  branch_id: string | null;
  managerial_access: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      branchId?: string | null;
    }
  }
}
