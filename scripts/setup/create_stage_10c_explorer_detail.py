#!/usr/bin/env python3
"""
Veritine - Stage 10c: dispute explorer + dispute detail redesign.

Run from: /Users/macbook/source-stake
Command:  python3 scripts/setup/create_stage_10c_explorer_detail.py
"""

import os
import sys

ROOT = os.getcwd()
FILES = {}

FILES["apps/web/app/disputes/page.tsx"] = """import Link from 'next/link';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { formatGen } from '../../lib/format-gen';
import { apiFetch } from '../../lib/api-client';

export const dynamic = 'force-dynamic';

interface DisputeSummary {
  id: string;
  question: string;
  category: string;
  status: string;
  totalStakeWei: string;
  participationDeadline: string;
  positions: Array<{ label: string; totalStakeWei: string }>;
}

async function fetchDisputes(searchParams: Record<string, string | undefined>): Promise<{ items: DisputeSummary[]; total: number }> {
  try {
    const params = new URLSearchParams();
    params.set('limit', '20');
    if (searchParams.status) params.set('status', searchParams.status);
    if (searchParams.category) params.set('category', searchParams.category);
    if (searchParams.search) params.set('search', searchParams.search);
    return await apiFetch<{ items: DisputeSummary[]; total: number }>(`/disputes?${params.toString()}`);
  } catch {
    return { items: [], total: 0 };
  }
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'text-primary border-primary/20 bg-surface-container-lowest',
  EVIDENCE_CLOSED: 'text-pending border-pending/20 bg-surface-container-lowest',
  ADJUDICATED: 'text-verified border-verified/20 bg-surface-container-lowest',
  CANCELLED: 'text-text-muted border-outline-variant bg-surface-container-lowest',
  INVALID: 'text-slashed border-slashed/20 bg-surface-container-lowest',
};

const CATEGORIES = ['CLIMATE', 'GOVERNANCE', 'TECH', 'MEDIA', 'FINANCE', 'PUBLIC_HEALTH', 'OTHER'];
const STATUSES = ['ACTIVE', 'EVIDENCE_CLOSED', 'ADJUDICATED', 'CANCELLED', 'INVALID'];

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}): Promise<React.ReactElement> {
  const { items: disputes, total } = await fetchDisputes(searchParams);

  return (
    <>
      <Navbar />
      <main className="mt-24 max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop pb-stack-lg min-h-[calc(100vh-128px)]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md mb-stack-lg">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Dispute Explorer</h1>
            <p className="text-text-muted font-body-sm text-body-sm max-w-xl">
              The authoritative registry of factual assertions undergoing decentralized adjudication.
            </p>
          </div>
          <Link
            href="/disputes/create"
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded font-bold text-body-sm hover:brightness-110 transition-all whitespace-nowrap"
          >
            Create Dispute
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter-desktop">
          <aside className="md:col-span-3 flex flex-col gap-stack-md">
            <div className="bg-surface ghost-border p-5 rounded">
              <h3 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
                Status
              </h3>
              <div className="flex flex-col gap-3">
                <Link href="/disputes" className={`text-body-sm ${!searchParams.status ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-primary'}`}>
                  All statuses
                </Link>
                {STATUSES.map((s) => (
                  <Link
                    key={s}
                    href={`/disputes?status=${s}`}
                    className={`text-body-sm ${searchParams.status === s ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    {s.replace('_', ' ')}
                  </Link>
                ))}
              </div>
            </div>
            <div className="bg-surface ghost-border p-5 rounded">
              <h3 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
                Category
              </h3>
              <div className="flex flex-col gap-3">
                <Link href="/disputes" className={`text-body-sm ${!searchParams.category ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-primary'}`}>
                  All categories
                </Link>
                {CATEGORIES.map((c) => (
                  <Link
                    key={c}
                    href={`/disputes?category=${c}`}
                    className={`text-body-sm ${searchParams.category === c ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <section className="md:col-span-9 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-text-muted">
                Showing <span className="text-on-surface font-semibold">{disputes.length}</span> of{' '}
                <span className="text-on-surface font-semibold">{total}</span> disputes
              </span>
            </div>

            {disputes.length === 0 && (
              <div className="bg-surface ghost-border rounded-lg p-stack-lg text-center text-text-muted">
                No disputes match these filters yet.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-stack-md">
              {disputes.map((dispute) => (
                <Link
                  key={dispute.id}
                  href={`/disputes/${dispute.id}`}
                  className="bg-surface ghost-border rounded-lg p-stack-md flex flex-col group hover:bg-surface-container-high transition-all duration-300 relative overflow-hidden"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-[4px] ${
                      dispute.status === 'ADJUDICATED'
                        ? 'bg-verified'
                        : dispute.status === 'EVIDENCE_CLOSED'
                          ? 'bg-pending'
                          : 'bg-primary-container'
                    }`}
                  />
                  <div className="flex justify-between items-start mb-4">
                    <span
                      className={`px-2 py-0.5 rounded font-label-caps text-[10px] uppercase border ${STATUS_STYLES[dispute.status] ?? ''}`}
                    >
                      {dispute.status.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1 text-text-muted">
                      <span className="material-symbols-outlined text-[14px]">category</span>
                      <span className="font-label-caps text-[11px]">{dispute.category}</span>
                    </div>
                  </div>
                  <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface leading-snug mb-stack-lg group-hover:text-primary transition-colors">
                    {dispute.question}
                  </h2>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4 border-t border-border-subtle">
                    <div>
                      <p className="text-label-caps text-text-muted text-[10px] mb-1">TOTAL STAKED</p>
                      <p className="font-code-sm text-primary">{formatGen(dispute.totalStakeWei)} GEN</p>
                    </div>
                    <div>
                      <p className="text-label-caps text-text-muted text-[10px] mb-1">POSITIONS</p>
                      <p className="font-code-sm text-on-surface">{dispute.positions.length}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
"""


def main():
    written = []
    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(rel_path)
    print(f"Wrote {len(written)} files:")
    for p in written:
        print(f"  + {p}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
