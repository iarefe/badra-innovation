// The employee's own department is independent of the teams affected by a challenge.
export const departmentMaxLength=100;
export function profileDepartment(value:unknown):string{
 if(typeof value!=='string')return '';
 const name=value.normalize('NFC').trim().replace(/\s+/gu,' ');
 return name.length>=2&&name.length<=departmentMaxLength&&/\p{L}/u.test(name)&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name)?name:'';
}
