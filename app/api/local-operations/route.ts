import {randomUUID} from 'node:crypto';
import {engagementRuntime} from '../../../lib/engagement-runtime';
import {allowLocalOperations,runOperation} from '../../../lib/operations';
import {PublicServiceError} from '../../../lib/engagement';
import {boundedJson,responseJson,sameOrigin,serviceFailure} from '../../../lib/request-safety';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function local(request:Request){
 if(process.env.NODE_ENV!=='development')throw new PublicServiceError('Not found.',404);
 const current=engagementRuntime();allowLocalOperations(process.env.NODE_ENV,current.mode,request.headers.get('host'),current.origin);return current;
}
export async function GET(request:Request){try{return responseJson(await local(request).service.operations(new URL(request.url).searchParams.get('cursor')??'0'));}catch(error){return serviceFailure(error);}}
export async function POST(request:Request){try{
 const current=local(request);sameOrigin(request,current.origin);const body=await boundedJson(request,40000);
 if(body.action==='seed-demo'){
  const result=await current.service.submit({kind:'request',requestMode:'investigation',audience:'distributors',email:`demo-${randomUUID()}@example.invalid`,organisation:'Synthetic local demo',question:'LOCAL DEMO ONLY: what would an agreed replenishment investigation need to record?',consent:true,requestContext:{buyerRole:'Distributor / procurement',geography:'Example requested scope only',productCategory:'Example category',desiredDeadline:''}},'local-owner-demo');
  if(!result.confirmationUrl)throw Error('Local confirmation unavailable');const url=new URL(result.confirmationUrl);
  await current.service.action('confirm',url.searchParams.get('id')!,url.searchParams.get('token')!);
  return responseJson({message:'Confirmed local demo enquiry created. No email was sent, no fieldwork commissioned and no payment taken.'});
 }
 return responseJson(await runOperation(current.service,body));
}catch(error){return serviceFailure(error);}}
