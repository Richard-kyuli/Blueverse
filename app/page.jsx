// ============================================================================
// BlueVerse Co. — Landing Page
// Next.js 14+ App Router (app/page.jsx) · Tailwind CSS only
// Sections:
//   1. Navigation Bar
//   2. Hero Section
//   3. Authority Banner
//   4. Core Services (#services)
//   5. Why Clients Work With Me (#why)
//   6. Featured Work & Case Studies (#work)
//   7. Final CTA + Footer
// ============================================================================

import Link from "next/link";

// ----------------------------------------------------------------------------
// Logo
// ----------------------------------------------------------------------------
function Logo() {
  return (
    <Link
      href="#"
      className="flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-90"
      aria-label="BlueVerse Co. — Home"
    >
      {/* Square "B" icon */}
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-brandBlue text-lg font-extrabold text-white"
      >
        B
      </span>
      <span className="text-lg font-bold tracking-tight text-brandBlue">
        BlueVerse Co.
      </span>
    </Link>
  );
}

// ----------------------------------------------------------------------------
// 1. NAVIGATION BAR
// ----------------------------------------------------------------------------
function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-brandGrid bg-white/90 backdrop-blur-sm">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
        aria-label="Main navigation"
      >
        <Logo />

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#services"
            className="text-sm font-medium text-textBody transition-colors duration-200 hover:text-brandBlue"
          >
            Services
          </a>
          <a
            href="#work"
            className="text-sm font-medium text-textBody transition-colors duration-200 hover:text-brandBlue"
          >
            My Work
          </a>
          <a
            href="#why"
            className="text-sm font-medium text-textBody transition-colors duration-200 hover:text-brandBlue"
          >
            Why Me
          </a>
        </div>

        {/* Nav actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="hidden text-sm font-medium text-textBody transition-colors duration-200 hover:text-brandBlue sm:inline-block"
          >
            Log In
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-md bg-brandBlue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brandAccent"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}

// ----------------------------------------------------------------------------
// 2. HERO SECTION
// ----------------------------------------------------------------------------
function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-brandIce bg-grid"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Eyebrow */}
          <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-brandBlue">
            Research · Strategy · Writing
          </p>

          {/* Main headline */}
          <h1
            id="hero-heading"
            className="text-4xl font-extrabold leading-tight tracking-tight text-brandNavy md:text-5xl lg:text-6xl"
          >
            Bridging Complex Research, Strategy, and{" "}
            <span className="font-playfair font-bold italic text-brandBlue">
              Clear Writing.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mx-auto mt-6 max-w-3xl text-xl text-textBody md:text-2xl">
            A marketplace connecting students with expert academic writers. Post your assignment and get quality work delivered on time.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="rounded-md bg-brandBlue px-8 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-brandAccent hover:shadow-xl"
            >
              Get Started Free
            </Link>
            <Link
              href="#services"
              className="rounded-md border-2 border-brandGrid bg-white px-8 py-4 text-lg font-medium text-textDark transition-all duration-200 hover:border-brandNavy hover:bg-brandIce"
            >
              Learn More ↓
            </Link>
          </div>

          {/* Trust bar */}
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-textMuted"
            aria-label="Trust guarantees"
          >
            <span>✓ Specialized Research & Writing</span>
            <span>✓ 100% Human-Crafted Quality</span>
            <span>✓ Fast Turnarounds</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 3. AUTHORITY BANNER
