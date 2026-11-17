'use client';
import {RoleBadge} from './participation-badges';
import {participantRoles,ParticipantRole} from '@/lib/participant-roles';
export default function RolePicker({value,onChange,disabled=false}:{value:ParticipantRole[];onChange:(roles:ParticipantRole[])=>void;disabled?:boolean}){
 return <fieldset className="role-picker" disabled={disabled}><legend>ما الأدوار التي يمكنك تقديمها؟</legend><p>اختر دورًا واحدًا أو أكثر. يمكنك تعديلها لاحقًا من حسابك.</p><div>{participantRoles.map(role=><label key={role.id} data-br-role={role.id} className={value.includes(role.id)?'chosen':''}><input type="checkbox" checked={value.includes(role.id)} onChange={e=>onChange(e.target.checked?[...value,role.id]:value.filter(id=>id!==role.id))}/><span><RoleBadge role={role}/><small>{role.description}</small></span></label>)}</div></fieldset>;
}
