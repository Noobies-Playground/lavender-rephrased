import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../api/client';
import { ProcessItem, ProcessesOverviewResponse } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { CustomSelect, SelectOption } from '../../components/common/CustomSelect';
import { formatMemKb } from '../../utils/formatters';
import {
  Activity,
  Search,
  RefreshCw,
  ArrowUpDown,
  Layers,
  Clock,
} from 'lucide-react';

function parseCommand(cmd: string | undefined): { binName: string; binPath: string; args: string } {
  if (!cmd) return { binName: '—', binPath: '', args: '' };
  const trimmed = cmd.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return { binName: trimmed, binPath: '', args: '' };
  }
  const firstSpace = trimmed.indexOf(' ');
  let exe = trimmed;
  let args = '';
  if (firstSpace !== -1) {
    exe = trimmed.substring(0, firstSpace);
    args = trimmed.substring(firstSpace + 1);
  }
  const slashIdx = exe.lastIndexOf('/');
  const binName = slashIdx !== -1 ? exe.substring(slashIdx + 1) : exe;
  const binPath = slashIdx !== -1 ? exe.substring(0, slashIdx + 1) : '';
  return { binName, binPath, args };
}

export const ProcessesPage: React.FC = () => {
  const { addToast } = useToast();
  const [data, setData] = useState<ProcessesOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'mem' | 'cpu' | 'pid' | 'name' | 'user'>('mem');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Kill process state
  const [pendingKill, setPendingKill] = useState<ProcessItem | null>(null);
  const [killLoading, setKillLoading] = useState(false);

  const loadProcesses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Use limit=0 to retrieve all processes for client-side search & filtering
      const res = await api.get<ProcessesOverviewResponse>(
        `/api/system/processes?sort_by=${sortBy}&limit=0`
      );
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch processes';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortBy, addToast]);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  // Auto-refresh interval (5s)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      if (!document.hidden) {
        loadProcesses(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadProcesses]);

  // Counts per user for the user dropdown
  const userCounts = useMemo(() => {
    if (!data?.processes) return {};
    const counts: Record<string, number> = {};
    for (const p of data.processes) {
      const u = p.user || 'unknown';
      counts[u] = (counts[u] || 0) + 1;
    }
    return counts;
  }, [data?.processes]);

  const uniqueUsers = useMemo(() => {
    return Object.keys(userCounts).sort();
  }, [userCounts]);

  const userOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [
      { value: 'all', label: `All Users (${data?.processes?.length || 0})` },
    ];
    for (const u of uniqueUsers) {
      list.push({
        value: u,
        label: u,
        count: userCounts[u],
      });
    }
    return list;
  }, [uniqueUsers, userCounts, data?.processes?.length]);

  const sortOptions = useMemo(
    () => [
      { value: 'mem', label: 'Memory (Highest)' },
      { value: 'cpu', label: 'CPU (Highest)' },
      { value: 'pid', label: 'PID (Ascending)' },
      { value: 'name', label: 'Name (A–Z)' },
    ],
    []
  );

  const showOptions = useMemo(
    () => [
      { value: 25, label: '25' },
      { value: 50, label: '50' },
      { value: 100, label: '100' },
      { value: 'all', label: 'All' },
    ],
    []
  );

  // Filter & sort processes
  const filteredProcesses = useMemo(() => {
    if (!data?.processes) return [];
    const q = search.trim().toLowerCase();

    return data.processes
      .filter((p) => {
        if (userFilter !== 'all' && p.user !== userFilter) return false;
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.command.toLowerCase().includes(q) ||
          p.user.toLowerCase().includes(q) ||
          String(p.pid).includes(q)
        );
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'pid') {
          cmp = (a.pid || 0) - (b.pid || 0);
        } else if (sortBy === 'user') {
          cmp = (a.user || '').localeCompare(b.user || '');
        } else if (sortBy === 'cpu') {
          const cpuA = a.cpu || a.cpu_time || 0;
          const cpuB = b.cpu || b.cpu_time || 0;
          cmp = cpuA - cpuB;
        } else if (sortBy === 'name') {
          const cmdA = (a.name || a.command || '').toLowerCase();
          const cmdB = (b.name || b.command || '').toLowerCase();
          cmp = cmdA.localeCompare(cmdB);
        } else {
          // 'mem'
          cmp = (a.mem || 0) - (b.mem || 0);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [data?.processes, search, userFilter, sortBy, sortOrder]);

  const effectivePageSize = pageSize === 'all' ? Infinity : pageSize;
  const totalPages =
    effectivePageSize === Infinity ? 1 : Math.max(1, Math.ceil(filteredProcesses.length / effectivePageSize));

  const paginatedProcesses = useMemo(() => {
    if (effectivePageSize === Infinity) return filteredProcesses;
    const start = (currentPage - 1) * effectivePageSize;
    return filteredProcesses.slice(start, start + effectivePageSize);
  }, [filteredProcesses, currentPage, effectivePageSize]);

  // Handle Sort Change from column header click
  const handleSort = (field: 'mem' | 'cpu' | 'pid' | 'name' | 'user') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'pid' || field === 'name' || field === 'user' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  // Handle Sort Change from dropdown
  const handleSortDropdown = (field: 'mem' | 'cpu' | 'pid' | 'name') => {
    setSortBy(field);
    setSortOrder(field === 'pid' || field === 'name' ? 'asc' : 'desc');
    setCurrentPage(1);
  };

  // Kill Process
  const handleConfirmKill = async () => {
    if (!pendingKill) return;
    setKillLoading(true);
    try {
      const res = await api.post<{ success: boolean; output?: string }>(
        `/api/system/processes/kill?pid=${pendingKill.pid}`
      );
      if (res.success) {
        addToast(`Process ${pendingKill.name || pendingKill.pid} (PID ${pendingKill.pid}) terminated`, 'success');
        setPendingKill(null);
        await loadProcesses(true);
      } else {
        addToast(res.output || `Failed to kill PID ${pendingKill.pid}`, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to kill process`;
      addToast(msg, 'error');
    } finally {
      setKillLoading(false);
    }
  };

  const loadInfo = data?.load;
  const parsedMem = data?.memory?.parsed;
  const memPercent = parsedMem?.percent ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── System Resource Summary Cards ─────────────────────── */}
      <div className="info-grid">
        {/* Load Average Card */}
        <div className="info-card">
          <div className="info-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="info-card-icon load">
                <Activity size={18} />
              </div>
              <div>
                <div className="info-card-title">System Load</div>
                <div className="info-card-subtitle">Load Average (1m, 5m, 15m)</div>
              </div>
            </div>
          </div>
          <div>
            <div className="load-values">
              <div className="load-pill">
                <span className="load-num">
                  {loadInfo?.['1min'] != null || loadInfo?.['1m'] != null || loadInfo?.load1 != null
                    ? Number(loadInfo?.['1min'] ?? loadInfo?.['1m'] ?? loadInfo?.load1).toFixed(2)
                    : '—'}
                </span>
                <span className="load-tag">1 min</span>
              </div>
              <div className="load-pill">
                <span className="load-num">
                  {loadInfo?.['5min'] != null || loadInfo?.['5m'] != null || loadInfo?.load5 != null
                    ? Number(loadInfo?.['5min'] ?? loadInfo?.['5m'] ?? loadInfo?.load5).toFixed(2)
                    : '—'}
                </span>
                <span className="load-tag">5 min</span>
              </div>
              <div className="load-pill">
                <span className="load-num">
                  {loadInfo?.['15min'] != null || loadInfo?.['15m'] != null || loadInfo?.load15 != null
                    ? Number(loadInfo?.['15min'] ?? loadInfo?.['15m'] ?? loadInfo?.load15).toFixed(2)
                    : '—'}
                </span>
                <span className="load-tag">15 min</span>
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Tasks: <strong style={{ color: 'var(--text-primary)' }}>{loadInfo?.running ?? '—'}</strong> running of{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{loadInfo?.total ?? data?.processes?.length ?? '—'}</strong> total
            </div>
          </div>
        </div>

        {/* Memory Usage Card */}
        <div className="info-card">
          <div className="info-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="info-card-icon memory">
                <Layers size={18} />
              </div>
              <div>
                <div className="info-card-title">Memory Usage</div>
                <div className="info-card-subtitle">
                  {parsedMem?.used && parsedMem?.total
                    ? `${parsedMem.used} of ${parsedMem.total} utilized`
                    : 'RAM & Swap Status'}
                </div>
              </div>
            </div>
            <span className="badge user" style={{ fontSize: '11px', textTransform: 'none' }}>
              {memPercent ? `${memPercent.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div>
            <div className="proc-bar-outer">
              <div
                className={`proc-bar-inner ${memPercent > 85 ? 'crit' : memPercent > 70 ? 'warn' : ''}`}
                style={{ width: `${Math.min(100, Math.max(0, memPercent || 0))}%` }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                Used: <strong style={{ color: 'var(--text-primary)' }}>{parsedMem?.used || '—'}</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>Free: {parsedMem?.free || '—'}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                Swap: {parsedMem?.swap_used ? `${parsedMem.swap_used} / ${parsedMem.swap_total || '0'}` : parsedMem?.swap_total || '0'}
              </span>
            </div>
          </div>
        </div>

        {/* System Uptime Card */}
        <div className="info-card">
          <div className="info-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="info-card-icon uptime">
                <Clock size={18} />
              </div>
              <div>
                <div className="info-card-title">System Uptime</div>
                <div className="info-card-subtitle">Active running session</div>
              </div>
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              {loadInfo?.uptime_formatted || '—'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span className="status-indicator status-active" />
              <span>
                <strong style={{ color: 'var(--text-secondary)' }}>{data?.processes?.length || 0}</strong> total system processes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px', maxWidth: '380px' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="search"
            className="form-input"
            placeholder="Search by PID, name, user, or cmd (e.g. chrome, python)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* User filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="user-filter" className="form-label" style={{ margin: 0, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            User:
          </label>
          <CustomSelect
            id="user-filter"
            options={userOptions}
            value={userFilter}
            onChange={(val) => {
              setUserFilter(val);
              setCurrentPage(1);
            }}
            searchable={uniqueUsers.length > 5}
          />
        </div>

        {/* Sort filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="sort-filter" className="form-label" style={{ margin: 0, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            Sort:
          </label>
          <CustomSelect
            id="sort-filter"
            options={sortOptions}
            value={sortBy}
            onChange={(val) => handleSortDropdown(val as 'mem' | 'cpu' | 'pid' | 'name')}
          />
        </div>

        {/* Show / limit filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="show-limit" className="form-label" style={{ margin: 0, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            Show:
          </label>
          <CustomSelect
            id="show-limit"
            options={showOptions}
            value={pageSize}
            onChange={(val) => {
              const parsed = val === 'all' ? 'all' : Number(val);
              setPageSize(parsed);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Auto-refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: 'var(--purple)' }}
            />
            Auto-refresh (5s)
          </label>
        </div>

        {/* Refresh button */}
        <button
          className="btn btn-secondary"
          onClick={() => loadProcesses(true)}
          disabled={loading || refreshing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Table Card ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
              Processes ({data?.processes?.length || 0})
            </h3>
            {filteredProcesses.length !== (data?.processes?.length || 0) && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                ({filteredProcesses.length} matching filter)
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '80px', cursor: 'pointer' }} onClick={() => handleSort('pid')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      PID {sortBy === 'pid' && <ArrowUpDown size={11} color="var(--accent)" />}
                    </span>
                  </th>
                  <th style={{ width: '105px', cursor: 'pointer' }} onClick={() => handleSort('user')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      USER {sortBy === 'user' && <ArrowUpDown size={11} color="var(--accent)" />}
                    </span>
                  </th>
                  <th style={{ width: '90px', cursor: 'pointer' }} onClick={() => handleSort('cpu')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      CPU {sortBy === 'cpu' && <ArrowUpDown size={11} color="var(--accent)" />}
                    </span>
                  </th>
                  <th style={{ width: '155px', cursor: 'pointer' }} onClick={() => handleSort('mem')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      MEMORY {sortBy === 'mem' && <ArrowUpDown size={11} color="var(--accent)" />}
                    </span>
                  </th>
                  <th style={{ width: '95px' }}>STATE</th>
                  <th style={{ width: '85px' }}>TIME</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      COMMAND {sortBy === 'name' && <ArrowUpDown size={11} color="var(--accent)" />}
                    </span>
                  </th>
                  <th style={{ width: '80px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Loading process table…
                    </td>
                  </tr>
                ) : paginatedProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No matching processes found.
                    </td>
                  </tr>
                ) : (
                  paginatedProcesses.map((p) => {
                    // CPU display
                    let cpuDisplay = '0.0%';
                    if (p.cpu > 0) {
                      cpuDisplay = `${p.cpu.toFixed(1)}%`;
                    } else if (p.cpu_time) {
                      cpuDisplay = `${p.cpu_time}s`;
                    }
                    const isHighCpu = p.cpu > 40;
                    const isWarnCpu = p.cpu > 10;

                    // Memory display
                    const memFormatted = formatMemKb(p.mem);
                    const memPct = p.mem_pct != null ? p.mem_pct : undefined;
                    const isHighMem = (memPct && memPct > 15) || p.mem > 500000;
                    const isWarnMem = (memPct && memPct > 7) || p.mem > 150000;

                    // State display
                    let stateIndicator = 'status-inactive';
                    let stateText = p.stat || '—';
                    if (p.stat) {
                      if (p.stat.startsWith('R')) {
                        stateIndicator = 'status-active';
                        stateText = 'Running';
                      } else if (p.stat.startsWith('S') || p.stat.startsWith('I')) {
                        stateIndicator = 'status-sleeping';
                        stateText = 'Sleep';
                      } else if (p.stat.startsWith('D')) {
                        stateIndicator = 'status-disk';
                        stateText = 'Disk wait';
                      } else if (p.stat.startsWith('Z')) {
                        stateIndicator = 'status-failed';
                        stateText = 'Zombie';
                      }
                    }

                    // Command display
                    const { binName, binPath, args } = parseCommand(p.command);

                    return (
                      <tr key={p.pid}>
                        <td className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.pid}
                        </td>
                        <td>
                          <span className={`badge ${p.user.toLowerCase() === 'root' ? 'system' : 'user'}`}>
                            {p.user.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: '0.85rem',
                              color: isHighCpu ? 'var(--red)' : isWarnCpu ? 'var(--yellow)' : 'var(--text-muted)',
                              fontWeight: isHighCpu || isWarnCpu ? 600 : 400,
                            }}
                          >
                            {cpuDisplay}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span
                              className="font-mono"
                              style={{
                                fontSize: '0.85rem',
                                color: isHighMem ? 'var(--red)' : isWarnMem ? 'var(--yellow)' : 'var(--text-primary)',
                                fontWeight: 600,
                              }}
                            >
                              {memFormatted}
                            </span>
                            {memPct != null && memPct > 0 && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                ({memPct.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`status-indicator ${stateIndicator}`} />
                            <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {stateText}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {p.time || '0:00'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '440px' }} title={p.command}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}>
                              {binName}
                            </strong>
                            {binPath && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px', fontFamily: 'var(--font-mono)' }}>
                                ({binPath})
                              </span>
                            )}
                            {args && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>
                                {args}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-xs btn-danger"
                            title="Kill Process"
                            onClick={() => setPendingKill(p)}
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          >
                            Kill
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {filteredProcesses.length === 0
                ? 'No processes found'
                : `Showing ${effectivePageSize === Infinity ? 1 : (currentPage - 1) * effectivePageSize + 1} to ${
                    effectivePageSize === Infinity
                      ? filteredProcesses.length
                      : Math.min(currentPage * effectivePageSize, filteredProcesses.length)
                  } of ${filteredProcesses.length} processes`}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn btn-xs btn-secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-xs btn-secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirm Kill Modal ─────────────────────────────────── */}
      {pendingKill && (
        <ConfirmModal
          isOpen={Boolean(pendingKill)}
          onClose={() => setPendingKill(null)}
          onConfirm={handleConfirmKill}
          isLoading={killLoading}
          isDanger={true}
          title="Terminate Process"
          message={`Are you sure you want to send SIGKILL to '${pendingKill.name || pendingKill.command}' (PID: ${pendingKill.pid})? Unsaved data in this process will be lost.`}
          confirmLabel="Terminate (SIGKILL)"
        />
      )}
    </div>
  );
};
