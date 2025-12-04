import { IAuthProvider } from '../types';

export abstract class BaseAuthProvider implements IAuthProvider {
  abstract checkPermission(
    userId: string,
    roomId: string,
    action: string
  ): Promise<boolean>;

  abstract getAuthorizedUsersInRoom(roomId: string): Promise<string[]>;
}

export class MemoryAuthProvider extends BaseAuthProvider {
  private permissions: Map<string, Set<string>>;
  private roomUsers: Map<string, Set<string>>;

  constructor() {
    super();
    this.permissions = new Map();
    this.roomUsers = new Map();
  }

  private getPermissionKey(userId: string, roomId: string, action: string): string {
    return `${userId}:${roomId}:${action}`;
  }

  public grantPermission(userId: string, roomId: string, action: string): void {
    const key = this.getPermissionKey(userId, roomId, action);
    if (!this.permissions.has(key)) {
      this.permissions.set(key, new Set());
    }
    this.permissions.get(key)!.add(action);
  }

  public revokePermission(userId: string, roomId: string, action: string): void {
    const key = this.getPermissionKey(userId, roomId, action);
    this.permissions.delete(key);
  }

  public addUserToRoom(userId: string, roomId: string): void {
    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Set());
    }
    this.roomUsers.get(roomId)!.add(userId);
  }

  public removeUserFromRoom(userId: string, roomId: string): void {
    const users = this.roomUsers.get(roomId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        this.roomUsers.delete(roomId);
      }
    }
  }

  public async checkPermission(
    userId: string,
    roomId: string,
    action: string
  ): Promise<boolean> {
    const key = this.getPermissionKey(userId, roomId, action);
    return this.permissions.has(key);
  }

  public async getAuthorizedUsersInRoom(roomId: string): Promise<string[]> {
    const users = this.roomUsers.get(roomId);
    return users ? Array.from(users) : [];
  }
}
