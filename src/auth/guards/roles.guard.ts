import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../roles.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Role hierarchy: SUPER_ADMIN > OWNER > MANAGER > CASHIER
const roleHierarchy: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 4,
  [Role.OWNER]: 3,
  [Role.MANAGER]: 2,
  [Role.CASHIER]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    const userLevel = roleHierarchy[user.role as Role] ?? 0;
    const minRequired = Math.min(
      ...requiredRoles.map((r) => roleHierarchy[r] ?? 99),
    );

    return userLevel >= minRequired;
  }
}
