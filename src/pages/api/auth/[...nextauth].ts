import NextAuth from "next-auth";

import { authOptions } from "@/modules/auth/infrastructure/next-auth/auth-options";

export default NextAuth(authOptions);
