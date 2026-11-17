import {env} from 'cloudflare:workers';
import {database} from './access';
export type AvatarRow={employee_id:string;object_key:string;updated_at:number};
export function avatarBucket():R2Bucket|undefined{return (env as any).BUCKET;}
export function readAvatar(employeeId:string){return database().prepare('SELECT * FROM employee_avatars WHERE employee_id=?').bind(employeeId).first<AvatarRow>();}
export function ownAvatarUrl(row:AvatarRow|null){return row?.object_key?'/api/avatar?self=1&v='+row.updated_at:null;}
