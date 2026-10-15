import { useState } from 'react';
import { useShop } from '../shop';
import { TEST_DEFINITIONS, runAllBugTests, runBugTest } from '../tests/bugTests';
import type { TestId, TestResult } from '../tests/bugTests';
import type { TraceStep } from '../api';

/** Compact JSON preview of one HTTP call recorded during a test. */
function TraceView({ trace }: { trace: TraceStep[] }) {
  if (trace.length === 0) return <p className="trace__empty">No calls recorded.</p>;
  return (
    <ol className="trace">
      {trace.map((step, index) => {
        const failed = step.status >= 400 || step.status === 0;
        return (
          <li key={index} className={failed ? 'trace__step is-error' : 'trace__step'}>
            <code>
              {step.method} {step.path}
            </code>
            <span className="trace__status">→ {step.status || 'no response'}</span>
            {step.request !== undefined && <pre>{JSON.stringify(step.request)}</pre>}
            <pre>{JSON.stringify(step.response)}</pre>
          </li>
        );
      })}
    </ol>
  );
}

function ResultCard({ result }: { result: TestResult }) {
  return (
    <article className={result.passed ? 'result result--pass' : 'result result--fail'}>
      <header className="result__head">
        <div>
          <h4>{result.name}</h4>
          <p className="result__bug">{result.bug}</p>
        </div>
        <span className={result.passed ? 'verdict verdict--pass' : 'verdict verdict--fail'}>
          {result.passed ? 'PASS' : 'FAIL'}
        </span>
      </header>

      <dl className="result__body">
        <dt>Scenario</dt>
        <dd>{result.scenario}</dd>
        <dt>Expected result</dt>
        <dd>{result.expected}</dd>
        <dt>Actual result</dt>
        <dd>{result.actual}</dd>
      </dl>

      <p className="result__explanation">{result.explanation}</p>

      <details className="result__trace">
        <summary>HTTP trace ({result.trace.length} calls, {result.durationMs} ms)</summary>
        <TraceView trace={result.trace} />
      </details>
    </article>
  );
}

export default function BugLab({
  results,
  onResults,
}: {
  results: TestResult[];
  onResults: (results: TestResult[]) => void;
}) {
  const { mode, refresh, busy } = useShop();
  const [running, setRunning] = useState<TestId | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runOne = async (id: TestId) => {
    setRunning(id);
    setError(null);
    try {
      const result = await runBugTest(id, mode);
      onResults([...results.filter((item) => item.id !== id), result]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(null);
      void refresh(); // show any stock change the test caused
    }
  };

  const runAll = async () => {
    setRunning('all');
    setError(null);
    try {
      const all = await runAllBugTests(mode, () => undefined);
      onResults(all);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(null);
      void refresh();
    }
  };

  const clear = () => {
    onResults([]);
    setError(null);
  };

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;
  const finished = results.length === TEST_DEFINITIONS.length;

  return (
    <section className="panel lab" id="bug-lab">
      <header className="lab__head">
        <div>
          <h3>Self-check suite</h3>
          <p>
            Presenter only. Four reproducible checks against the real API &mdash; run them before the talk and again at
            the end. The audience never sees this panel.
          </p>
        </div>
        <span className={mode === 'buggy' ? 'tag tag--buggy' : 'tag tag--fixed'}>
          {mode === 'buggy' ? 'buggy mode' : 'fixed mode'}
        </span>
      </header>

      <div className="lab__buttons">
        {TEST_DEFINITIONS.map((test) => (
          <button
            key={test.id}
            type="button"
            className="btn btn--test"
            onClick={() => void runOne(test.id)}
            disabled={running !== null || busy}
          >
            {running === test.id ? 'Running…' : test.button}
          </button>
        ))}
      </div>

      <div className="lab__toolbar">
        <button type="button" className="btn btn--primary" onClick={() => void runAll()} disabled={running !== null || busy}>
          {running === 'all' ? 'Running all four…' : 'Run all four tests'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={clear} disabled={results.length === 0}>
          Clear results
        </button>
        {results.length > 0 && (
          <span className="lab__tally">
            <span className="verdict verdict--pass">{passedCount} pass</span>
            <span className="verdict verdict--fail">{failedCount} fail</span>
          </span>
        )}
      </div>

      {error && <div className="alert alert--danger">Test run failed: {error}</div>}

      {results.length === 0 ? (
        <p className="lab__empty">
          Run a single test, or run all four. Switch the mode in the banner above and run them again &mdash; the same
          scenarios produce different verdicts.
        </p>
      ) : (
        <div className="lab__results">
          {TEST_DEFINITIONS.map((test) => {
            const result = results.find((item) => item.id === test.id);
            return result ? <ResultCard key={test.id} result={result} /> : null;
          })}
        </div>
      )}

      {finished && (
        <div className={failedCount === 0 ? 'alert alert--success' : 'alert alert--danger'}>
          {failedCount === 0
            ? `All ${results.length} checks passed in ${mode.toUpperCase()} mode. The checkout now survives questioning.`
            : `${failedCount} of ${results.length} checks failed in ${mode.toUpperCase()} mode. Each failure is evidence against the claim "our shopping website works perfectly".`}
        </div>
      )}
    </section>
  );
}