import { editionById } from './market-brief.ts';
export const buyerRoles = ['Distributor / procurement', 'Financial-institution pilot team', 'Research / development partner', 'Market participant / representative', 'Other'] as const;
export type RequestContext = { buyerRole: string; geography: string; productCategory: string; desiredDeadline: string; sourceEdition: string };
export const emptyRequestContext = { buyerRole: '', geography: '', productCategory: '', desiredDeadline: '', sourceEdition: '' };
export function requestContext(raw: unknown): RequestContext {
  if (raw === undefined) return { ...emptyRequestContext };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Check your decision details.');
  const input = raw as Record<string,unknown>;
  const field = (key: string, maximum: number) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008]/.test(value)) throw new Error('Check your decision details.');
    return value.trim();
  };
  const result = { buyerRole: field('buyerRole',100), geography: field('geography',200), productCategory: field('productCategory',200), desiredDeadline: field('desiredDeadline',10), sourceEdition: field('sourceEdition',80) };
  if(result.sourceEdition && !editionById(result.sourceEdition)) throw new Error('Choose a published source edition.');
  if (result.buyerRole && !(buyerRoles as readonly string[]).includes(result.buyerRole)) throw new Error('Choose a supported buyer role.');
  if (result.desiredDeadline && (!/^\d{4}-\d{2}-\d{2}$/.test(result.desiredDeadline) || !Number.isFinite(Date.parse(result.desiredDeadline)) || new Date(result.desiredDeadline).toISOString().slice(0,10) !== result.desiredDeadline)) throw new Error('Enter a valid desired deadline.');
  return result;
}
