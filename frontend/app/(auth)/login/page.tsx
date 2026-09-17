import { Suspense } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to pick up today's plan."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register" className="font-medium text-accent transition-opacity hover:opacity-80">
            Create one
          </Link>
        </>
      }
    >
      {/* useSearchParams needs a suspense boundary to keep the page static. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
