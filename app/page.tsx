'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowRight, Search, MoveUpRight, ShieldCheck, MapPin, CalendarDays, RefreshCw } from 'lucide-react';
import { answerFor, defaultEvidence } from '../lib/evidence';
import type { EvidenceResponse } from '../lib/evidence-types';
import DecisionHub from '../components/DecisionHub';
import MarketBrief, { type Investigation } from '../components/MarketBrief';

const initialData: EvidenceResponse = {
  evidence: defaultEvidence,
  connection: { mode: 'snapshot', checkedAt: null, refreshSeconds: 60, message: 'Validated snapshot. Checking source connection…' },
};
const fieldLabels: Record<string, string> = {
  payments: 'Primary payment', records: 'Recordkeeping', business: 'Business conditions',
  restock: 'Restocking expenditure', credit: 'Borrowing or supplier credit', remote: 'Remote orders',
};
function timestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function Page() {
  const [data, setData] = useState(initialData);
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [location, setLocation] = useState('all');
  const [investigation,setInvestigation] = useState<(Investigation & {key:number}) | null>(null);
  function investigate(request:Investigation) { setInvestigation({...request,key:Date.now()}); }
  useEffect(() => { const question=new URLSearchParams(window.location.search).get('question'); if(question) { setInvestigation({question:question.slice(0,1500),audience: (['distributors','finance','research'].includes(new URLSearchParams(window.location.search).get('audience') || '') ? new URLSearchParams(window.location.search).get('audience') : 'distributors') as Investigation['audience'],edition:new URLSearchParams(window.location.search).get('edition') || undefined,key:Date.now()}); } }, []);
  const { evidence, connection } = data;
  const { signals, coverage, quality, period } = evidence;
  // Open answers follow updated evidence; withheld signals cannot leave a stale answer.
  const selected = submitted === null ? null : answerFor(submitted, location, evidence);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    async function refresh() {
      if (controller || document.visibilityState === 'hidden') return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 45_000);
      try {
        const response = await fetch('/api/evidence', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Refresh unavailable');
        const next: EvidenceResponse = await response.json();
        if (active) setData(next);
      } catch {
        if (active) setData(previous => ({
          ...previous,
          connection: { ...previous.connection, mode: 'stale', message: 'Unable to refresh the source. Showing the last validated analysis; automatic retries continue.' },
        }));
      } finally { clearTimeout(timeout); controller = null; }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); controller?.abort(); };
  }, []);

  function ask(value = q) {
    if (!value.trim()) return;
    setQ(value); setSubmitted(value);
    document.getElementById('answer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return <main>
    <header>
      <a className="wordmark" href="https://www.useeri.com">eri<span className="dot">.</span></a>
      <nav><a href="#market-brief">Market brief</a><a href="#ask">Questions</a><a href="#what-if">Sandbox</a><a href="#notifications">Updates</a></nav>
    </header>
    <section className="hero">
      <div className="eyebrow"><span className="live" /> FIELD INTELLIGENCE / STARTING WITH THE LAGOS COHORT</div>
      <h1>Ask the <em>real economy.</em></h1>
      <p className="intro">Evidence from Lagos markets. Explore what we know and what your next decision still needs.</p>

      <details className="hero-source"><summary>Source & market coverage</summary><div className={`evidence-status status-${connection.mode}`} aria-live="polite">
        <div className="status-heading"><RefreshCw size={15} /><strong>{connection.mode === 'live' ? 'Source connected' : connection.mode === 'stale' ? 'Last validated analysis' : 'Validated snapshot'}</strong></div>
        <p>{connection.message}</p>
        <span>Observations: {period.label}</span><span>Analysed: {timestamp(evidence.analyzedAt)} WAT</span>
        {connection.checkedAt && <span>Source checked: {timestamp(connection.checkedAt)} WAT</span>}
      </div>
      <div className="scope">
        <label htmlFor="location">EXPLORE EVIDENCE FROM</label>
        <select id="location" value={location} onChange={event => { setLocation(event.target.value); setSubmitted(null); }}>
          <option value="all">All published locations</option>
          {coverage.map(c => <option key={c.id} value={c.id}>{c.cluster}, {c.region}, {c.country}</option>)}
        </select>
        <span>{coverage.length} published market cluster{coverage.length === 1 ? '' : 's'}</span>
      </div></details>
    </section>
    <MarketBrief data={data} onInvestigate={investigate} onInspect={ask} />
    <section className="supported" id="ask" aria-labelledby="supported-title">
      <div className="overline">ASK WITHIN THE EVIDENCE</div><h2 id="supported-title">Start with a supported question.</h2><p>These six topics are supported for the current Lagos cohort. Broader questions can become an optional investigation enquiry.</p>
      <div className="prompts"><div className="promptgrid">{signals.filter(s => s.id !== 'coverage').map(s => <button key={s.id} onClick={() => ask(s.question)}>{s.question}<MoveUpRight size={17} /></button>)}</div></div>
      <form onSubmit={event => { event.preventDefault(); ask(); }} className="askbox">
        <Search size={22} /><input aria-label="Ask ERI" placeholder="Ask about payments, records, conditions, restocking, credit or remote orders" value={q} onChange={event => setQ(event.target.value)} />
        <button aria-label="Submit question" disabled={!q.trim()}><ArrowRight size={22} /></button>
      </form>
      <p>Have a decision beyond these topics? <button className="investigation-link" onClick={() => investigate({question:q,audience:'research'})}>Help ERI investigate a question ↗</button></p><p className="disclaimer">Typing a question does not save it. It is stored only if you explicitly submit an enquiry.</p>
      <p className="disclaimer">{quality.includedRows} eligible initial observations; {quality.provisionalIdentityRows} with unverified identities. {quality.identityReviewRows} included observations await identity review and may be repeat submissions. This non-representative Lagos cohort does not establish unique business counts or measured longitudinal change.</p>
    </section>
    <section className="answerwrap" id="answer" aria-live="polite">
      {submitted !== null && (selected ? <article className="answer">
        <div className="overline">ERI / ANALYSED FIELD RESPONSE / {selected.id.toUpperCase()}</div><h2>{selected.title}</h2><p className="lead">{selected.answer}</p>
        <div className="metricgrid">{selected.metrics.map(m => <div className="metric" key={m.label}><strong>{m.value}</strong><span>{m.label}</span></div>)}</div>
        <div className="answerdetails"><div><h3>How to read this</h3><p>{selected.context}</p></div><div><h3>What this does not establish</h3><p>{selected.limitations}</p></div></div>
        <div className="source"><ShieldCheck size={17} />{period.label} · Initial observations · {evidence.version}</div>
      </article> : <article className="answer">
        <div className="overline">ERI / COVERAGE LIMIT</div><h2>We don&apos;t have a verified answer to that yet.</h2>
        <p className="lead">This question is outside the published findings or does not have enough classifiable responses. Try a single topic within the current Yaba cohort.</p><button className="investigation-link" onClick={() => investigate({question:submitted || '',audience:'research'})}>Turn this into an investigation enquiry ↗</button><p>Your question is saved only if you submit the enquiry; new coverage must be scoped.</p>
        <div className="source"><ShieldCheck size={17} />No invented figures. No claims beyond current evidence.</div>
      </article>)}
    </section>
    <DecisionHub data={data} investigation={investigation} onExploreEvidence={() => ask('Are restocking costs changing?')} />
    <section className="explore" id="coverage">
      <div className="sectiontop"><div><div className="overline">THE FIELD COVERAGE REGISTER</div><h2>Where we have<br /><em>evidence.</em></h2></div><p>Every published cohort carries its own dates, denominator and limitations.</p></div>
      <div className="coveragegrid">{coverage.map(c => <article className="coveragecard" key={c.id}>
        <div className="overline">{c.country} / {c.region}</div><h3>{c.cluster}</h3><div className="coveragevalue">{c.publishedRecords}<span>eligible initial observations</span></div>
        <div className="coveragemeta"><span>Initial cohort</span><span>{c.period}</span></div>
        <p>Configured source cohort; merchant identities are provisional. Not representative of the wider market. No published repeat-visit comparison.</p>
        <button onClick={() => { setLocation(c.id); setSubmitted(null); document.querySelector('.hero')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore this market ↗</button>
      </article>)}</div>
      <div className="future"><strong>More locations will appear as evidence is verified.</strong><p>Each location needs an explicit source and reviewed geographic scope. Findings from Lagos do not establish evidence for another city.</p></div>
    </section>
    <section className="explore" id="explore">
      <div className="sectiontop"><div><div className="overline">THE OBSERVATION LIBRARY</div><h2>What we can<br /><em>tell you today.</em></h2></div><p>Signals are extracted from classifiable responses. Each answer explains its own denominator.</p></div>
      <div className="cards">{signals.filter(s => s.id !== 'coverage').map((s, i) => <button key={s.id} onClick={() => ask(s.question)}>
        <span className="cardnum">{String(i + 1).padStart(2, '0')} / {s.denominator} CLASSIFIABLE RESPONSES</span><h3>{s.question}</h3><div className="cardfoot">Explore answer <ArrowUpRight size={18} /></div>
      </button>)}</div>
    </section>
    <section className="analysis-section" id="analysis">
      <div className="sectiontop"><div><div className="overline">BEFORE AN ANSWER IS PUBLISHED</div><h2>Observation.<br /><em>Analysis. Signal.</em></h2></div><p>New responses pass through explicit checks before their aggregates can appear here.</p></div>
      <ol className="analysis-stages">
        <li><span>01 / INGEST</span><strong>{quality.sourceRows}</strong><p>Non-empty source rows examined</p></li>
        <li><span>02 / CHECK</span><strong>{quality.includedRows}</strong><p>Eligible initial observations</p></li>
        <li><span>03 / HOLD OUT</span><strong>{quality.heldRows}</strong><p>Rows excluded from the cohort</p></li>
        <li><span>04 / EXTRACT</span><strong>{signals.filter(s => s.id !== 'coverage').length}</strong><p>Signals with sufficient responses</p></li>
      </ol>
      <details className="quality-details">
        <summary>Inspect data quality and denominators</summary>
        <p>{quality.invalidRows} invalid or misaligned rows; {quality.identityReviewRows} included observations awaiting identity review; {quality.identityExcludedRows} explicitly excluded by identity QA; {quality.recoveredRows} shifted rows recovered; {quality.duplicateRows} duplicate or conflicting copies; {quality.pilotRows} pilot rows; {quality.revisitRows} revisit rows held apart. Blank rows are ignored.</p>
        <div className="quality-table-wrap"><table>
          <caption>Response classification within the {quality.includedRows} eligible observations</caption>
          <thead><tr><th scope="col">Signal</th><th scope="col">Valid</th><th scope="col">Missing</th><th scope="col">Unknown</th><th scope="col">Contradictory</th><th scope="col">Not applicable</th></tr></thead>
          <tbody>{Object.entries(evidence.fields).map(([key, field]) => <tr key={key}><th scope="row">{fieldLabels[key]}</th><td>{field.valid}</td><td>{field.missing}</td><td>{field.unknown}</td><td>{field.ambiguous}</td><td>{field.notApplicable}</td></tr>)}</tbody>
        </table></div>
        <p>Unknown includes “don&apos;t know”, “too new to say” and unrecognised selections. Mixed “No records” answers are contradictory. Signals require at least 10 classifiable responses; that minimum does not make the sample representative.</p>
      </details>
    </section>
    <section className="method" id="method">
      <div><div className="overline">HOW ERI KNOWS</div><h2>Ambition across Africa.<br /><em>Claims within evidence.</em></h2></div>
      <div>
        <p>These answers come from structured, in-person merchant observations. Only aggregate results from the analysis stage reach this page.</p>
        <p><strong>Current source cohort:</strong> {coverage[0]?.cluster}, Lagos. {quality.includedRows} eligible initial observations dated {period.label}. The historical 10-record pilot is not added to this source. Geography is configured for the cohort; the form has no row-level market field.</p>
        <p><strong>How signals are extracted:</strong> We validate the source layout, check submission IDs and observation dates, separate duplicate and repeat visits, classify recognised answers and reconcile every denominator. Ambiguous or missing answers never become invented responses.</p>
        <p><strong>Limitations:</strong> This is a non-representative cohort with provisional identities. Recalled changes are not measured longitudinal findings. Restocking expenditure does not establish inflation. Self-report is not independent proof of turnover, prices or profits.</p>
        <div className="methodtags"><span><MapPin size={15} /> Lagos, Nigeria</span><span><CalendarDays size={15} /> Initial observations</span><span><ShieldCheck size={15} /> Aggregates only</span></div>
      </div>
    </section>

    <footer><div className="wordmark">eri<span className="dot">.</span></div><p>Built from the ground up. Remembering the real economy.</p><a href="/privacy">Privacy</a><a href="#notifications">Follow signals</a><a href="https://www.useeri.com">Explore ERI <ArrowUpRight size={16} /></a></footer>
  </main>;
}
