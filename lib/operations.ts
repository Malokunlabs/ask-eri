import { PublicServiceError, notificationTopics, type NotificationTopic, type createEngagementService } from './engagement.ts';
type Service=ReturnType<typeof createEngagementService>;
export async function runOperation(service:Service,body:Record<string,unknown>){
 if(body.action==='approve-scope')return service.approveScope(String(body.id),body);
 if(body.action==='complete')return service.complete(String(body.id),String(body.report));
 if(body.action==='work')return service.work();
 if(body.action==='publish-update'&&notificationTopics.includes(body.topic as NotificationTopic)){
  await service.publishUpdate(body.topic as NotificationTopic,String(body.title),String(body.summary));
  return{message:'Update saved. Run the worker to process confirmed subscribers.'};
 }
 throw new PublicServiceError('Unsupported operation.');
}
export function allowLocalOperations(environment:string|undefined,mode:string,host:string|null,origin:string){
 if(environment!=='development'||mode!=='local')throw new PublicServiceError('Not found.',404);
 if(host!==new URL(origin).host||!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new PublicServiceError('Local workspace only.',403);
}
