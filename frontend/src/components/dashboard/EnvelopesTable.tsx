"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { analyticsApi, EnvelopesTableItem, EnvelopesTableResponse } from '@/lib/analytics-api';
import { useLocalStorageCache } from '@/hooks/use-local-storage-cache';

type Props = {
  className?: string;
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

export const EnvelopesTable: React.FC<Props> = ({ className }) => {
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

  return (
    <div className={classNames('rounded-lg border border-gray-200 bg-white', className)}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Recent Envelopes</h3>
        <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
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
            className="min-w-[240px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Envelope</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Recipients</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sent</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Completed</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">Loading...</td>
              </tr>
            )}
            {error && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-rose-600">{error}</td>
              </tr>
            )}
            {!isLoading && !error && data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No envelopes found.</td>
              </tr>
            )}
            {!isLoading && !error && data && data.items.map((row: EnvelopesTableItem) => (
              <tr key={row.envelopeId} className="hover:bg-gray-50/60">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{row.name || '—'}</span>
                    <span className="text-xs text-gray-500">{row.envelopeId}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{row.recipients || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{row.sentDate ? new Date(row.sentDate).toLocaleDateString() : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{row.completedDate ? new Date(row.completedDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <span className={classNames('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', statusStyles[row.status] || statusStyles.unknown)}>
                    <span className={classNames('h-1.5 w-1.5 rounded-full',
                      row.status === 'completed' ? 'bg-green-600' :
                      row.status === 'sent' ? 'bg-blue-600' :
                      row.status === 'pending' ? 'bg-amber-600' :
                      row.status === 'declined' ? 'bg-rose-600' : 'bg-gray-500'
                    )} />
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 p-4 text-sm text-gray-600">
        <div>
          {data ? (
            <span>
              Showing <span className="font-medium">{(data.page - 1) * data.limit + (data.items.length > 0 ? 1 : 0)}</span> to <span className="font-medium">{(data.page - 1) * data.limit + data.items.length}</span> of <span className="font-medium">{data.total}</span>
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isLoading || page <= 1}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="select-none">Page {page} {data ? `of ${totalPages}` : ''}</span>
          <button
            onClick={() => setPage((p) => (data && page < totalPages ? p + 1 : p))}
            disabled={isLoading || !(data && page < totalPages)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnvelopesTable;
