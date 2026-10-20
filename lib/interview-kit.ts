import { buyerRoles } from './request-context.ts';
export const interviewPrompts = [
 {key:'decision',label:'A recent real decision',prompt:'Tell me about the last purchasing, distribution or pilot decision you made. What happened?'},
 {key:'uncertainty',label:'The uncertainty and its cost',prompt:'What did you need to know? What did waiting or getting it wrong cost in time, effort or money?'},
 {key:'currentApproach',label:'What they do today',prompt:'How did you get evidence? What did you pay for or do yourself? What was missing?'},
 {key:'comprehension',label:'What they understood from the brief',prompt:'Show the brief without explaining it. Ask: what was observed, what remains unknown, and what would you do next? Note any forecast or unique-business misunderstanding.'},
 {key:'decisionUse',label:'A decision ERI could support',prompt:'Where would this change a decision or investigation? What would make it irrelevant?'},
 {key:'evidenceNeeded',label:'The evidence they would need',prompt:'Which location, products, measures, sources or follow-up would make a paid scope useful?'},
 {key:'buyingProcess',label:'How a scope would be bought',prompt:'Who approves this work? What alternatives, budget process, procurement conditions and timing apply? Ask about actual prior spending before hypothetical prices.'},
 {key:'commitment',label:'A concrete next step',prompt:'Would they review a written scope, introduce the decision owner, share a permitted example or agree another meeting? Record what was agreed; interest is not a sale.'},
 {key:'concerns',label:'Objections and missing value',prompt:'What would stop you trusting, commissioning or using this? Which parts would you remove?'},
 {key:'followup',label:'Follow-up and owner',prompt:'Record the next action, responsible role and agreed timing. Keep contact details in your private contact system, not this public evidence repository.'},
] as const;
export type InterviewKey=(typeof interviewPrompts)[number]['key'];
export type InterviewSession={id:number;role:string;stage:'planned'|'conducted';noteConsent:'not-recorded'|'notes-agreed'|'declined';answers:Record<InterviewKey,string>};
export function blankInterviews():InterviewSession[]{return [1,2,3].map(id=>({id,role:buyerRoles[0],stage:'planned',noteConsent:'not-recorded',answers:Object.fromEntries(interviewPrompts.map(p=>[p.key,''])) as Record<InterviewKey,string>}));}
export function parseInterviews(raw:unknown):InterviewSession[]{
 if(!raw||typeof raw!=='object'||(raw as {version?:number}).version!==1)throw Error('Unsupported notes format.');
 const sessions=(raw as {sessions?:unknown}).sessions;
 if(!Array.isArray(sessions)||sessions.length!==3)throw Error('Three interview slots are required.');
 return sessions.map((value,i)=>{
  if(!value||typeof value!=='object'||value.id!==i+1||!(buyerRoles as readonly string[]).includes(value.role)||!['planned','conducted'].includes(value.stage)||!['not-recorded','notes-agreed','declined'].includes(value.noteConsent)||!value.answers||typeof value.answers!=='object')throw Error('Invalid interview notes.');
  const answers=Object.fromEntries(interviewPrompts.map(p=>{const text=value.answers[p.key];if(typeof text!=='string'||text.length>4000)throw Error('An answer is invalid or too long.');return[p.key,text];})) as Record<InterviewKey,string>;
  return{id:i+1,role:value.role,stage:value.stage,noteConsent:value.noteConsent,answers};
 });
}

export function canRetainInterviews(sessions:InterviewSession[]){return sessions.every(session=>session.noteConsent==='notes-agreed'||Object.values(session.answers).every(answer=>!answer.trim()));}
