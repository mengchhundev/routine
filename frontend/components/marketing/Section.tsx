/** Consistent vertical rhythm and heading treatment across every section. */
export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto max-w-[90rem] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24 2xl:px-12 ${className}`}
    >
      {title ? (
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">{eyebrow}</p>
          ) : null}
          <h2 className="mt-3 text-[1.625rem] leading-tight font-semibold sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          {lead ? <p className="mt-4 text-base leading-relaxed text-muted sm:text-[1.0625rem]">{lead}</p> : null}
        </div>
      ) : null}

      <div className={title ? "mt-10 sm:mt-12" : ""}>{children}</div>
    </section>
  );
}
