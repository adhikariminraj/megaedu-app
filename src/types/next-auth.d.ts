// Role is a plain String in the database (see schema.prisma for why), so
// we define the allowed values here as a TypeScript union instead of
// importing a Prisma enum type.
export type Role =
  | "PLATFORM_ADMIN"
  | "SCHOOL_ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "ORGANIZATION_ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      roles: Role[];
    };
  }
  interface User {
    id: string;
    roles: Role[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roles: Role[];
  }
}
