'use client';

// ============================================================================
// BlueVerse landing page
// Next.js 14+ App Router (app/page.jsx) · Tailwind CSS only
//
// A client component because the Two Sides section is a tab switch held in
// local state. Nothing here is fetched per request, so the page still renders
// to static HTML.
//
// One story: an academic writing marketplace. Students post a brief, writers
// bid, the student approves the submission before payment releases.
//
// Sections:
//   1. Navigation Bar
//   2. Hero
//   3. How It Works (#how)
//   4. Two Sides, as tabs (#students / #writers)
//   5. Subjects & Levels (#subjects)
//   6. Why It Is Safe (#trust)
//   7. Final CTA + Footer
//
// Every claim here is something the app does. Subject list and academic levels
// mirror app/dashboard/post-assignment/page.jsx; dispute handling mirrors
// lib/disputes.js and the admin resolve actions; reviews are student-only on
// completed work (app/api/reviews/route.js).
// ============================================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  GraduationCap,
  Mail,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";

// ----------------------------------------------------------------------------
// Shared bits
// ----------------------------------------------------------------------------
const SUBJECTS = [
  "English & Literature",
  "Mathematics",
  "Science",
  "History",
  "Business",
  "Computer Science",
  "Psychology",
  "Nursing",
  "Law",
  "Engineering",
  "Economics",
  "Philosophy",
  "Sociology",
  "Other",
];

const LEVELS = ["High School", "Undergraduate", "Master's", "PhD"];

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brandBlue px-8 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-brandAccent hover:shadow-xl";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-md border-2 border-brandGrid bg-white px-8 py-4 text-lg font-medium text-textDark transition-all duration-200 hover:border-brandNavy hover:bg-brandIce";

// The hero sits on a tinted photograph, so its buttons cannot use the light
// section styles above: a brandBlue button on brandNavy disappears. White
// carries the brand into the dark surface and keeps the label at full contrast.
const heroPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-white px-8 py-4 text-lg font-medium text-brandNavy shadow-lg transition-all duration-200 hover:bg-brandIce hover:shadow-xl";

const heroSecondary =
  "inline-flex items-center justify-center gap-2 rounded-md border-2 border-white/40 bg-white/10 px-8 py-4 text-lg font-medium text-white backdrop-blur-sm transition-all duration-200 hover:border-white/70 hover:bg-white/20";

// ----------------------------------------------------------------------------
// Logo
// ----------------------------------------------------------------------------
function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-90"
      aria-label="BlueVerse home"
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-brandBlue text-lg font-extrabold text-white"
      >
        B
      </span>
      <span className="text-lg font-bold tracking-tight text-brandBlue">BlueVerse</span>
    </Link>
  );
}

