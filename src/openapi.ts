import { z } from 'zod';
import { registrationCredentials, loginCredentials } from './controllers/auth.controller';
import * as profiles from './modules/profiles/schemas';
import * as market from './modules/marketplace/schemas';
import { tutorSearchSchema } from './modules/search/schemas';

type Operation = Record<string, unknown>;
const paths: Record<string, Record<string, Operation>> = {};
function operation(
  path: string,
  method: string,
  tag: string,
  summary: string,
  body?: z.ZodType,
  isPublic = false,
  query?: z.ZodType,
  status = '200',
) {
  const parameters: Record<string, unknown>[] = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: { type: 'string', maxLength: 36 },
  }));
  if (query) {
    const json = z.toJSONSchema(query) as { properties?: Record<string, unknown> };
    for (const [name, schema] of Object.entries(json.properties ?? {}))
      parameters.push({ name, in: 'query', schema });
  }
  (paths[path] ??= {})[method] = {
    tags: [tag],
    summary,
    security: isPublic ? [] : [{ bearerAuth: [] }],
    parameters,
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: z.toJSONSchema(body) } },
          },
        }
      : {}),
    responses: {
      [status]: {
        description: 'Success. JSON responses are wrapped in data; DELETE returns no body.',
      },
      '400': { description: 'Invalid request' },
      '401': { description: 'Authentication required or revoked session' },
      '403': { description: 'Insufficient role or ownership' },
      '404': { description: 'Record not found' },
      '409': { description: 'Invalid transition, duplicate or concurrency conflict' },
      '422': { description: 'Domain rule violation' },
      '429': { description: 'Rate limit exceeded' },
    },
  };
}
operation(
  '/api/v1/auth/register',
  'post',
  'Auth foundation',
  'Register a LOCAL account; return access token and HttpOnly refresh cookie',
  registrationCredentials,
  true,
  undefined,
  '201',
);
operation('/api/v1/auth/login', 'post', 'Auth foundation', 'LOCAL login', loginCredentials, true);
for (const path of ['refresh', 'refresh-token']) {
  operation(
    `/api/v1/auth/${path}`,
    'post',
    'Auth foundation',
    'Rotate the 7-day refresh cookie; access JWT lasts 15 minutes',
  );
  paths[`/api/v1/auth/${path}`]!.post!.security = [{ refreshCookie: [] }];
}
operation(
  '/api/v1/auth/logout',
  'post',
  'Auth foundation',
  'Durably revoke current user_sessions record',
  undefined,
  false,
  undefined,
  '204',
);
operation(
  '/api/v1/auth/sessions',
  'get',
  'Auth',
  'List own active sessions without refresh hashes',
);
operation(
  '/api/v1/auth/sessions/{id}',
  'delete',
  'Auth',
  'Revoke an owned active session immediately',
  undefined,
  false,
  undefined,
  '204',
);
operation(
  '/api/v1/auth/oauth/{provider}',
  'post',
  'Auth',
  'Reserved OAuth integration; currently returns 501',
  undefined,
  true,
);
paths['/api/v1/auth/oauth/{provider}']!.post!.responses = {
  '501': { description: 'OAuth integration is not implemented' },
};
operation('/api/v1/users/me', 'get', 'Identity', 'Get account roles and current UI mode');
operation(
  '/api/v1/users/me/mode',
  'patch',
  'Identity',
  'Switch UI mode within held roles',
  z.object({ current_mode: z.enum(['STUDENT', 'TUTOR', 'ADMIN']) }).strict(),
);
operation('/api/v1/subjects', 'get', 'Subjects', 'List active subjects', undefined, true);
operation('/api/v1/subjects/{id}', 'get', 'Subjects', 'Get an active subject', undefined, true);
operation(
  '/api/v1/profiles/student',
  'post',
  'Student Profile',
  'Create own student profile',
  profiles.createStudentSchema,
  false,
  undefined,
  '201',
);
operation(
  '/api/v1/profiles/tutor',
  'post',
  'Tutor Profile',
  'Create own tutor profile and grant TUTOR role',
  profiles.createTutorSchema,
  false,
  undefined,
  '201',
);
operation('/api/v1/students/me', 'get', 'Student Profile', 'Get own private profile and contacts');
operation(
  '/api/v1/students/me',
  'put',
  'Student Profile',
  'Update specified profile fields',
  profiles.updateStudentSchema,
);
operation(
  '/api/v1/students/me/emergency-contact',
  'put',
  'Student Profile',
  'Update private parent and emergency contacts',
  profiles.contactSchema,
);
operation('/api/v1/tutors/me', 'get', 'Tutor Profile', 'Get own private tutor profile');
for (const method of ['put', 'patch'])
  operation(
    '/api/v1/tutors/me',
    method,
    'Tutor Profile',
    'Update permitted fields; legal-name changes require review',
    profiles.updateTutorSchema,
  );
