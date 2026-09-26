import { readFileSync } from 'fs';
import { join } from 'path';

const root: string = join(__dirname, '../../../..');
const ciYaml: string = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
const runner: string = readFileSync(join(root, 'scripts/run-maestro-ci.sh'), 'utf8');

describe('e2e-mobile functional/visual split (PR #85)', () => {
  it('should invoke the split runner instead of a whole-suite retry loop', () => {
    expect(ciYaml).toContain('bash ../scripts/run-maestro-ci.sh');
    expect(ciYaml).not.toContain('for i in 1 2 3; do maestro test');
  });

  it('should strip assertScreenshot for the blocking functional pass and retry per flow', () => {
    expect(runner).toContain("grep -v '^- assertScreenshot'");
    expect(runner).toMatch(/for attempt in/);
  });

  it('should keep the visual pass non-blocking and the exit code functional-only', () => {
    expect(runner).toMatch(/maestro test "\$SRC" 2>&1 \| tee .* \|\| true/);
    expect(runner).toMatch(/\[ "\$failed" -eq 0 \]\s*$/);
  });

  it('should document that visual baselines need CI-emulator regeneration', () => {
    expect(ciYaml).toContain('regenerated from CI-emulator screenshots');
  });

  it('should bound the e2e-mobile timeouts to measured durations', () => {
    expect(ciYaml).toContain('timeout-minutes: 35');
    expect(ciYaml).not.toContain('timeout-minutes: 40');
  });

  it('should wait for the login screen instead of asserting immediately after launch', () => {
    const flow: string = readFileSync(join(root, 'maestro-flows/visual/login-screen.yaml'), 'utf8');
    expect(flow).toContain('extendedWaitUntil');
  });
});
