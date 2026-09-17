import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Section } from "@/components/marketing/Section";
import { TodayPreview } from "@/components/marketing/TodayPreview";
import {
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  ChartIcon,
  ListIcon,
  NoteIcon,
  RepeatIcon,
  TargetIcon,
} from "@/components/icons";

const LOOP = ["Goal", "Milestone", "Routine", "Daily task", "Completion", "Reflection", "Progress"];

const QUESTIONS = [
  "What am I trying to become?",
  "What should I do today?",
  "Did I do it?",
  "What did I learn?",
  "Am I becoming better over time?",
];

const FEATURES = [
  {
    icon: TargetIcon,
    title: "Goals and milestones",
    body: "Break a two-year ambition into milestones that connect to what you do this week.",
  },
  {
    icon: RepeatIcon,
    title: "Routines",
    body: "Define a routine once and let it generate the right tasks on the right days.",
  },
  {
    icon: ListIcon,
    title: "Daily tasks",
    body: "One clear list, ordered by when it matters. Complete, skip, or move it on.",
  },
  {
    icon: CalendarIcon,
    title: "Planner",
    body: "Move between day, week and month without losing sight of the goal underneath.",
  },
  {
    icon: NoteIcon,
    title: "Notes and reflection",
    body: "A short daily review: what worked, what did not, what to change tomorrow.",
  },
  {
    icon: ChartIcon,
    title: "Honest progress",
    body: "Completion rates, routine consistency and streaks — calculated transparently.",
  },
];

export default async function LandingPage() {
  // A signed-in visitor asking for "/" wants their day, not the pitch.
  if (await getAccessToken()) {
    redirect("/dashboard");
  }

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* ------------------------------------------------------------ hero -- */}
        <div className="relative overflow-hidden">
          {/* A single soft wash behind the hero, so the fold has depth without
              anything competing with the headline. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_50%,var(--color-accent-soft),transparent_70%)] opacity-80"
          />

          <div className="relative mx-auto grid max-w-[90rem] gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:grid-cols-[1.05fr_minmax(0,34rem)] lg:items-center lg:gap-16 lg:px-8 lg:pt-20 lg:pb-28 2xl:px-12">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
                <span className="size-1.5 rounded-full bg-accent" />
                Personal improvement, made visible
              </p>

              <h1 className="mt-6 max-w-[16ch] text-[2.125rem] leading-[1.1] font-semibold sm:text-5xl lg:text-[3.5rem] lg:leading-[1.06] 2xl:text-[4rem]">
                Turn long-term goals into daily actions.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
                Routine connects what you are trying to become to what you actually
                do today — then shows you, honestly, whether it is working.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href="/register" className="btn btn-primary w-full px-5 py-3 sm:w-auto">
                  Start with one goal
                  <ArrowRightIcon className="size-4" />
                </Link>
                <Link href="/login" className="btn btn-secondary w-full px-5 py-3 sm:w-auto">
                  Sign in
                </Link>
              </div>

              <p className="mt-5 text-sm text-faint">
                Free to start. No credit card, no setup call, no onboarding maze.
              </p>
            </div>

            <div className="animate-rise [animation-delay:120ms] mx-auto w-full max-w-md lg:mx-0 lg:max-w-none lg:pl-4">
              <TodayPreview />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ loop -- */}
        <Section
          eyebrow="How it works"
          title="One loop, end to end."
          lead="Most tools hold one piece of this and leave you to carry the rest between apps. Routine keeps the whole chain in one place, so the connection between Tuesday and two years from now stays visible."
        >
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {LOOP.map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium shadow-card">
                  {step}
                </span>
                {index < LOOP.length - 1 ? (
                  <ArrowRightIcon className="size-4 shrink-0 text-faint" />
                ) : null}
              </li>
            ))}
          </ol>
        </Section>

        {/* -------------------------------------------------------- features -- */}
        <Section
          eyebrow="What you get"
          title="Everything the loop needs. Nothing it doesn't."
          lead="Six pieces, each earning its place. No social feed, no gamification, no AI coach until the core is proven."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="card p-6 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-medium">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------- questions -- */}
        <div className="border-y border-line bg-surface">
          <Section
            eyebrow="The point"
            title="Five questions worth being able to answer."
            lead="If a productivity tool cannot help you answer these, it is a list — and you already have lists."
          >
            <ol className="grid gap-4 sm:grid-cols-2 lg:gap-5">
              {QUESTIONS.map((question, index) => (
                <li
                  key={question}
                  className="flex items-baseline gap-4 rounded-card border border-line bg-canvas px-4 py-4 sm:px-5"
                >
                  <span className="text-sm font-medium tabular-nums text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[0.9375rem] sm:text-[1.0625rem]">{question}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        {/* ----------------------------------------------------- positioning -- */}
        <Section>
          <figure className="mx-auto max-w-3xl text-center">
            <blockquote className="text-xl leading-snug font-medium sm:text-2xl lg:text-[2rem]">
              Routine is not another to-do list. It is a personal improvement
              system that turns long-term goals into daily actions.
            </blockquote>
            <figcaption className="mt-5 text-sm text-muted">
              The distinction that guides every design decision here.
            </figcaption>
          </figure>
        </Section>

        {/* -------------------------------------------------------------- cta -- */}
        <Section className="pt-0">
          <div className="card relative overflow-hidden px-5 py-12 text-center sm:px-12 sm:py-14">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_0%,var(--color-accent-soft),transparent_70%)]"
            />
            <div className="relative">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-ink mx-auto">
                <BellIcon className="size-5" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold sm:text-3xl">Start with one goal.</h2>
              <p className="mx-auto mt-3 max-w-md text-muted">
                The rest follows from it — milestones, a routine, and the first
                task you will actually do tomorrow morning.
              </p>
              <Link href="/register" className="btn btn-primary mt-7 w-full px-5 py-3 sm:w-auto">
                Create your account
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
