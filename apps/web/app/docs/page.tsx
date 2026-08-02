import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

const SECTIONS = [
  {
    id: 'how-it-works',
    title: 'How Veritine Works',
    body: 'Veritine turns a controversial, verifiable factual question into a structured dispute. Participants propose competing positions and back them with evidence — a source URL, publisher, and a summary of how the source supports the claim. Both positions and individual evidence items can carry a GEN stake. At the evidence deadline, the Veritine Intelligent Contract independently fetches every cited source, evaluates it, and settles the dispute.',
  },
  {
    id: 'evidence-rules',
    title: 'Evidence Rules',
    body: 'Evidence must include a working source URL, a title, a publisher, and a written summary of how it supports the position it is submitted for. The contract never trusts the submitter’s description — it independently fetches and evaluates the cited source before any economic outcome is applied.',
  },
  {
    id: 'evidence-quality',
    title: 'Evidence-Quality Methodology',
    body: 'Every piece of evidence is classified into one of ten outcome tiers, evaluated on authenticity, source authority, relevance, timeliness, claim support, materiality, and misrepresentation. Classification is performed by GenLayer validators independently re-fetching and re-evaluating each source, not a single trusted party.',
  },
  {
    id: 'staking-rules',
    title: 'Staking Rules',
    body: 'Position stakes back a specific answer to the dispute question. Evidence stakes back a specific piece of evidence, independent of which position ultimately wins. Minimum stake amounts are set per-dispute (with a platform-wide floor) to deter spam.',
  },
  {
    id: 'slashing-rules',
    title: 'Slashing Rules',
    body: 'Evidence is slashed 0-100% based purely on its own adjudicated quality — strongly supported evidence is never slashed, fabricated or maliciously manipulated evidence is slashed in full. Evidence is never slashed merely for supporting the losing position. See the full economic model for the exact percentage table.',
  },
  {
    id: 'adjudication-methodology',
    title: 'Adjudication Methodology',
    body: 'GenLayer validators fetch every cited source directly, cross-check it against the submitter’s claim, and independently re-derive a verdict rather than trusting the leader’s output. The final dispute conclusion weighs every already-adjudicated evidence item across all positions before deciding which position (if any) is supported.',
  },
  {
    id: 'rewards',
    title: 'Rewards',
    body: 'Strongly-supported and credible evidence share a reward pool funded by slashed stakes from lower-quality evidence in the same dispute (90% to reward-eligible stakers, 10% to the protocol treasury). Winning-position stakers receive their principal back plus a proportional share of the losing positions’ pooled stake, minus a 2% protocol fee.',
  },
  {
    id: 'security',
    title: 'Security',
    body: 'The contract treats fetched web content as untrusted data at every step — evaluation prompts explicitly instruct the model to ignore any instructions embedded in a source page. Every GEN-moving function follows a strict zero-then-transfer escrow ordering to prevent double-spend. See SECURITY.md in the repository for the full threat model.',
  },
  {
    id: 'transparency',
    title: 'Transparency Report',
    body: 'Every dispute, stake, evidence submission, and adjudication verdict is recorded on-chain and viewable in the Dispute Explorer. The deployed contract exposes get_evidence_outcome_economics() so the exact approved slash/reward table can be verified on-chain at any time.',
  },
];

export default function DocsPage(): React.ReactElement {
  return (
    <>
      <Navbar />
      <main className="mt-24 max-w-[840px] mx-auto px-gutter-mobile pb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-stack-sm">Documentation</h1>
        <p className="text-text-muted mb-stack-lg">
          How Veritine works, the evidence and staking rules, and the security model behind the GenLayer
          Intelligent Contract.
        </p>

        <nav className="flex flex-wrap gap-stack-sm mb-stack-lg">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-1 rounded-full border border-border-subtle text-body-sm text-on-surface-variant hover:text-primary hover:border-primary/30"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-stack-lg">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="bg-surface ghost-border rounded-lg p-stack-md scroll-mt-24">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-stack-sm">
                {s.title}
              </h2>
              <p className="text-text-muted leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
