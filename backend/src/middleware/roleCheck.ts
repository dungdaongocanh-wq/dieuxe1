// Middleware phân quyền theo vai trò (4 cấp độ)
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Kiểm tra quyền hạn theo danh sách vai trò được phép
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Chưa đăng nhập' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        message: 'Bạn không có quyền thực hiện thao tác này',
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
};

// Các quyền hạn được định nghĩa sẵn
export const isAdmin = requireRole('admin');
export const isAdminOrAccountant = requireRole('admin', 'accountant');
export const isAdminOrFleetManager = requireRole('admin', 'fleet_manager');
export const canManageSchedule = requireRole('admin', 'fleet_manager', 'driver');
export const canViewSchedule = requireRole('admin', 'accountant', 'fleet_manager', 'driver');
