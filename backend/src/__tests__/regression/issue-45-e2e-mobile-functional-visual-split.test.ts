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

  it('should run each flow (including its assertScreenshot step) with per-flow retry', () => {
    expect(runner).toMatch(/for attempt in/);
    expect(runner).not.toContain("grep -v '^- assertScreenshot'");
  });

  it('should make the visual/assertScreenshot pass blocking on the job exit code', () => {
    expect(runner).toMatch(/\[ "\$failed" -eq 0 \]\s*$/);
    expect(runner).not.toMatch(/\|\|\s*true\s*$/m);
  });

  it('should document that visual baselines were regenerated from CI-emulator screenshots', () => {
    expect(ciYaml).toContain('regenerated from real CI-emulator screenshots');
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