// ----------------------------------------------------------------------------
function AuthorityBanner() {
  const points = [
    {
      title: "Master's & Professional Level Quality",
      text: "Methodological rigor, strict adherence to standards, and deep technical comprehension.",
    },
    {
      title: "End-to-End Content Strategy",
      text: "From initial research & outline to finalized, publication-ready copy.",
    },
    {
      title: "Zero Fluff Policy",
      text: "Natural, human-centric writing that respects the reader's time and intelligence.",
    },
  ];

  return (
    <section
      className="border-y border-brandGrid bg-white"
      aria-label="Why you can trust BlueVerse Co."
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {points.map((point) => (
            <div key={point.title} className="text-center md:text-left">
              <h3 className="font-bold text-brandBlue">{point.title}</h3>
              <p className="mt-2 text-textBody">{point.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 4. CORE SERVICES SECTION (#services)
// ----------------------------------------------------------------------------
function Services() {
  const services = [
    {
      number: "1",
      title: "Academic & Research Consultation",
      description:
        "Deep-dive research, literature synthesis, and structured academic writing assistance tailored to rigorous standards.",
      bestFor:
        "Graduate students, researchers, and academic consultants who need polished, well-cited work.",
    },
    {
      number: "2",
      title: "Business Strategy & Market Reports",
      description:
        "Data-backed reports, international expansion briefs, and executive summaries that turn raw market data into actionable strategy.",
      bestFor:
        "Founders, strategy leads, and business teams looking for clear market insights.",
    },
    {
      number: "3",
      title: "Digital Content & Educational Writing",
      description:
        "High-performing scripts, articles, and educational materials crafted to explain complex topics without dumbing them down.",
      bestFor:
        "Content creators, online platforms, and digital publishers looking to build an engaged audience.",
    },
  ];

  return (
    <section
      id="services"
      className="scroll-mt-24 bg-brandIce py-24"
      aria-labelledby="services-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-brandBlue">
            What I Do
          </p>
          <h2
            id="services-heading"
            className="text-4xl font-bold text-brandNavy"
          >
            What I Do
          </h2>
          <p className="mt-4 text-textBody">
            Tailored expertise for every writing need
          </p>
        </div>

        {/* Service cards */}
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="rounded-xl border border-brandGrid bg-white p-8 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              {/* Numbered icon */}
              <div
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-brandBlue/10 text-xl font-extrabold text-brandBlue"
              >
                {service.number}
              </div>

              <h3 className="mt-6 text-xl font-bold text-textDark">
                {service.title}
              </h3>
              <p className="mt-3 text-textBody">{service.description}</p>
              <p className="mt-6 border-t border-brandGrid pt-4 text-sm text-textMuted">
                <span className="font-semibold text-textBody">Best for: </span>
                {service.bestFor}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 5. WHY CLIENTS WORK WITH ME (#why)
// ----------------------------------------------------------------------------
function WhyMe() {
  const points = [
    {
      title: "Human-First, No AI Templates",
      text: "Every piece of work is researched, structured, and written from scratch with human nuance, depth, and flow—never generic filler.",
    },
    {
      title: "Academic Rigor Meets Practical Strategy",
      text: "You get the depth of an academic researcher combined with the speed and clarity required in fast-moving business environments.",
    },
    {
      title: "Zero Friction Communication",
      text: "Clear milestones, predictable timelines, and simple updates so you always know where your project stands.",
    },
  ];

  return (
    <section
      id="why"
      className="scroll-mt-24 border-y border-brandGrid bg-white py-24"
      aria-labelledby="why-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-brandBlue">
            The Difference
          </p>
          <h2 id="why-heading" className="text-4xl font-bold text-brandNavy">
            Why Clients Work With Me
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {points.map((point) => (
            <div
              key={point.title}
              className="rounded-xl border border-brandGrid bg-brandIce p-8 text-center transition-all duration-200 hover:shadow-md"
            >
              <h3 className="text-lg font-bold text-brandNavy">{point.title}</h3>
              <p className="mt-3 text-textBody">{point.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 6. FEATURED WORK & CASE STUDIES (#work)
// ----------------------------------------------------------------------------
function FeaturedWork() {
  const caseStudies = [
    {
      title: "Market Expansion Strategy Brief",
      objective:
        "Comprehensive internal and external analysis for international market entry.",
      result:
        "Delivered a structured 1,500-word strategic roadmap covering cultural adaptation and entry risk.",
      linkText: "Read Brief Summary →",
      href: "#work",
    },
    {
      title: "Educational Script & Content Series",
      objective:
        "Breakdown of complex theoretical frameworks into an engaging 5-part educational video series.",
      result:
        "Increased retention and simplified key principles for a broad digital audience.",
      linkText: "Watch Preview →",
      href: "#work",
    },
  ];

  return (
    <section
      id="work"
      className="scroll-mt-24 bg-brandIce py-24"
      aria-labelledby="work-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-brandBlue">
            Portfolio
          </p>
          <h2 id="work-heading" className="text-4xl font-bold text-brandNavy">
            Featured Work & Case Studies
          </h2>
          <p className="mt-4 text-textBody">Real results from real projects</p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {caseStudies.map((study) => (
            <article
              key={study.title}
              className="flex flex-col rounded-xl border border-brandGrid bg-white p-8 shadow-sm transition-all duration-200 hover:shadow-lg"
            >
              <h3 className="text-2xl font-bold text-textDark">
                {study.title}
              </h3>

              <p className="mt-4 text-textBody">
                <span className="font-semibold text-textDark">Objective: </span>
                {study.objective}
              </p>
              <p className="mt-3 text-textBody">
                <span className="font-semibold text-textDark">Result: </span>
                {study.result}
              </p>

              <a
                href={study.href}
                className="mt-auto pt-6 text-brandBlue transition-colors duration-200 hover:text-brandAccent"
              >
                <span className="font-medium">{study.linkText}</span>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// 7. FINAL CTA SECTION + FOOTER
// ----------------------------------------------------------------------------
function FinalCTA() {
  return (
    <footer id="contact" className="scroll-mt-24 bg-brandNavy">
      <div className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-8">
        {/* Headline */}
        <h2 className="text-4xl font-bold text-white">
          Ready to bring clarity and depth to your next project?
        </h2>

        {/* Subtext */}
        <p className="mx-auto mt-6 max-w-3xl text-xl text-blue-100">
          Whether you need a comprehensive research report, a strategic business
          brief, or engaging educational content, let's discuss how we can work
          together.
        </p>

        {/* Primary button */}
        <div className="mt-10">
          <Link
            href="/auth/signup"
            className="inline-block rounded-md bg-white px-8 py-4 text-lg font-bold text-brandBlue transition-all duration-200 hover:bg-gray-100"
          >
            Join BlueVerse Today
          </Link>
        </div>

        {/* Contact information */}
        <div className="mt-12 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-blue-200">
            Or contact directly:
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 text-lg">
            <p>📞 +254 171 754 04</p>
            <a
              href="mailto:essaymaster1970@gmail.com"
              className="transition-colors duration-200 hover:text-blue-200"
            >
              ✉️ essaymaster1970@gmail.com
            </a>
          </div>
          <p className="mt-3 text-sm text-blue-200">
            (Response time: within 24 hours)
          </p>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10 py-6">
        <p className="text-center text-sm text-gray-400">
          © 2024 BlueVerse Co. All rights reserved.
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
      <AuthorityBanner />
      <Services />
      <WhyMe />
      <FeaturedWork />
      <FinalCTA />
    </main>
  );
}

