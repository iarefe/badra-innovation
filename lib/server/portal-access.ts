/** Only call for a successful OTP or a foreground page opened in a verified session.
 * Account creation, matching a phone and importing a directory are not entry events. */
export function markPortalAccess(db:D1Database,employeeId:string,at:number){
 return db.prepare('UPDATE employees SET signed_in=1,last_access_at=? WHERE id=? AND active=1 AND (last_access_at IS NULL OR last_access_at<?)').bind(at,employeeId,at);
}
// Preserve proof (never an inferred timestamp) before an old, verified session disappears.
export function keepSessionProof(db:D1Database,kind:'employee'|'expired'|'digest',value:string|number){
 const filter={employee:'s.employee_id=?',expired:'s.expires_at<?',digest:'s.digest=?'}[kind];
 return db.prepare(`UPDATE employees SET signed_in=1 WHERE signed_in IS NOT 1 AND id IN (SELECT s.employee_id FROM employee_sessions s WHERE ${filter})`).bind(value);
}
