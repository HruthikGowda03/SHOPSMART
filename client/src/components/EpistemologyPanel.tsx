import type { TestResult } from '../tests/bugTests';
import { TEST_DEFINITIONS } from '../tests/bugTests';

/**
 * Presenter notes: the same manual investigations framed as an argument.
 * Claim -> Question -> Investigation -> Conclusion.
 * Rendered only inside the hidden presenter panel.
 */
export default function EpistemologyPanel({ results }: { results: TestResult[] }) {
  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;

  const conclusion =
    results.length === 0
      ? 'No evidence collected yet. Run the four self-checks above and this conclusion updates itself.'
      : failedCount > 0
        ? `${failedCount} of ${results.length} checks failed, so the claim is not yet supported. In BUGGY mode the same claim collapses the moment anyone asks a question.`
        : `All ${results.length} checks passed, so the claim survives this investigation - in FIXED mode the evidence supports it.`;

  return (
    <section className="panel claim" id="question-the-claim">
      <h3>Presenter notes — claim, question, evidence</h3>

      <ol className="claim__steps">
        <li>
          <span className="claim__tag">Claim</span>
          <p>&ldquo;Our shopping website works perfectly.&rdquo;</p>
        </li>
        <li>
          <span className="claim__tag">Question</span>
          <p>&ldquo;What evidence proves the checkout is correct?&rdquo;</p>
        </li>
        <li>
          <span className="claim__tag">Investigation</span>
          <p>
            Ask the audience to shop like a real customer: change quantities, remove something, check the delivery
            line, and try to pay. Whatever they notice is the evidence &mdash; the same four checks below prove it
            reproducibly.
          </p>
        </li>
        <li>
          <span className="claim__tag">Conclusion</span>
          <p className="claim__conclusion">{conclusion}</p>
        </li>
      </ol>

      <div className="claim__theory">
        <p>
          <strong>Dialectics</strong> means you never accept a claim at face value: you question it, you build the
          strongest counterargument (&ldquo;what if the customer underpays?&rdquo;) and you let the counterargument
          answer back. In this demo the audience builds those counterarguments themselves by shopping, and the buggy
          build lets them stand unanswered.
        </p>
        <p>
          <strong>Skepticism</strong> is the habit of withholding judgement until evidence arrives. &ldquo;It looks
          fine&rdquo; is not evidence; a reproducible test that hits the real API is. Switching between the two modes
          and watching the same checks change verdict closes the argument.
        </p>
      </div>

      <div className="claim__progress" aria-label="Test progress">
        {TEST_DEFINITIONS.map((test) => {
          const result = results.find((item) => item.id === test.id);
          const state = result ? (result.passed ? 'pass' : 'fail') : 'idle';
          return (
            <span key={test.id} className={`chip chip--${state}`}>
              {test.name}
            </span>
          );
        })}
        <span className="claim__score">
          {passedCount}/{TEST_DEFINITIONS.length} checks passed
        </span>
      </div>
    </section>
  );
}