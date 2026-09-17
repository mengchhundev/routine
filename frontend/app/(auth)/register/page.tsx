import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start with one goal. The rest follows from it."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent transition-opacity hover:opacity-80">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
