import { parseAllowedOrigins, buildCorsOptions } from '../cors';

function decide(env: NodeJS.ProcessEnv, origin: string | undefined): boolean | undefined {
  const opts = buildCorsOptions(env);
  let result: boolean | undefined;
  (opts.origin as (o: string | undefined, cb: (e: Error | null, allow?: boolean) => void) => void)(
    origin,
    (_e, allow) => {
      result = allow;
    }
  );
  return result;
}

describe('parseAllowedOrigins', () => {
  it('should default to the Expo web dev origins outside production', () => {
    expect(parseAllowedOrigins({ NODE_ENV: 'development' })).toEqual([
      'http://localhost:8081',
      'http://localhost:19006',
    ]);
  });
  it('should default to no origins in production', () => {
    expect(parseAllowedOrigins({ NODE_ENV: 'production' })).toEqual([]);
  });
  it('should parse a comma-separated list and drop wildcards', () => {
    expect(parseAllowedOrigins({ NODE_ENV: 'production', CORS_ORIGINS: ' https://a.example , * ,https://b.example' })).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});

describe('buildCorsOptions', () => {
  const prod = { NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example' };
  it('should allow a listed origin', () => expect(decide(prod, 'https://app.example')).toBe(true));
  it('should reject an unlisted origin', () => expect(decide(prod, 'https://evil.example')).toBe(false));
  it('should allow requests without an Origin (native apps)', () => expect(decide(prod, undefined)).toBe(true));
  it('should reject every browser origin in production when unconfigured', () =>
    expect(decide({ NODE_ENV: 'production' }, 'http://localhost:8081')).toBe(false));
});
