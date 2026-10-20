import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedJson,sameOrigin,serviceFailure } from '../lib/request-safety.ts';
import { PublicServiceError } from '../lib/engagement.ts';
test('forms reject foreign origins and bounded JSON rejects malformed/oversized input',async()=>{
 assert.throws(()=>sameOrigin(new Request('https://eri.test',{headers:{origin:'https://foreign.test'}}),'https://eri.test'));
 sameOrigin(new Request('https://eri.test',{headers:{origin:'https://eri.test'}}),'https://eri.test');
 const request=(body:string)=>new Request('https://eri.test',{method:'POST',headers:{'Content-Type':'application/json'},body});
 assert.deepEqual(await boundedJson(request('{"consent":true}')),{consent:true});
 await assert.rejects(boundedJson(request('[]')));await assert.rejects(boundedJson(request('invalid')));await assert.rejects(boundedJson(request('{"value":"too long"}'),5));
});
test('API errors never serialize private provider details',async()=>{
 const failure=serviceFailure(Error('private token and merchant row'));assert.equal(failure.status,503);assert.ok(!(await failure.text()).includes('private token'));
 const denied=serviceFailure(new PublicServiceError('Not authorised.',401));assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'no-store');
});