// ----------------------------------------------------------------------------
// 1. NAVIGATION BAR
// ----------------------------------------------------------------------------
function Navbar() {
  const links = [
    { href: "#how", label: "How it works" },
    { href: "#subjects", label: "Subjects" },
    { href: "#writers", label: "For writers" },
    { href: "#trust", label: "Why it's safe" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-brandGrid bg-white/90 backdrop-blur-sm">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
        aria-label="Main navigation"
      >
        <Logo />

        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-textBody transition-colors duration-200 hover:text-brandBlue"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="hidden text-sm font-medium text-textBody transition-colors duration-200 hover:text-brandBlue sm:inline-block"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-md bg-brandBlue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brandAccent"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

// ----------------------------------------------------------------------------
// 2. HERO
// ----------------------------------------------------------------------------
function Hero() {
  return (
    <section className="relative overflow-hidden bg-brandNavy" aria-labelledby="hero-heading">
      {/* The photograph is the surface rather than content, so it is decorative:
          an empty alt keeps it out of the accessibility tree, and the gradient
          below is the tint that guarantees the copy stays readable on top. */}
      <Image
        src="/landing/hero-workspace.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-brandNavy via-brandNavy/80 to-brandNavy/95"
      />

      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-brandSky">
            Academic writing marketplace
          </p>

          <h1
            id="hero-heading"
            className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl"
          >
            Post your assignment. Writers bid.{" "}
            <span className="font-playfair font-bold italic text-brandSky">You choose.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-xl text-white/85 md:text-2xl">
            Describe the work, set a budget in US dollars, and compare bids from writers across 14
            subject areas, from High School to PhD. Payment is released only when you approve the
            finished submission.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth/signup" className={heroPrimary}>
              Post an assignment
            </Link>
            <Link href="/auth/signup?role=writer" className={heroSecondary}>
              Start writing
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>

          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/75"
            aria-label="What BlueVerse guarantees"
          >
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-brandSky" aria-hidden="true" />
              Verified writer accounts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-brandSky" aria-hidden="true" />
              Bids you compare yourself
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-brandSky" aria-hidden="true" />
              Disputes settled by administrators
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 3. HOW IT WORKS (#how)
// ----------------------------------------------------------------------------
function HowItWorks() {
  const steps = [
    {
      icon: ClipboardList,
      title: "Post the brief",
      text: "Pick the subject and academic level, set the length and deadline, and give writers a budget range in USD to bid inside.",
    },
    {
      icon: Search,
      title: "Compare the bids",
      text: "Your assignment appears in the open work feed. Writers bid their own price, and you see every bid alongside the writer's rating.",
    },
    {
      icon: MessageSquare,
      title: "Work in one thread",
      text: "Once you accept a bid the assignment is assigned. Messages, submitted files and revision notes all stay on that assignment.",
    },
    {
      icon: Check,
      title: "Approve, or send it back",
      text: "Approve the submission to complete the assignment and release payment, or send it back with written feedback for another pass.",
    },
  ];

  return (
    <section id="how" className="scroll-mt-24 border-y border-brandGrid bg-white py-24" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-brandBlue">
            The process
          </p>
          <h2 id="how-heading" className="text-4xl font-bold text-brandNavy">
            From a brief to approved work
          </h2>
          <p className="mt-4 text-textBody">Four steps, and you can stop at any of them.</p>
        </div>

        <ol className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li
                key={step.title}
                className="rounded-xl border border-brandGrid bg-brandIce p-8 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-brandBlue/10 text-brandBlue"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-wider text-textMuted">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-brandNavy">{step.title}</h3>
                <p className="mt-3 text-sm text-textBody">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 4. TWO SIDES (#students / #writers), as tabs
// ----------------------------------------------------------------------------
function Audiences() {
  const [side, setSide] = useState("student");

  // The navigation's "For writers" link points at #writers, the zero-height
  // anchor at the top of this section. Reading the hash means the link opens
  // the writer tab rather than whichever panel happens to be the default.
  useEffect(() => {
    const applyHash = () => {
      if (window.location.hash === "#writers") setSide("writer");
      else if (window.location.hash === "#students") setSide("student");
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // Keep the address bar in step with the open tab so the link can be shared.
  // replaceState does not scroll the way following an href would.
  const select = (next) => {
    setSide(next);
    window.history.replaceState(null, "", `#${next === "student" ? "students" : "writers"}`);
  };

  // Two tabs, so either arrow key moves to the other one.
  const handleTabKeys = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = side === "student" ? "writer" : "student";
    select(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const sides = {
    student: {
      tab: "Student",
      eyebrow: "For students",
      heading: "If you need the",
      accent: "work done",
      blurb:
        "You keep control of the price and the decision. No subscription, no package to buy up front.",
      points: [
        "Post in any of 14 subject areas, at High School, Undergraduate, Master's or PhD level.",
        "Set a budget range and let writers bid inside it instead of chasing quotes by email.",
        "Compare every bid on price and the writer's rating before you choose.",
        "Read the submission and ask for revisions with written feedback before approving.",
        "Open a dispute if work is undelivered, a deadline is missed or the work is off brief. An administrator decides the outcome.",
      ],
      cta: { label: "Post an assignment", href: "/auth/signup" },
      more: { label: "See how it works", href: "#how" },
      image: {
        src: "/landing/student-studying.jpg",
        alt: "A student working at a library desk with a laptop, notebooks and printed notes",
      },
      detail: {
        title: "What your brief carries",
        tags: ["Subject", "Level", "Pages or words", "Deadline", "Budget in USD"],
      },
    },
    writer: {
      tab: "Writer",
      eyebrow: "For writers",
      heading: "If you write for a",
      accent: "living",
      blurb:
        "You choose what to bid on, and you name your price. Students come to you with the brief already written.",
      points: [
        "Browse open assignments and bid your own price on the ones that fit your subject.",
        "Deliver through the submission form; resubmit as many times as the brief needs.",
        "Keep messages, files and revision notes attached to the assignment, not your inbox.",
        "Build a rating and completed-job count that students see next to your bid.",
        "Use the same dispute process as students if a payment decision goes wrong.",
      ],
      cta: { label: "Start writing", href: "/auth/signup?role=writer" },
      more: { label: "See the subjects", href: "#subjects" },
      image: {
        src: "/landing/writer-working.jpg",
        alt: "A writer working at a desk beside a window, with a laptop, notebook and pen",
      },
      detail: {
        title: "What the student compares",
        tags: ["Your price", "Delivery date", "Your rating", "Completed jobs"],
      },
    },
  };

  const current = sides[side];

  return (
    <section
      id="sides"
      className="scroll-mt-24 bg-brandIce py-24"
      aria-labelledby="audiences-heading"
    >
      {/* Target for the navigation's "For writers" link, so it can open the tab. */}
      <span id="writers" className="block h-0 scroll-mt-24" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-brandBlue">
            Two sides
          </p>
          <h2 id="audiences-heading" className="text-4xl font-bold text-brandNavy">
            One marketplace, two jobs
          </h2>
          <p className="mt-4 text-textBody">
            Students need the work done. Writers need the work. BlueVerse is where the two meet.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Choose which side of BlueVerse to read about"
          onKeyDown={handleTabKeys}
          className="mx-auto mt-10 flex w-fit gap-1 rounded-full border border-brandGrid bg-white p-1.5 shadow-sm"
        >
          {Object.entries(sides).map(([key, value]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={side === key}
              aria-controls="sides-panel"
              tabIndex={side === key ? 0 : -1}
              onClick={() => select(key)}
              className={`rounded-full px-7 py-2.5 text-sm font-medium transition-colors duration-200 ${
                side === key
                  ? "bg-brandNavy text-white shadow-sm"
                  : "text-textBody hover:text-brandNavy"
              }`}
            >
              {value.tab}
            </button>
          ))}
        </div>

        <div
          id="sides-panel"
          role="tabpanel"
          aria-labelledby={`tab-${side}`}
          tabIndex={0}
          className="mt-10 overflow-hidden rounded-3xl border border-brandGrid bg-white shadow-sm lg:grid lg:grid-cols-5"
        >
          <div className="p-7 sm:p-10 lg:col-span-3 lg:p-12">
            <p className="inline-flex items-center rounded-full border border-brandGrid bg-brandIce px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brandBlue">
              {current.eyebrow}
            </p>

            <h3 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-brandNavy sm:text-4xl">
              {current.heading}
              <span className="block text-brandBlue">{current.accent}</span>
            </h3>

            <p className="mt-5 max-w-lg text-lg text-textBody">{current.blurb}</p>

            <ul className="mt-7 space-y-3">
              {current.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm text-textBody">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brandBlue" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={current.cta.href}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-brandBlue px-7 py-3.5 text-base font-medium text-white shadow-lg transition-all duration-200 hover:bg-brandAccent hover:shadow-xl"
              >
                {current.cta.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href={current.more.href}
                className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-brandGrid px-7 py-3.5 text-base font-medium text-textDark transition-all duration-200 hover:border-brandNavy hover:bg-brandIce"
              >
                {current.more.label}
              </a>
            </div>

            <p className="mt-6 text-sm text-textMuted">
              Already have an account?{" "}
              <Link
                href="/auth/signin"
                className="font-medium text-brandBlue transition-colors hover:text-brandAccent"
              >
                Log in
              </Link>
            </p>
          </div>

          <div className="flex flex-col justify-center border-t border-brandGrid bg-brandIce p-6 sm:p-8 lg:col-span-2 lg:border-l lg:border-t-0">
            <div className="overflow-hidden rounded-2xl border border-brandGrid shadow-sm">
              <Image
                src={current.image.src}
                alt={current.image.alt}
                width={1536}
                height={1024}
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="h-auto w-full"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-brandGrid bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-textMuted">
                {current.detail.title}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {current.detail.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-brandGrid bg-brandIce px-3 py-1 text-xs font-medium text-textBody"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 5. SUBJECTS & LEVELS (#subjects)
//
// Copy on the left, the four academic levels as a diagram on the right. The
// left column animates once, the first time it scrolls into view.
// ----------------------------------------------------------------------------
function useRevealOnce() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion: skip the reveal entirely and start at the finished state.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    // Measuring on scroll rather than with IntersectionObserver. The check is a
    // single rect read, and running it once on mount means a restored scroll
    // position, or a section already on screen, reveals without waiting for an
    // event. Nothing can leave the column stuck invisible.
    const check = () => {
      const rect = node.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.85 || rect.bottom < 0) return;

      setShown(true);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);

    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return [ref, shown];
}

function Subjects() {
  const [revealRef, shown] = useRevealOnce();

  // The four levels sit at the corners of a square canvas. The connectors are
  // drawn in the same 0-100 space as the card percentages, so the lines meet
  // the cards at every width without measuring anything at runtime.
  const nodes = [
    { left: 16, top: 16 },
    { left: 84, top: 16 },
    { left: 16, top: 84 },
    { left: 84, top: 84 },
  ];

  // One class set per animated block: hidden until the section is in view, then
  // a staggered rise. `animationDelay` is harmless while it is still hidden.
  const reveal = (delay, base) => ({
    className: `${base} ${shown ? "animate-rise motion-reduce:animate-none" : "opacity-0"}`,
    style: { animationDelay: `${delay}ms` },
  });

  return (
    <section
      id="subjects"
      className="scroll-mt-24 border-y border-brandGrid bg-white py-24"
      aria-labelledby="subjects-heading"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:px-8">
        <div ref={revealRef}>
          <p
            {...reveal(
              0,
              "inline-flex items-center rounded-full border border-brandGrid bg-brandIce px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brandBlue"
            )}
          >
            Coverage
          </p>

          <h2
            id="subjects-heading"
            {...reveal(
              90,
              "mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-brandNavy sm:text-5xl"
            )}
          >
            Every subject,
            <span className="block text-brandBlue">every level</span>
          </h2>

          <p {...reveal(180, "mt-6 max-w-xl text-lg text-textBody")}>
            The subject list you pick from when posting, and the academic levels writers see on the
            brief.
          </p>

          <ul className="mt-8 flex max-w-xl flex-wrap gap-2">
            {SUBJECTS.map((subject, index) => (
              <li
                key={subject}
                className={`rounded-full border border-brandGrid bg-brandIce px-4 py-2 text-sm font-medium text-textBody ${
                  shown ? "animate-pop motion-reduce:animate-none" : "opacity-0"
                }`}
                style={{ animationDelay: `${320 + index * 45}ms` }}
              >
                {subject}
              </li>
            ))}
          </ul>

          <div {...reveal(320 + SUBJECTS.length * 45, "mt-9 flex flex-col gap-3 sm:flex-row")}>
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brandBlue px-7 py-3.5 text-base font-medium text-white shadow-lg transition-all duration-200 hover:bg-brandAccent hover:shadow-xl"
            >
              Post an assignment
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-brandGrid px-7 py-3.5 text-base font-medium text-textDark transition-all duration-200 hover:border-brandNavy hover:bg-brandIce"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-lg">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full text-brandBlue/30"
            aria-hidden="true"
          >
            {nodes.map((node) => (
              <line
                key={`${node.left}-${node.top}`}
                x1="50"
                y1="50"
                x2={node.left}
                y2={node.top}
                stroke="currentColor"
                strokeWidth="0.4"
                strokeDasharray="2.5 2.5"
                strokeLinecap="round"
                className="animate-dash motion-reduce:animate-none"
              />
            ))}
          </svg>

          <div className="absolute left-1/2 top-1/2 w-[7.5rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-brandNavy px-3 py-3.5 text-center shadow-lg sm:w-[9rem]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brandSky">
              Your brief
            </p>
            <p className="mt-1 text-[11px] leading-snug text-white/75">one subject, one level</p>
          </div>

          {LEVELS.map((level, index) => (
            <div
              key={level}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${nodes[index].left}%`, top: `${nodes[index].top}%` }}
            >
              <div className="flex w-[5.25rem] flex-col items-center gap-1.5 rounded-2xl border border-brandGrid bg-white px-2 py-3 text-center shadow-sm sm:w-[7.5rem]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandIce text-brandBlue">
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-brandNavy sm:text-xs">
                  {level}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 6. WHY IT IS SAFE (#trust)
// ----------------------------------------------------------------------------
function Trust() {
  const items = [
    {
      icon: BadgeCheck,
      title: "Verification comes from a person",
      text: "An administrator grants the verified badge. A writer cannot give it to themselves, and it sits next to their rating on every bid.",
    },
    {
      icon: ShieldCheck,
      title: "The price is the bid you accepted",
      text: "Accepting a bid fixes the price for that assignment. There is no invoice later for more than the number you agreed to.",
    },
    {
      icon: Scale,
      title: "Disputes go to an administrator",
      text: "Either side can raise one: not delivered, off brief, below standard, missed deadline or a stalled approval. An administrator releases the funds, refunds or cancels.",
    },
    {
      icon: Star,
      title: "Ratings come from finished work",
      text: "Only the student on a completed assignment can rate the writer, one review per assignment. The average and the completed-job count are recalculated from those reviews.",
    },
  ];

  return (
    <section id="trust" className="scroll-mt-24 bg-brandNavy py-24" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-blue-200">
            Trust
          </p>
          <h2 id="trust-heading" className="text-4xl font-bold text-white">
            Why it is safe to post here
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/5 p-8"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-bold text-white">{item.title}</h3>
                </div>
                <p className="mt-4 text-sm text-blue-100">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 7. FINAL CTA + FOOTER
// ----------------------------------------------------------------------------
function FinalCTA() {
  // Footer links only ever point at sections of this page or pages that exist.
  const platformLinks = [
    { href: "#how", label: "How it works" },
    { href: "#subjects", label: "Subjects and levels" },
    { href: "#trust", label: "Why it is safe" },
  ];

  const startLinks = [
    { href: "/auth/signup", label: "Post an assignment" },
    { href: "/auth/signup?role=writer", label: "Start writing" },
    { href: "/auth/signin", label: "Log in" },
  ];

  return (
    <footer id="contact" className="scroll-mt-24 bg-brandIce">
      <div className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-8">
        <h2 className="text-4xl font-bold text-brandNavy">
          Ready to post your first assignment?
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-xl text-textBody">
          Creating an account is free. Write the brief, watch the bids come in, and decide who does
          the work.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/auth/signup" className={primaryButton}>
            Create a free account
          </Link>
          <Link href="/auth/signup?role=writer" className={secondaryButton}>
            I am a writer
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="border-t border-brandGrid">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="sm:col-span-2 lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-textBody">
              An academic writing marketplace: students post a brief, writers bid, and payment is
              released only when the work is approved.
            </p>
            <a
              href="mailto:support@blueverse.com"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brandBlue transition-colors duration-200 hover:text-brandAccent"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              support@blueverse.com
            </a>
          </div>

          <nav aria-label="Platform">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">
              Platform
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-textBody transition-colors duration-200 hover:text-brandBlue"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Get started">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">
              Get started
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {startLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-textBody transition-colors duration-200 hover:text-brandBlue"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-brandGrid py-6">
        <p className="text-center text-sm text-textMuted">
          © 2026 BlueVerse. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ----------------------------------------------------------------------------
// PAGE EXPORT
// ----------------------------------------------------------------------------
export default function Page() {
  return (
    <main>
      <Navbar />
      <Hero />
      <HowItWorks />
      <Audiences />
      <Subjects />
      <Trust />
      <FinalCTA />
    </main>
  );
}
