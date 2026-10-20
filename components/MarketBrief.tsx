'use client';
import { useEffect, useState } from 'react';
import type { EvidenceResponse } from '../lib/evidence-types';
import { buildMarketBrief, buildEvidenceHooks, briefCitation, evidenceChanges } from '../lib/market-brief';
import styles from './MarketBrief.module.css';
export type Investigation = { question: string; audience: 'distributors' | 'finance' | 'research'; edition?: string };
export default function MarketBrief({ data, onInvestigate, onInspect, archived = false }: { data: EvidenceResponse; onInvestigate?: (request: Investigation) => void; onInspect?: (question: string) => void; archived?: boolean }) {
  const brief = buildMarketBrief(data); const hooks = buildEvidenceHooks(data); const [active,setActive] = useState(0); const [playing,setPlaying] = useState(true); const [interacting,setInteracting] = useState(false); const [reducedMotion,setReducedMotion] = useState(true);
  const selected = hooks[active % Math.max(hooks.length,1)];
  useEffect(() => { const media=window.matchMedia('(prefers-reduced-motion: reduce)'); const update=()=>setReducedMotion(media.matches); update(); media.addEventListener('change',update); return()=>media.removeEventListener('change',update); }, []);
  useEffect(() => { if(!playing || interacting || reducedMotion || hooks.length<2)return; const timer=window.setInterval(()=>setActive(value=>(value+1)%hooks.length),8000); return()=>window.clearInterval(timer); }, [playing,interacting,reducedMotion,hooks.length]);
  function choose(index:number){setActive(index);setPlaying(false);} const [feedback,setFeedback] = useState(''); const [origin,setOrigin] = useState('');
  useEffect(() => setOrigin(location.origin), []);
  if (!brief) return <section className={styles.section} id="market-brief"><h2>A market brief needs a reviewed location.</h2><p>Explore the available evidence below. This brief cannot combine multiple locations.</p></section>;
  const investigate = () => { if (onInvestigate) onInvestigate({ question: selected?.question ?? brief.question, audience: selected?.audience ?? 'distributors', edition: brief.edition ?? undefined }); };
  async function copy() { if(!brief)return; try { await navigator.clipboard.writeText(briefCitation(brief,location.origin)); setFeedback('Citation copied with dates, source and limitations.'); } catch { setFeedback('Copy was unavailable. Select the citation below to copy it manually.'); } }
  return <section className={styles.section} id="market-brief" data-print-brief aria-labelledby="market-brief-title">
    <div className={styles.topline}><span className="overline">ERI FIELD NOTE / START WITH THE EVIDENCE</span><span className={styles.badge}>{archived ? 'ARCHIVED EDITION' : data.connection.mode === 'live' ? 'SOURCE CONNECTED' : data.connection.mode === 'stale' ? 'LAST VALIDATED ANALYSIS' : 'VALIDATED SNAPSHOT'}</span></div>
    <div className={styles.heading}><div><p className={styles.market}>{brief.market} · {brief.region}</p><h2 id="market-brief-title">Market signals. <em>Decisions to explore.</em></h2></div><p>Explore the evidence, find the question behind your next decision, and scope a return to the field.</p></div>
    <div className={styles.hookControls} aria-label="Evidence examples">
      <span className={styles.label}>WHAT WE OBSERVED · {hooks.length} EVIDENCE EXAMPLES</span>
      <div>{hooks.map((hook,index)=><button key={hook.id} aria-pressed={selected?.id===hook.id} onClick={()=>choose(index)}>{String(index+1).padStart(2,'0')} / {hook.label}</button>)}</div>
      {hooks.length>1 && !reducedMotion && <button onClick={()=>setPlaying(value=>!value)}>{playing && !reducedMotion ? 'Pause examples' : 'Start examples'}</button>}
    </div>
    <div className={styles.grid} onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocusCapture={()=>setInteracting(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setInteracting(false);}} aria-roledescription="carousel" aria-label="Market evidence and a next step">
      {selected ? <><div className={styles.observed} role="group" aria-roledescription="slide" aria-label={`${active%hooks.length+1} of ${hooks.length}: ${selected.label}`}>
        <span className={styles.label}>OBSERVED / {selected.label.toUpperCase()}</span><strong className={styles.number}>{selected.fact.count}<small> / {selected.fact.denominator}</small></strong><h3>{selected.headline}</h3>
        <p className={styles.hookScope}>{brief.period} · Classifiable responses, not a market-wide estimate.</p>
        <details key={selected.id}><summary>Denominator & evidence limits</summary><p>{selected.fact.answer}</p><p>{selected.fact.context}</p><p>{selected.fact.limitations}</p></details>
        {onInspect ? <button className={styles.textButton} onClick={()=>onInspect(selected.fact.question)}>Explore this finding ↗</button> : <a className={styles.textButton} href={`#signal-${selected.id}`}>Explore this finding ↗</a>}
      </div><div className={styles.reasoning}>
        <span className={styles.label}>{selected.buyer}</span><h3>{selected.relevance}</h3>
        <div className={styles.actions}>{onInvestigate ? <button className={styles.primary} onClick={investigate}>Scope this investigation ↗</button> : <a className={styles.primary} href={`/?question=${encodeURIComponent(selected.question)}&audience=${selected.audience}${brief.edition ? `&edition=${brief.edition}` : ''}#field-request`}>Scope this investigation ↗</a>}<a className={styles.secondary} href={archived ? '/#sample-deliverable' : '#sample-deliverable'}>See what a field brief includes ↓</a></div><p><strong>Still to verify:</strong> {selected.unknown}</p><p className={styles.hookTerms}>Question → agreed scope & quote → reviewed field brief. No work starts or payment is taken by this enquiry.</p>
      </div></> : <div className={styles.observed}><h3>These findings are currently withheld.</h3><p>No previous counts are substituted. Explore the available evidence below.</p></div>}
    </div>
    <div className={styles.more}><span>Each example describes a separate signal; their respondents may differ. There is more to explore.</span><a href={archived ? '#signal-payments' : '#ask'}>Explore all six evidence topics ↓</a></div>
    <p className={styles.scope}>{brief.quality.includedRows} initial observations · {brief.quality.identityReviewRows} identity-review flags · Non-representative; not verified distinct businesses.</p>
    <details className={styles.changes}><summary>Dates, source status & cohort scope</summary><p>Observed {brief.period}. Analysed {new Date(brief.analyzedAt).toLocaleDateString('en-GB',{timeZone:'Africa/Lagos'})}. {brief.version}. Geography is configured for this cohort.</p><p>{archived ? 'Fixed aggregate edition; it does not update when the source changes.' : data.connection.message} Refreshing a source does not make its field observations newer.</p>{data.connection.checkedAt && <p>Source checked: {data.connection.checkedAt}</p>}<p>Identities remain provisional and review-flagged observations may be repeats. No cross-signal overlap, representativeness, causal effect or matched longitudinal change is established.</p></details>
    <div className={styles.citation}><strong>Source & citation</strong><p>ERI Merchant Business Observation Form · reviewed aggregate projection. Self-reported responses; no representative-market, cross-signal overlap or matched-change claim.</p><p className={styles.citationText}>{briefCitation(brief,origin)}</p><div className={styles.citationActions}><button onClick={copy}>Copy citation for this site</button>{brief.edition ? <a href={`/briefs/${brief.edition}`}>Open the fixed aggregate edition ↗</a> : <span>This view has not been archived. Its values may change.</span>}</div><p role="status">{feedback}</p></div>
    <details className={styles.changes}><summary>What changed in the evidence?</summary>{evidenceChanges.map(change => <div key={change.date}><strong>{change.date} · {change.kind}</strong><p>{change.text}</p></div>)}<p>Collection, source repairs, inclusion rules and matched economic changes are different kinds of updates. No measured longitudinal comparison is published yet.</p></details>
  </section>;
}
