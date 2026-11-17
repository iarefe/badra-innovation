import { sqliteTable,text,integer,primaryKey,index } from 'drizzle-orm/sqlite-core';
export const ideas=sqliteTable('ideas',{id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),nickname:text('nickname').notNull(),experience:text('experience').notNull(),published:integer('published').notNull().default(0),createdAt:integer('created_at').notNull()});
export const votes=sqliteTable('votes',{ideaId:text('idea_id').notNull().references(()=>ideas.id,{onDelete:'cascade'}),userId:text('user_id').notNull()},t=>[primaryKey({columns:[t.ideaId,t.userId]})]);
export const challenges=sqliteTable('challenges',{id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('draft'),reviewNote:text('review_note').notNull().default(''),createdAt:integer('created_at').notNull(),publishedAt:integer('published_at'),updatedAt:integer('updated_at').notNull()});
export const challengeVotes=sqliteTable('challenge_votes',{challengeId:text('challenge_id').notNull().references(()=>challenges.id,{onDelete:'cascade'}),userId:text('user_id').notNull()},t=>[primaryKey({columns:[t.challengeId,t.userId]})]);
export const workshopSettings=sqliteTable('workshop_settings',{id:integer('id').primaryKey(),title:text('title').notNull(),joiningOpen:integer('joining_open').notNull().default(0),engagementControlsInitialized:integer('engagement_controls_initialized').notNull().default(0),intakePaused:integer('intake_paused').notNull().default(0),count:integer('count').notNull().default(3),open:integer('open').notNull().default(1),finalized:integer('finalized').notNull().default(0),revision:integer('revision').notNull().default(0)});
export const workshopSelection=sqliteTable('workshop_selection',{challengeId:text('challenge_id').primaryKey(),payload:text('payload').notNull(),votes:integer('votes').notNull(),rank:integer('rank').notNull()});
export const workshopMembers=sqliteTable('workshop_members',{email:text('email').primaryKey(),role:text('role').notNull().default('employee')});
export const aiUsage=sqliteTable('ai_usage',{key:text('key').primaryKey(),count:integer('count').notNull().default(0),expiresAt:integer('expires_at').notNull()});
export const employees=sqliteTable('employees',{id:text('id').primaryKey(),number:text('number').unique(),phone:text('phone').unique(),name:text('name').notNull(),roles:text('roles').notNull().default('[]'),signedIn:integer('signed_in'),lastAccessAt:integer('last_access_at'),email:text('email').unique(),department:text('department').notNull(),active:integer('active').notNull().default(1),createdAt:integer('created_at').notNull()});
export const participationSettings=sqliteTable('participation_settings',{id:integer('id').primaryKey(),networks:text('networks').notNull().default('[]'),otpChannel:text('otp_channel').notNull().default('sms'),revision:integer('revision').notNull().default(0)});
export const employeeOtps=sqliteTable('employee_otps',{id:text('id').primaryKey(),employeeId:text('employee_id').notNull().references(()=>employees.id),digest:text('digest').notNull(),expiresAt:integer('expires_at').notNull(),attempts:integer('attempts').notNull().default(0),used:integer('used').notNull().default(0)});
export const employeeSessions=sqliteTable('employee_sessions',{digest:text('digest').primaryKey(),employeeId:text('employee_id').notNull().references(()=>employees.id),expiresAt:integer('expires_at').notNull()});
export const authLimits=sqliteTable('auth_limits',{key:text('key').primaryKey(),count:integer('count').notNull().default(0),expiresAt:integer('expires_at').notNull()});
export const securityAudit=sqliteTable('security_audit',{id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),createdAt:integer('created_at').notNull()});

export const phoneOtps=sqliteTable('phone_otps',{id:text('id').primaryKey(),phone:text('phone').notNull(),digest:text('digest').notNull(),expiresAt:integer('expires_at').notNull(),attempts:integer('attempts').notNull().default(0),used:integer('used').notNull().default(0)});

export const challengeInterests=sqliteTable('challenge_interests',{challengeId:text('challenge_id').notNull().references(()=>challenges.id,{onDelete:'cascade'}),employeeId:text('employee_id').notNull().references(()=>employees.id,{onDelete:'cascade'}),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.challengeId,t.employeeId]})]);

