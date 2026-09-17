import Link from "next/link";
import { TargetIcon } from "@/components/icons";

export default function GoalNotFound() {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
        <TargetIcon className="size-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">That goal is not here.</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        It may have been deleted, or the link may belong to a different account.
      </p>
      <Link href="/goals" className="btn btn-primary mt-5 px-4 py-2">
        Back to goals
      </Link>
    </div>
  );
}
