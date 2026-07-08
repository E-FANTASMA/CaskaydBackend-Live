export interface AuthenticatedUser {
  sub: string;
  email: string;
  fullName: string;
  role?: string;
  tokenType?: 'access' | 'refresh';
}