export const challengeCovers=sqliteTable('challenge_covers',{challengeId:text('challenge_id').primaryKey().references(()=>challenges.id,{onDelete:'cascade'}),objectKey:text('object_key').notNull().default(''),status:text('status').notNull().default('none'),source:text('source').notNull().default('generated'),prompt:text('prompt').notNull().default(''),jobId:text('job_id').notNull().default(''),startedAt:integer('started_at').notNull().default(0),updatedAt:integer('updated_at').notNull().default(0)});

export const employeeAvatars=sqliteTable('employee_avatars',{employeeId:text('employee_id').primaryKey().references(()=>employees.id,{onDelete:'cascade'}),objectKey:text('object_key').notNull().default(''),updatedAt:integer('updated_at').notNull().default(0)});

export const prospectiveEmployees=sqliteTable('prospective_employees',{id:text('id').primaryKey(),name:text('name').notNull(),phone:text('phone').unique(),avatarKey:text('avatar_key').notNull().default(''),linkedEmployeeId:text('linked_employee_id').unique().references(()=>employees.id,{onDelete:'set null'}),linkToken:text('link_token').notNull().default(''),revision:integer('revision').notNull().default(0),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()});
export const prospectiveDeclines=sqliteTable('prospective_declines',{employeeId:text('employee_id').notNull().references(()=>employees.id,{onDelete:'cascade'}),prospectiveId:text('prospective_id').notNull().references(()=>prospectiveEmployees.id,{onDelete:'cascade'}),revision:integer('revision').notNull()},t=>[primaryKey({columns:[t.employeeId,t.prospectiveId]})]);

export const faqInquiries=sqliteTable('faq_inquiries',{
 id:text('id').primaryKey(),
 question:text('question').notNull(),
 senderId:text('sender_id').references(()=>employees.id,{onDelete:'set null'}),
 createdAt:integer('created_at').notNull(),
 readAt:integer('read_at'),
},t=>[index('faq_inquiries_created_idx').on(t.createdAt,t.id)]);

export const eventTeams=sqliteTable('event_teams',{id:text('id').primaryKey().references(()=>challenges.id),audience:integer('audience'),solution:text('solution').notNull().default(''),instructions:text('instructions').notNull().default(''),slidesUrl:text('slides_url').notNull().default(''),announced:integer('announced').notNull()});
export const teamMembers=sqliteTable('team_members',{team:text('team').notNull().references(()=>eventTeams.id),person:text('person').notNull().references(()=>employees.id)},t=>[primaryKey({columns:[t.team,t.person]})]);
export const eventJudges=sqliteTable('event_judges',{person:text('person').primaryKey().references(()=>employees.id)});
export const teamScores=sqliteTable('team_scores',{team:text('team').notNull().references(()=>eventTeams.id),person:text('person').notNull().references(()=>employees.id),card:text('card').notNull(),stamp:integer('stamp').notNull()},t=>[primaryKey({columns:[t.team,t.person]})]);
export const teamFiles=sqliteTable('team_files',{team:text('team').notNull().references(()=>eventTeams.id),kind:text('kind').notNull(),objectKey:text('object_key').notNull(),name:text('name').notNull()},t=>[primaryKey({columns:[t.team,t.kind]})]);
export const teamAnnouncement=sqliteTable('team_announcement',{id:integer('id').primaryKey(),actor:text('actor').notNull()});

// Final-session presence and ballots are independent of portal logins and nomination votes.
export const finalBallotSettings=sqliteTable('final_ballot_settings',{id:integer('id').primaryKey(),phase:text('phase').notNull()});
export const finalSessionAttendance=sqliteTable('final_session_attendance',{person:text('person').primaryKey().references(()=>employees.id),checkedAt:integer('checked_at').notNull()});
export const finalSolutionBallots=sqliteTable('final_solution_ballots',{
 person:text('person').primaryKey().references(()=>finalSessionAttendance.person),
 team:text('team').notNull().references(()=>eventTeams.id),
 castAt:integer('cast_at').notNull(),
},t=>[index('final_solution_ballots_team_idx').on(t.team)]);

// Public editions are immutable: changing a jury card never rewrites an announcement.
export const resultPublications=sqliteTable('result_publications',{
 revision:integer('revision').primaryKey(),snapshot:text('snapshot').notNull(),
 publishedAt:integer('published_at').notNull(),actor:text('actor').notNull(),
});
