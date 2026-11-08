/**
 * Runs a scripts/visual-gen entry point as __main__ under fake heavy packages, through the
 * `python -I` harness. Not a test file.
 */
import { spawnSync } from 'node:child_process';
import { PYTHON, runPy, type PyRun } from '@/__tests__/scripts/visualGenPyHarness';

export const numpyAvailable = spawnSync(PYTHON, ['-I', '-c', 'import numpy']).status === 0;

const PREAMBLE = [
  'import sys, types, io, runpy, unittest.mock as m',
  'def fake(name, **attrs):',
  '    mod = types.ModuleType(name); mod.__dict__.update(attrs); sys.modules[name] = mod; return mod',
  'def fake_vlm(reply):',
  '    torch = m.MagicMock(); torch.cuda.is_available.return_value = False; sys.modules["torch"] = torch',
  '    fake("PIL", Image=m.MagicMock())',
  '    model = m.MagicMock(); proc = m.MagicMock()',
  '    proc.batch_decode.side_effect = lambda *a, **k: [reply]',
  '    auto = m.MagicMock(); auto.from_pretrained.return_value = model',
  '    autop = m.MagicMock(); autop.from_pretrained.return_value = proc',
  '    fake("transformers", AutoModelForImageTextToText=auto, AutoProcessor=autop)',
  '    return model, auto',
  'def run(path, argv, encoding=None):',
  '    if encoding:',
  '        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding=encoding, line_buffering=True)',
  '    sys.argv = [path] + argv',
  '    try:',
  '        runpy.run_path(path, run_name="__main__"); print("EXIT=0")',
  '    except SystemExit as e:',
  '        code = e.code',
  '        if not isinstance(code, int) and code is not None:',
  '            print("MESSAGE=" + str(code)); code = 1',
  '        print("EXIT=%s" % (code or 0))',
  '',
].join('\n');

export const drive = (body: string): PyRun => runPy(['-c', `${PREAMBLE}${body}`]);
export const pyStr = (s: string): string => JSON.stringify(s);
