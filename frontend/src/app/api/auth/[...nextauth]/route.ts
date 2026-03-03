import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

console.log("NextAuth handler:", typeof handler, handler)

export { handler as GET, handler as POST }

