import { notFound } from 'next/navigation';
import MarketBrief from '../../../components/MarketBrief';
import SampleDeliverable from '../../../components/SampleDeliverable';
import { editionById, editions } from '../../../lib/market-brief';
import type { EvidenceResponse } from '../../../lib/evidence-types';
import styles from '../../../components/MarketBrief.module.css';
export const dynamicParams=false;
export function generateStaticParams(){return editions.map(edition=>({edition:edition.id}));}
export async function generateMetadata({params}:{params:Promise<{edition:string}>}){const edition=editionById((await params).edition);return{title:edition?`ERI archived market brief · ${edition.published}`:'Edition not found'};}
export default async function Edition({params}:{params:Promise<{edition:string}>}){
 const edition=editionById((await params).edition);if(!edition)notFound();
 const data:EvidenceResponse={evidence:edition.evidence,connection:{mode:'snapshot',checkedAt:null,refreshSeconds:0,message:'Archived aggregate edition. These values are fixed.'}};
 return <main data-print-brief><div className={styles.archiveHeader} data-print-controls><a href="/">← Latest Ask ERI</a><span>Fixed aggregate edition · {edition.published}</span></div><MarketBrief data={data} archived/><section className={styles.library} aria-label="Citable evidence cards"><h2>Inspect the fixed evidence.</h2><p>Source: ERI Merchant Business Observation Form · aggregate projection. Observations {data.evidence.period.label}; published {edition.published}; {data.evidence.version}. This edition is immutable; newer findings appear on the latest page.</p>{data.evidence.signals.map(signal=><article className={styles.evidenceCard} id={`signal-${signal.id}`} key={signal.id}><div className="overline">ERI / {signal.id.toUpperCase()}</div><h3>{signal.title}</h3><p>{signal.answer}</p><p>{signal.context}</p><p>{signal.limitations}</p><small>Cite: ERI, {signal.title}. Observations {data.evidence.period.label}. {data.evidence.version}. Fixed edition {edition.id}, signal {signal.id}.</small><a href={`#signal-${signal.id}`}>Link to this evidence card ↗</a></article>)}</section><div data-print-controls><SampleDeliverable data={data}/></div></main>;
}