operation(
  '/api/v1/tutors/me/education',
  'post',
  'Tutor Profile',
  'Add unverified education with an owned evidence file',
  profiles.educationSchema,
  false,
  undefined,
  '201',
);
operation(
  '/api/v1/tutors/me/education/{id}',
  'delete',
  'Tutor Profile',
  'Soft-delete unverified education; verified education requires review',
  undefined,
  false,
  undefined,
  '204',
);
operation('/api/v1/tutors/me/availability', 'get', 'Tutor Profile', 'Get own active availability');
operation(
  '/api/v1/tutors/me/availability',
  'put',
  'Tutor Profile',
  'Replace availability atomically; retain inactive history',
  profiles.availabilitySchema,
);
operation(
  '/api/v1/tutors/me/subjects',
  'put',
  'Tutor Profile',
  'Replace offered subjects atomically',
  profiles.subjectsSchema,
);
operation(
  '/api/v1/tutors/me/change-requests',
  'post',
  'Tutor Profile',
  'Submit LEGAL_NAME or EDUCATION request; never apply without admin review',
  profiles.changeRequestSchema,
  false,
  undefined,
  '201',
);
operation(
  '/api/v1/tutors',
  'get',
  'Tutor Search',
  'Discover current active tutors; newest first with keyset cursor',
  undefined,
  true,
  tutorSearchSchema,
);
operation(
  '/api/v1/tutors/{id}',
  'get',
  'Tutor Search',
  'Public profile projection excludes precise location, contacts, bank and private files',
  undefined,
  true,
);
operation(
  '/api/v1/tutors/{id}/availability',
  'get',
  'Tutor Search',
  'Public availability of an eligible tutor',
  undefined,
  true,
);
operation(
  '/api/v1/jobs',
  'get',
  'Marketplace',
  'Public open-job feed; budget filters use intersecting ranges',
  undefined,
  true,
  market.jobSearchSchema,
);
operation(
  '/api/v1/jobs',
  'post',
  'Marketplace',
  'Create own student job',
  market.jobSchema,
  false,
  undefined,
  '201',
);
operation(
  '/api/v1/jobs/{id}',
  'get',
  'Marketplace',
  'Public job projection excludes exact meeting coordinates',
  undefined,
  true,
);
operation(
  '/api/v1/jobs/{id}/status',
  'patch',
  'Marketplace',
  'Owner closes or cancels an OPEN job; reject pending applications',
  market.jobStatusSchema,
);
operation('/api/v1/jobs/{id}/share', 'post', 'Marketplace', 'Atomically increment share_count');
operation(
  '/api/v1/jobs/{id}/applications',
  'get',
  'Marketplace',
  'Owner sees all applications; tutors see only their own, capped at 100',
);
for (const path of ['/api/v1/jobs/{id}/apply', '/api/v1/jobs/{id}/applications'])
  operation(
    path,
    'post',
    'Marketplace',
    'Apply as an eligible tutor; duplicate guard uses the job row lock',
    market.applicationSchema,
    false,
    undefined,
    '201',
  );
operation(
  '/api/v1/applications/{id}/status',
  'patch',
  'Marketplace',
  'Owner accepts/rejects; applicant withdraws. Acceptance snapshots the proposed rate into one booking',
  market.applicationStatusSchema,
);
operation(
  '/api/v1/jobs/{jobId}/applications/{id}/accept',
  'post',
  'Marketplace',
  'TRD acceptance alias; choose ONLINE/ONSITE for BOTH jobs',
  market.acceptanceSchema,
);

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'TewsDay API',
    version: '0.1.0',
    description:
      'Four Kong-owned Notion modules plus LOCAL auth/profile onboarding prerequisites. Canonical Database Schema V2. AI/Embedding is a separate extension. PUT /me updates only supplied fields; availability and subjects PUT replace their collections.',
  },
  servers: [{ url: '/' }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'refresh_token' },
    },
  },
};
