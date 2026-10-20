'use client';

import { useId, useState } from 'react';
import { ArrowUpRight, ArrowRight, ShoppingBasket, Shirt, CupSoda, Smartphone, Lamp, Store, FlaskConical, Package, Check, CircleHelp } from 'lucide-react';
import { calculateRestockingScenario, sandboxResponses, type SandboxResponse } from '../lib/sandbox-preview';
import styles from './SandboxPreview.module.css';
import type { DecisionInputs } from '../lib/decision-model';

const stalls = [
  { name: 'Grocery', Icon: ShoppingBasket }, { name: 'Drinks', Icon: CupSoda },
  { name: 'Fashion', Icon: Shirt }, { name: 'Electronics', Icon: Smartphone },
  { name: 'Household', Icon: Lamp }, { name: 'General goods', Icon: Store },
];
const currency = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value);

export default function SandboxPreview({ onExploreEvidence, onRequest }: { onExploreEvidence: () => void; onRequest: (inputs: DecisionInputs) => void }) {
  const uid = useId();
  const [budget, setBudget] = useState('100000');
  const [unitCost, setUnitCost] = useState('1000');
  const [increase, setIncrease] = useState(15);
  const [response, setResponse] = useState<SandboxResponse>('quantity');
  const selected = sandboxResponses.find(item => item.id === response)!;
  let result: ReturnType<typeof calculateRestockingScenario> | null = null;
  let error = '';
  try { result = calculateRestockingScenario(Number(budget), Number(unitCost), increase); }
  catch (failure) { error = failure instanceof Error ? failure.message : 'Check the scenario amounts.'; }
  const fraction = result && result.startingUnits > 0 ? result.affordableUnits / result.startingUnits : 1;
  const boxes = response === 'quantity' ? Math.max(0, Math.round(6 * fraction)) : 6;
  const noShock = increase === 0;

  return <section className={styles.section} id="restocking-scenario" aria-labelledby={`${uid}-heading`}>
    <div className={styles.container}>
      <div className={styles.previewLine}><span><FlaskConical size={15} /> DISTRIBUTOR DECISION EXPLORER</span><span className={styles.localBadge}>YOUR ASSUMPTIONS</span></div>
      <div className={styles.headingRow}>
        <div><h2 id={`${uid}-heading`}>What if restocking<br /><em>costs more?</em></h2><p className={styles.intro}>A decision explorer for distributors and field teams.</p></div>
        <p className={styles.purpose}>Explore a purchasing trade-off.<br />Then decide what to verify in the field.</p>
      </div>

      <div className={styles.explorer}>
        <div className={styles.marketPanel}>
          <div className={styles.panelTitle}><span>THE COST OF RESTOCKING</span><span>Illustrative market</span></div>
          <div className={styles.market} role="img" aria-label={`Six fictional merchant stalls. ${noShock ? 'No cost increase assumed.' : `Selected hypothetical response: ${selected.title}.`} The drawing is not observed inventory or predicted merchant behaviour.`}>
            <div className={styles.marketStreet}><span>THE MARKET / LAGOS-INSPIRED</span><span>FICTIONAL STALLS</span></div>
            <div className={styles.stallGrid}>{stalls.map(({ name, Icon }, index) => <div className={styles.stall} key={name}>
              <div className={`${styles.awning} ${index % 2 ? styles.awningAlternate : ''}`}><span /><span /><span /><span /><span /><span /></div>
              <div className={styles.stallBody}>
                <div className={styles.stallName}><Icon size={19} strokeWidth={1.4} /><span>{name}</span></div>
                <div className={styles.shelf} aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i} className={i >= boxes ? styles.emptyBox : styles.box} />)}</div>
                <div className={styles.stallFoot}><span className={styles.person} aria-hidden="true" /><span>{noShock ? 'Baseline' : selected.scene}</span></div>
              </div>
            </div>)}</div>
            <div className={styles.streetFoot}><span>↔</span><span>Purchasing choices. Different trade-offs.</span><span>↔</span></div>
          </div>
          <p className={styles.sceneNote}>Conceptual shelves, not measured stock. No individual merchant records are represented.</p>
          <div className={styles.evidenceNote}><span><CircleHelp size={15} /> START WITH WHAT WE KNOW</span><p>Reported restocking expenditure is not a measured supplier-price increase.</p><button type="button" onClick={onExploreEvidence}>View the current restocking evidence <ArrowUpRight size={15} /></button></div>
        </div>

        <div className={styles.controls}>
          <div className={styles.controlHeading}><span className={styles.step}>01</span><h3>Set your assumptions</h3></div>
          <div className={styles.amounts}>
            <label htmlFor={`${uid}-budget`}>Purchasing budget · ₦<input id={`${uid}-budget`} type="number" min="0.01" max="100000000" step="any" inputMode="decimal" value={budget} onChange={event => setBudget(event.target.value)} aria-describedby={error ? `${uid}-error` : undefined} aria-invalid={Boolean(error)} /></label>
            <label htmlFor={`${uid}-unit`}>Starting unit cost · ₦<input id={`${uid}-unit`} type="number" min="0.01" max="100000000" step="any" inputMode="decimal" value={unitCost} onChange={event => setUnitCost(event.target.value)} aria-describedby={error ? `${uid}-error` : undefined} aria-invalid={Boolean(error)} /></label>
          </div>
          {error && <p className={styles.error} id={`${uid}-error`} role="alert">{error}</p>}
          <div className={styles.rangeLabel}><label htmlFor={`${uid}-increase`}>Supplier unit-cost increase</label><output htmlFor={`${uid}-increase`}>+{increase}%</output></div>
          <input className={styles.slider} id={`${uid}-increase`} type="range" min="0" max="50" step="5" value={increase} onChange={event => setIncrease(Number(event.target.value))} aria-valuetext={`${increase} percent assumed increase; not an observed change`} />
          <div className={styles.rangeEnds}><span>0%</span><span>Your scenario assumption</span><span>50%</span></div>

          <fieldset className={styles.responses}><legend><span className={styles.step}>02</span> Choose a hypothetical response</legend>{sandboxResponses.map(item => <label className={`${styles.response} ${response === item.id ? styles.selected : ''}`} key={item.id}>
            <input type="radio" name={`${uid}-response`} value={item.id} checked={response === item.id} onChange={() => setResponse(item.id)} />
            <span><strong>{item.title}</strong><span>{item.description}</span></span><Check size={16} aria-hidden="true" className={styles.selectedCheck} />
          </label>)}</fieldset>
        </div>
      </div>

      <div className={styles.interpretation} aria-live="polite" aria-atomic="true">
        <div className={styles.calculation}><span className={styles.eyebrow}><Package size={15} /> ASSUMPTION-BASED ARITHMETIC</span>
          {result ? <><span className={styles.resultLabel}>{response === 'quantity' ? 'Whole units within the same budget' : 'Extra purchasing cash for the original order'}</span><strong className={styles.result}>{response === 'quantity' ? <>{result.startingUnits}<ArrowRight size={25} />{result.affordableUnits}<small>units</small></> : currency(result.extraCash)}</strong>
            <p>Unit cost: {currency(Number(unitCost))} → {currency(result.newUnitCost)}.<br />{response === 'quantity' ? 'Whole units rounded down; no delivery fees included.' : `Original order: ${result.startingUnits} units. New purchase cost: ${currency(result.sameOrderCost)}.`}</p>
            {result.startingUnits === 0 && <p className={styles.zeroUnits}>This budget cannot purchase one whole unit at the starting price.</p>}</> : <><strong className={styles.result}>Check inputs</strong><p>Enter valid amounts to explore the purchasing arithmetic.</p></>}
        </div>
        <div className={styles.tradeoff}><span className={styles.eyebrow}>THE TRADE-OFF</span><h3>{noShock ? 'No supplier-cost increase assumed.' : selected.title}</h3><p>{noShock ? 'The starting and scenario unit costs are the same. Businesses may still face other changes; this scenario does not estimate them.' : selected.tradeoff}</p><span className={styles.uncertainty}>Merchant behaviour and customer demand remain unmeasured.</span></div>
      </div>

      <div className={styles.fieldQuestion}><div><span className={styles.eyebrow}>03 / TAKE IT BACK TO THE FIELD</span><h3>{noShock ? 'What baseline should we record before a follow-up?' : selected.question}</h3></div><div><span className={styles.eyebrow}>WHAT TO RECORD</span><p>{selected.measures}</p><span className={styles.fieldCaveat}>Repeated observations can document change. Causal attribution needs a separate study design.</span></div></div>
      <button type="button" disabled={!result} className={styles.requestButton} onClick={() => onRequest({ budget: Number(budget), unitCost: Number(unitCost), increase, response })}>Request a scoped field brief ↗</button>
      <div className={styles.disclaimer}><ShieldMark /><p><strong>Illustrative scenario.</strong> Not a forecast or an estimate derived from ERI&apos;s field data. The inputs are assumptions, and the numeric results are purchasing arithmetic only.</p><span>Observe. Explore. Return. Learn.</span></div>
    </div>
  </section>;
}

function ShieldMark() { return <FlaskConical size={18} aria-hidden="true" />; }
