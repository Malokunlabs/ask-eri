"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  MoveUpRight,
  ShieldCheck,
  MapPin,
  CalendarDays,
} from "lucide-react";
import {
  signals,
  answerFor,
  coverage,
  evidenceVersion,
  type Signal,
} from "../lib/evidence";
export default function Page() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Signal | null>(null);
  const [asked, setAsked] = useState(false);
  const [location, setLocation] = useState("all");
  function ask(value = q) {
    setQ(value);
    setSelected(answerFor(value, location));
    setAsked(true);
    document
      .getElementById("answer")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  return (
    <main>
      <header>
        <a className="wordmark" href="https://www.useeri.com">
          eri<span className="dot">.</span>
        </a>
        <nav>
          <a href="#coverage">Coverage</a>
          <a href="#explore">Signals</a>
          <a href="#method">Method</a>
          <a href="https://www.useeri.com">
            Main site <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <section className="hero">
        <div className="eyebrow">
          <span className="live" /> FIELD INTELLIGENCE / GROWING ACROSS AFRICA
        </div>
        <h1>
          Ask the
          <br />
          <em>real economy.</em>
        </h1>
        <p className="intro">
          A growing memory of how businesses operate and change across African
          markets. Answers grounded in what we have actually observed.
        </p>
        <div className="scope">
          <label htmlFor="location">EXPLORE EVIDENCE FROM</label>
          <select
            id="location"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setAsked(false);
            }}
          >
            <option value="all">All published locations</option>
            {coverage.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cluster}, {c.region}, {c.country}
              </option>
            ))}
          </select>
          <span>1 published market cluster</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) ask();
          }}
          className="askbox"
        >
          <Search size={22} />
          <input
            aria-label="Ask ERI"
            placeholder="What do you want to know about the market?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button aria-label="Submit question" disabled={!q.trim()}>
            <ArrowRight size={22} />
          </button>
        </form>
        <div className="prompts">
          <span>START WITH A QUESTION</span>
          <div className="promptgrid">
            {signals.slice(0, 4).map((s) => (
              <button key={s.id} onClick={() => ask(s.question)}>
                {s.question}
                <MoveUpRight size={17} />
              </button>
            ))}
          </div>
        </div>
        <p className="disclaimer">
          Current findings describe a non-representative initial Lagos cohort.
          No continental generalisations or measured longitudinal changes.
        </p>
      </section>
      <section className="answerwrap" id="answer" aria-live="polite">
        {asked &&
          (selected ? (
            <article className="answer">
              <div className="overline">
                ERI / VERIFIED FIELD ANSWER / {selected.id.toUpperCase()}
              </div>
              <h2>{selected.title}</h2>
              <p className="lead">{selected.answer}</p>
              <div className="metricgrid">
                {selected.metrics.map((m) => (
                  <div className="metric" key={m.label}>
                    <strong>{m.value}</strong>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="answerdetails">
                <div>
                  <h3>How to read this</h3>
                  <p>{selected.context}</p>
                </div>
                <div>
                  <h3>What this does not establish</h3>
                  <p>{selected.limitations}</p>
                </div>
              </div>
              <div className="source">
                <ShieldCheck size={17} />
                {evidenceVersion} · ERI field intake · Baseline only
              </div>
            </article>
          ) : (
            <article className="answer">
              <div className="overline">ERI / COVERAGE LIMIT</div>
              <h2>We don't have a verified answer to that yet.</h2>
              <p className="lead">
                Ask ERI V0 answers only from a small set of reviewed Yaba
                baseline findings. Your question may require a different
                geography, a more detailed cross-tabulation or observations we
                haven't collected.
              </p>
              <div className="source">
                <ShieldCheck size={17} />
                No invented figures. No claims beyond current evidence.
              </div>
            </article>
          ))}
      </section>
      <section className="explore" id="coverage">
        <div className="sectiontop">
          <div>
            <div className="overline">THE FIELD COVERAGE REGISTER</div>
            <h2>
              Where we have
              <br />
              <em>evidence.</em>
            </h2>
          </div>
          <p>
            Markets appear here only when verified findings are approved for
            publication.
          </p>
        </div>
        <div className="coveragegrid">
          {coverage.map((c) => (
            <article className="coveragecard" key={c.id}>
              <div className="overline">
                {c.country} / {c.region}
              </div>
              <h3>{c.cluster}</h3>
              <div className="coveragevalue">
                {c.publishedRecords}
                <span>production baseline observations</span>
              </div>
              <div className="coveragemeta">
                <span>Baseline available</span>
                <span>{c.period}</span>
              </div>
              <p>
                Not representative of the wider market. No published
                repeat-visit comparisons.
              </p>
              <button
                onClick={() => {
                  setLocation(c.id);
                  document
                    .querySelector(".hero")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Explore this market ↗
              </button>
            </article>
          ))}
        </div>
        <div className="future">
          <strong>More locations will appear as evidence is verified.</strong>
          <p>
            Each new location will carry its own dates, denominator, methodology
            and publication status. We do not imply that unobserved markets are
            covered.
          </p>
        </div>
      </section>
      <section className="explore" id="explore">
        <div className="sectiontop">
          <div>
            <div className="overline">THE OBSERVATION LIBRARY</div>
            <h2>
              What we can
              <br />
              <em>tell you today.</em>
            </h2>
          </div>
          <p>
            Evidence-backed entry points today. Comparable cross-market findings
            can be added as coverage expands.
          </p>
        </div>
        <div className="cards">
          {signals.slice(0, 6).map((s, i) => (
            <button key={s.id} onClick={() => ask(s.question)}>
              <span className="cardnum">0{i + 1}</span>
              <h3>{s.question}</h3>
              <div className="cardfoot">
                Explore answer <ArrowUpRight size={18} />
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="method" id="method">
        <div>
          <div className="overline">HOW ERI KNOWS</div>
          <h2>
            Ambition across Africa.
            <br />
            <em>Claims within evidence.</em>
          </h2>
        </div>
        <div>
          <p>
            These answers come from structured, in-person merchant observations.
            They are not generated from general internet knowledge or
            unrestricted access to private merchant records.
          </p>
          <p>
            <strong>Current coverage:</strong> Yaba–Sabo–Tejuosho, Lagos. The
            public V0 uses 89 production baseline records collected 7–11 October
            2026. The 10-record pilot is shown separately until canonical
            reconciliation is complete.
          </p>
          <p>
            <strong>Limitations:</strong> This is a non-representative initial
            cohort. Self-reported answers are not independent proof of turnover,
            prices or profits. Longitudinal comparisons will be added only after
            genuine return visits.
          </p>
          <div className="methodtags">
            <span>
              <MapPin size={15} /> Lagos, Nigeria
            </span>
            <span>
              <CalendarDays size={15} /> October 2026 baseline
            </span>
            <span>
              <ShieldCheck size={15} /> No merchant-level data exposed
            </span>
          </div>
        </div>
      </section>
      <footer>
        <div className="wordmark">
          eri<span className="dot">.</span>
        </div>
        <p>Built from the ground up. Remembering the real economy.</p>
        <a href="https://www.useeri.com">
          Explore ERI <ArrowUpRight size={16} />
        </a>
      </footer>
    </main>
  );
}
