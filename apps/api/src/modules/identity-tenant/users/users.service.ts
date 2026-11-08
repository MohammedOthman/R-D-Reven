import { Injectable } from '@nestjs/common';
import { prisma, type User } from '@revn/db';

@Injectable()
export class UsersService {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    return prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<User> {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
