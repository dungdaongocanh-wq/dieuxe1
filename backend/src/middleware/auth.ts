// Middleware xác thực JWT
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mở rộng interface Request để thêm thông tin user
export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    fullName: string;
    role: string;
  };
}

// Middleware kiểm tra JWT token
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Không có token xác thực' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET chưa được cấu hình');
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      id: number;
      username: string;
      fullName: string;
      role: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};
