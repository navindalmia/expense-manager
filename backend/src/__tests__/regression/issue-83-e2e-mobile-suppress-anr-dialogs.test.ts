import { readFileSync } from 'fs';
import { join } from 'path';

const ciYaml: string = readFileSync(join(__dirname, '../../../../.github/workflows/ci.yml'), 'utf8');

describe('e2e-mobile emulator script (run 36048606424)', () => {
  it('should suppress ANR dialogs before Maestro runs so the launcher ANR cannot cover the login screen', () => {
    const suppress: number = ciYaml.indexOf('adb shell settings put global hide_error_dialogs 1');
    const maestro: number = ciYaml.indexOf('maestro test ../maestro-flows/visual/');
    expect(suppress).toBeGreaterThan(-1);
    expect(maestro).toBeGreaterThan(-1);
    expect(suppress).toBeLessThan(maestro);
  });
});
