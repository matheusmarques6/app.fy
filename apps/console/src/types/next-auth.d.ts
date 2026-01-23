import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string;
    accessToken: string;
    accountId: string;
  }

  interface Session {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name?: string;
      accountId: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string;
    accountId: string;
    userId: string;
  }
}
