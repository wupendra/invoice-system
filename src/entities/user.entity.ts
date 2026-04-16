import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'admin' | 'viewer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ unique: true, length: 255 }) email!: string;
  @Column({ name: 'password_hash', length: 255 }) passwordHash!: string;
  @Column({ type: 'enum', enum: ['admin', 'viewer'] }) role!: UserRole;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
