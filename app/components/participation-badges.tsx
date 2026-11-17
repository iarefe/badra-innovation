import type {ReactNode} from 'react';
import {Flag, Lightbulb, Code2, Presentation, FileText, Clock3, FilePenLine, CircleCheck, BadgeCheck, UserRoundPen, Hourglass, UserRound, Ban, type LucideIcon} from 'lucide-react';
import {participantRoles, type ParticipantRole} from '@/lib/participant-roles';
import type {Entry} from '@/lib/challenges';
import type {ProspectiveEmployee} from '@/lib/prospective-employees';

const roleIcons = {challenger: Flag, innovator: Lightbulb, developer: Code2, creative: Presentation} satisfies Record<ParticipantRole, LucideIcon>;

export function RoleBadge({role}: {role: (typeof participantRoles)[number]}) {
  const Icon = roleIcons[role.id];
  return <span className="br-role-badge" data-br-role={role.id}><Icon size={14} aria-hidden="true"/>{role.label}</span>;
}

export function RoleTags({roles}: {roles: ParticipantRole[]}) {
  const selected = participantRoles.filter(role => roles.includes(role.id));
  return selected.length
    ? <span className="br-role-list">{selected.map(role => <RoleBadge role={role} key={role.id}/>)}</span>
    : <span className="br-no-roles">لم يحدد أدواره بعد</span>;
}

type BadgeState = `challenge-${Entry['status']}` | 'record-confirmed' | 'record-self-entered' | 'record-awaiting' | 'record-unregistered' | 'account-active' | 'account-suspended';
const stateIcons = {
  'challenge-published': CircleCheck, 'challenge-draft': FileText, 'challenge-pending': Clock3, 'challenge-returned': FilePenLine,
  'record-confirmed': BadgeCheck, 'record-self-entered': UserRoundPen, 'record-awaiting': Hourglass, 'record-unregistered': UserRound,
  'account-active': CircleCheck, 'account-suspended': Ban,
} satisfies Record<BadgeState, LucideIcon>;

export function StatusBadge({state, children, anchor}: {state: BadgeState; children: ReactNode; anchor?: string}) {
  const Icon = stateIcons[state];
  return <span className="br-status-badge" data-br-state={state} data-badra-anchor={anchor}><Icon size={14} aria-hidden="true"/>{children}</span>;
}

export function EmployeeRecordBadge({row}: {row: ProspectiveEmployee}) {
  if (row.linkedEmployeeId) return <StatusBadge state="record-confirmed">مؤكَّد</StatusBadge>;
  if (row.declined) return <StatusBadge state="record-self-entered">اختار إدخال بياناته</StatusBadge>;
  if (row.registeredEmployeeId) return <StatusBadge state="record-awaiting">بانتظار تأكيده</StatusBadge>;
  return <StatusBadge state="record-unregistered">لم يسجل بعد</StatusBadge>;
}
