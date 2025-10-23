"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { analyticsApi, EnvelopesTableItem, EnvelopesTableResponse } from '@/lib/analytics-api';
import { useLocalStorageCache } from '@/hooks/use-local-storage-cache';
import { DashboardInsightPayload } from './insights';

type Props = {
  className?: string;
  onOpenInsight?: (payload: DashboardInsightPayload) => void;
};

function classNames(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

const statusStyles: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
  sent: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  declined: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
  voided: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-400/40',
  unknown: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-400/40',
};

export const EnvelopesTable: React.FC<Props> = ({ className, onOpenInsight }) => {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>(''); // empty means all
  const limit = 12;
  const cacheKey = useMemo(() => {
    // compose a key from paging + filters to avoid collisions
    return `analytics:envelopes-table:v1:limit=${limit}:page=${page}:q=${q.trim()}:status=${status || ''}`;
  }, [page, q, status]);

  const TEN_MIN = 10 * 60 * 1000;
  const [data, setData, isHydrated, isFresh] = useLocalStorageCache<EnvelopesTableResponse | null>(cacheKey, null, TEN_MIN);

  

  useEffect(() => {
    if (!isHydrated) return;
    // If cache is fresh, don't refetch
    if (isFresh && data && Array.isArray(data.items)) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    analyticsApi
      .getEnvelopesTable({ limit, page, q: q.trim() || undefined, status: status || undefined, signal: controller.signal })
      .then((res) => setData(res))
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        console.error('[EnvelopesTable] failed:', err);
        setError('Failed to load envelopes');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [page, q, status, isHydrated, isFresh, cacheKey, data]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil((data.total ?? 0) / (data.limit || limit)));
  }, [data]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1); // reset to first page
  }

  const handleRowInsightClick = (row: EnvelopesTableItem) => {
    if (!onOpenInsight) return;

    const summary = `Envelope ${row.envelopeId}: ${row.name || 'Unnamed'}, status ${row.status}, sent ${row.sentDate ? new Date(row.sentDate).toLocaleDateString() : '—'}, completed ${row.completedDate ? new Date(row.completedDate).toLocaleDateString() : '—'}, recipients: ${row.recipients || '—'}.`;

    onOpenInsight({
      title: `Envelope: ${row.name || row.envelopeId}`,
      summary,
      data: row,
      metadata: {
        component: 'envelopes-table-row',
        envelopeId: row.envelopeId,
        status: row.status,
      },
    });
  };

  return (
    <div className={classNames('relative rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent Envelopes</h3>
          <p className="mt-1 text-sm text-gray-500">Track and manage your DocuSign envelopes</p>
        </div>
        <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3.5  py-2 text-sm shadow-sm transition-all hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Filter by status"
          >
            <option value="" >All statuses</option>
            <option value="completed">Completed</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="declined">Declined</option>
            <option value="voided">Voided</option>
            <option value="delivered">Delivered</option>
            <option value="created">Created</option>
          </select>
          <input
            type="text"
            placeholder="Search by subject, ID or recipient..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[240px] rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm transition-all hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Envelope</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Recipients</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Sent</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Completed</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
                    <span className="text-sm text-gray-500">Loading envelopes...</span>
                  </div>
                </td>
              </tr>
            )}
            {error && !isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-10 w-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-rose-600">{error}</span>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && !error && data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900">No envelopes found</p>
                      <p className="mt-1 text-xs text-gray-500">Try adjusting your search or filter criteria</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && !error && data && data.items.map((row: EnvelopesTableItem) => (
              <tr key={row.envelopeId} className="relative group transition-colors hover:bg-blue-50/30">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900">{row.name || '—'}</span>
                    <span className="font-mono text-xs text-gray-500">{row.envelopeId}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-700">{row.recipients || '—'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{row.sentDate ? new Date(row.sentDate).toLocaleDateString() : '—'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{row.completedDate ? new Date(row.completedDate).toLocaleDateString() : '—'}</td>
                <td className="px-6 py-4">
                  <span className={classNames('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', statusStyles[row.status] || statusStyles.unknown)}>
                    <span className={classNames('h-2 w-2 rounded-full',
                      row.status === 'completed' ? 'bg-green-600' :
                      row.status === 'sent' ? 'bg-blue-600' :
                      row.status === 'pending' ? 'bg-amber-600' :
                      row.status === 'declined' ? 'bg-rose-600' : 'bg-gray-500'
                    )} />
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                </td>
                {onOpenInsight && (
                  <button
                    type="button"
                    onClick={() => handleRowInsightClick(row)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white/95 p-2 text-amber-500 shadow-lg transition-all duration-200 hover:scale-105 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    aria-label="Ask AI about this envelope"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/30 px-6 py-4 text-sm">
        <div className="text-gray-600">
          {data ? (
            <span>
              Showing <span className="font-semibold text-gray-900">{(data.page - 1) * data.limit + (data.items.length > 0 ? 1 : 0)}</span> to <span className="font-semibold text-gray-900">{(data.page - 1) * data.limit + data.items.length}</span> of <span className="font-semibold text-gray-900">{data.total}</span> results
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isLoading || page <= 1}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <span className="select-none text-sm font-medium text-gray-700">
            Page <span className="text-gray-900">{page}</span> {data ? `of ${totalPages}` : ''}
          </span>
          <button
            onClick={() => setPage((p) => (data && page < totalPages ? p + 1 : p))}
            disabled={isLoading || !(data && page < totalPages)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
          >
            Next
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnvelopesTable;
