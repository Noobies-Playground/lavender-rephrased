import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client';
import {
  FileItem,
  FileListResponse,
  BookmarkItem,
  BookmarksResponse,
  StorageDiskItem,
} from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { FilePreviewModal } from './FilePreviewModal';
import { CreateFolderModal, CreateFileModal, RenameModal } from './FileModals';
import {
  Folder,
  FileCode,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Binary,
  FolderPlus,
  FilePlus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Copy,
  Search,
  Grid,
  List,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  CornerLeftUp,
  RefreshCw,
  HardDrive,
  Disc,
  Unplug,
  Home,
  Monitor,
  Music,
  Video,
  Image,
  Terminal,
  Settings,
  Zap,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  X,
} from 'lucide-react';

interface FileBrowserProps {
  disks: StorageDiskItem[];
  onUnmountClick: (disk: StorageDiskItem) => void;
  onRefreshStorage: () => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  disks,
  onUnmountClick,
  onRefreshStorage,
}) => {
  const { addToast } = useToast();

  // Navigation and data state
  const [currentPath, setCurrentPath] = useState<string>('');
  const currentPathRef = useRef<string>('');
  currentPathRef.current = currentPath;

  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const historyRef = useRef<string[]>([]);
  historyRef.current = history;
  const historyIdxRef = useRef<number>(-1);
  historyIdxRef.current = historyIdx;

  const [fileData, setFileData] = useState<FileListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  // Toolbar & View options
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Path input editing
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [manualPath, setManualPath] = useState('');

  // Selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Modals state
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Drag and drop & upload
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Bookmarks once
  useEffect(() => {
    api
      .get<BookmarksResponse>('/api/storage/bookmarks')
      .then((res) => {
        if (res && Array.isArray(res.bookmarks)) setBookmarks(res.bookmarks);
      })
      .catch(() => {});
  }, []);

  // Fetch Directory
  const loadDirectory = useCallback(
    async (targetPath?: string, isRefresh = false, addToHistory = true) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // Determine path: use supplied targetPath, or fall back to currentPathRef.current, or empty string (for home)
      const pathToFetch = targetPath !== undefined ? targetPath : currentPathRef.current;
      const pathQuery = pathToFetch ? `path=${encodeURIComponent(pathToFetch)}&` : '';
      const hiddenQuery = `show_hidden=${showHidden}&`;
      const sortQuery = `sort_by=${sortBy}&order=${sortOrder}`;

      try {
        const res = await api.get<FileListResponse>(
          `/api/storage/files?${pathQuery}${hiddenQuery}${sortQuery}`
        );
        const resolvedPath = res?.current_path || '/';
        const itemsList = Array.isArray(res?.items) ? res.items : [];
        const safeData: FileListResponse = {
          current_path: resolvedPath,
          parent_path: res?.parent_path || null,
          home_path: res?.home_path || resolvedPath,
          is_writable: res?.is_writable ?? true,
          total_items: res?.total_items ?? itemsList.length,
          total_dirs: res?.total_dirs ?? 0,
          total_files: res?.total_files ?? 0,
          disk: res?.disk || {
            total: 0,
            total_human: '—',
            used: 0,
            used_human: '—',
            free: 0,
            free_human: '—',
            use_pct: 0,
          },
          items: itemsList,
        };

        setFileData(safeData);
        setCurrentPath(resolvedPath);
        currentPathRef.current = resolvedPath;
        setManualPath(resolvedPath);
        setSelectedPaths(new Set());

        if (addToHistory && resolvedPath) {
          const currentHist = historyRef.current;
          const currentIdx = historyIdxRef.current;
          const upToCurrent = currentIdx >= 0 ? currentHist.slice(0, currentIdx + 1) : [];
          if (upToCurrent[upToCurrent.length - 1] !== resolvedPath) {
            const next = [...upToCurrent, resolvedPath];
            setHistory(next);
            historyRef.current = next;
            const newIdx = next.length - 1;
            setHistoryIdx(newIdx);
            historyIdxRef.current = newIdx;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to list directory';
        setError(msg);
        addToast(msg, 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showHidden, sortBy, sortOrder, addToast]
  );

  // Initial load once on mount
  useEffect(() => {
    loadDirectory('', false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch current directory when sorting or showHidden changes
  useEffect(() => {
    if (currentPathRef.current) {
      loadDirectory(currentPathRef.current, true, false);
    }
  }, [showHidden, sortBy, sortOrder, loadDirectory]);

  // Navigation handlers
  const navigateTo = (path: string) => {
    setIsEditingPath(false);
    setSearchQuery('');
    loadDirectory(path, false, true);
  };

  const handleGoBack = () => {
    if (historyIdxRef.current > 0) {
      const nextIdx = historyIdxRef.current - 1;
      setHistoryIdx(nextIdx);
      historyIdxRef.current = nextIdx;
      const target = historyRef.current[nextIdx];
      loadDirectory(target, true, false);
    }
  };

  const handleGoForward = () => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      const nextIdx = historyIdxRef.current + 1;
      setHistoryIdx(nextIdx);
      historyIdxRef.current = nextIdx;
      const target = historyRef.current[nextIdx];
      loadDirectory(target, true, false);
    }
  };

  const handleGoUp = () => {
    if (fileData?.parent_path) {
      navigateTo(fileData.parent_path);
    }
  };

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPath.trim()) return;
    navigateTo(manualPath.trim());
  };

  const handleCopyCurrentPath = async () => {
    if (!currentPath) return;
    try {
      await navigator.clipboard.writeText(currentPath);
      addToast('Path copied to clipboard', 'info');
    } catch {
      addToast('Failed to copy path', 'error');
    }
  };

  // Selection handlers
  const toggleSelect = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!fileData) return;
    const filtered = filteredItems;
    if (selectedPaths.size === filtered.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filtered.map((item) => item.path)));
    }
  };

  // Upload handlers
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !currentPath) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('path', currentPath);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await api.postForm<{ success: boolean; count: number }>('/api/storage/upload', formData);
      if (res.success) {
        addToast(`Successfully uploaded ${res.count} file(s)`, 'success');
        await loadDirectory(currentPath, true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'File upload failed';
      addToast(msg, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileUpload(e.dataTransfer.files);
    }
  };

  // CRUD Actions
  const handleCreateFolder = async (name: string) => {
    setActionLoading(true);
    try {
      await api.post('/api/storage/mkdir', {
        path: currentPath,
        name,
      });
      addToast(`Folder '${name}' created`, 'success');
      setCreateFolderOpen(false);
      await loadDirectory(currentPath, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder';
      addToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateFile = async (name: string, content: string) => {
    setActionLoading(true);
    try {
      await api.post('/api/storage/file/create', {
        path: currentPath,
        name,
        content,
      });
      addToast(`File '${name}' created`, 'success');
      setCreateFileOpen(false);
      await loadDirectory(currentPath, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create file';
      addToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameItem) return;
    setActionLoading(true);
    try {
      await api.post('/api/storage/rename', {
        old_path: renameItem.path,
        new_name: newName,
      });
      addToast(`Renamed to '${newName}'`, 'success');
      setRenameItem(null);
      await loadDirectory(currentPath, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rename';
      addToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setDeleteLoading(true);
    try {
      const res = await api.post<{ success: boolean; deleted: string[] }>('/api/storage/delete', {
        paths: deleteTargets,
      });
      if (res.success) {
        addToast(`Deleted ${res.deleted.length} item(s)`, 'success');
        setDeleteTargets(null);
        setSelectedPaths(new Set());
        await loadDirectory(currentPath, true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      addToast(msg, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered and sorted items
  const items = fileData?.items || [];
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute selected size
  const selectedItemsList = items.filter((i) => selectedPaths.has(i.path));
  const selectedSizeSum = selectedItemsList.reduce((acc, curr) => acc + (curr.size || 0), 0);

  // Helper: category icon
  const getFileCategoryIcon = (category: string, isDir: boolean) => {
    if (isDir) {
      return <Folder size={18} className="cat-folder" />;
    }
    switch (category) {
      case 'code':
        return <FileCode size={18} className="cat-code" />;
      case 'image':
        return <FileImage size={18} className="cat-image" />;
      case 'video':
        return <FileVideo size={18} className="cat-video" />;
      case 'audio':
        return <FileAudio size={18} className="cat-audio" />;
      case 'archive':
        return <FileArchive size={18} className="cat-archive" />;
      case 'document':
        return <FileText size={18} className="cat-document" />;
      case 'binary':
        return <Binary size={18} className="cat-binary" />;
      default:
        return <FileText size={18} className="cat-text" />;
    }
  };

  // Helper: place icon
  const getBookmarkIcon = (icon: string) => {
    switch (icon) {
      case 'home':
        return <Home size={15} />;
      case 'monitor':
        return <Monitor size={15} />;
      case 'file-text':
        return <FileText size={15} />;
      case 'download':
        return <Download size={15} />;
      case 'image':
        return <Image size={15} />;
      case 'video':
        return <Video size={15} />;
      case 'music':
        return <Music size={15} />;
      case 'hard-drive':
        return <HardDrive size={15} />;
      case 'settings':
        return <Settings size={15} />;
      case 'terminal':
        return <Terminal size={15} />;
      case 'zap':
        return <Zap size={15} />;
      default:
        return <Folder size={15} />;
    }
  };

  // Break current path into breadcrumb tokens
  const breadcrumbParts: { name: string; fullPath: string }[] = [];
  if (currentPath) {
    const parts = currentPath.split('/').filter(Boolean);
    breadcrumbParts.push({ name: 'Root', fullPath: '/' });
    let acc = '';
    for (const part of parts) {
      acc += '/' + part;
      breadcrumbParts.push({ name: part, fullPath: acc });
    }
  }

  return (
    <div
      className="file-workspace"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Indicator */}
      {isDragOver && (
        <div className="file-drop-overlay">
          <Upload size={48} className="animate-bounce" />
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Drop files to upload here</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Destination: {currentPath}
          </p>
        </div>
      )}

      {/* Hidden File Input for Toolbar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* ── Left Sidebar: Drives & Places ───────────────────────── */}
      <aside className="file-sidebar">
        {/* Pinned Places / Bookmarks */}
        <div>
          <div className="file-sidebar-section-title">
            <span>Places</span>
            <Folder size={13} />
          </div>
          <div className="file-sidebar-list">
            {bookmarks.map((bm) => {
              const isActive = currentPath === bm.path;
              return (
                <button
                  key={bm.path}
                  className={`file-sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigateTo(bm.path)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getBookmarkIcon(bm.icon)}
                    <span>{bm.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drives & Partitions */}
        <div>
          <div className="file-sidebar-section-title">
            <span>Drives & Partitions</span>
            <HardDrive size={13} />
          </div>
          <div className="file-sidebar-list">
            {disks.map((d, idx) => {
              const mount = d.mount_point || d.mount || '/';
              const fs = d.filesystem || d.fs || 'unknown';
              const isActive = Boolean(
                currentPath && mount && (currentPath === mount || currentPath.startsWith(mount + '/'))
              );
              const isRoot = mount === '/' || mount === '/boot';
              const pct =
                typeof d.pct_num === 'number'
                  ? d.pct_num
                  : parseInt(String(d.use_percent || d.use_pct || '0').replace('%', ''), 10) || 0;
              const usePercent =
                d.use_percent || d.use_pct || (typeof d.pct_num === 'number' ? `${d.pct_num}%` : `${pct}%`);

              return (
                <div
                  key={mount || idx}
                  className={`file-drive-card ${isActive ? 'active' : ''}`}
                  onClick={() => navigateTo(mount)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Disc size={15} color="var(--purple)" />
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{mount}</strong>
                    </div>

                    {!isRoot && (
                      <button
                        className="btn btn-xs btn-ghost"
                        title="Unmount Partition"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnmountClick({ ...d, mount_point: mount, filesystem: fs });
                        }}
                        style={{ color: '#f87171', padding: '2px 6px' }}
                      >
                        <Unplug size={12} style={{ marginRight: '2px' }} />
                        <span style={{ fontSize: '0.72rem' }}>Unmount</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span className="font-mono">{fs}</span>
                    <span className="badge badge-lavender" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>{usePercent}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span>Used: {d.used || '—'}</span>
                    <span className="font-mono">{d.size || '—'}</span>
                  </div>

                  <div className="progress-bar-outer" style={{ height: '4px', marginTop: '6px' }}>
                    <div
                      className={`progress-bar-inner ${pct > 85 ? 'crit' : pct > 70 ? 'warn' : ''}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Main Explorer Pane ─────────────────────────────────── */}
      <section className="file-explorer-main">
        {/* Navigation & Breadcrumbs Bar */}
        <div className="file-breadcrumbs-bar">
          <div className="file-nav-buttons">
            <button
              className="file-nav-btn"
              onClick={handleGoBack}
              disabled={historyIdx <= 0}
              title="Back"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="file-nav-btn"
              onClick={handleGoForward}
              disabled={historyIdx >= history.length - 1}
              title="Forward"
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="file-nav-btn"
              onClick={handleGoUp}
              disabled={!fileData?.parent_path}
              title="Up one level"
            >
              <CornerLeftUp size={16} />
            </button>
            <button
              className="file-nav-btn"
              onClick={() => {
                loadDirectory(currentPath, true);
                onRefreshStorage();
              }}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Breadcrumb / Path Input Switcher */}
          {isEditingPath ? (
            <form onSubmit={handleManualPathSubmit} style={{ flex: 1, display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="file-path-input"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                autoFocus
                onBlur={() => {
                  if (manualPath === currentPath) setIsEditingPath(false);
                }}
              />
              <button type="submit" className="btn btn-xs btn-primary">
                Go
              </button>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => {
                  setManualPath(currentPath);
                  setIsEditingPath(false);
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div
              className="file-breadcrumbs-trail"
              onClick={() => setIsEditingPath(true)}
              title="Click to manually edit path"
            >
              {breadcrumbParts.map((b, idx) => {
                const isLast = idx === breadcrumbParts.length - 1;
                return (
                  <React.Fragment key={b.fullPath}>
                    <button
                      type="button"
                      className={`file-breadcrumb-segment ${isLast ? 'current' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo(b.fullPath);
                      }}
                    >
                      {idx === 0 && <HardDrive size={13} style={{ marginRight: '2px' }} />}
                      <span>{b.name}</span>
                    </button>
                    {!isLast && <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>/</span>}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Copy path button */}
          <button
            className="file-nav-btn"
            onClick={handleCopyCurrentPath}
            title="Copy current path"
          >
            <Copy size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="file-toolbar">
          <div className="file-toolbar-left">
            <div className="file-search-box">
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="file-search-input"
                placeholder="Filter files in directory…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '4px', padding: '2px', color: 'var(--text-muted)' }}
                  title="Clear filter"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              className={`btn btn-xs ${showHidden ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowHidden(!showHidden)}
              title="Toggle hidden dotfiles"
            >
              {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>Hidden</span>
            </button>

            <div className="file-view-toggle">
              <button
                className={`file-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List size={15} />
              </button>
              <button
                className={`file-view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <Grid size={15} />
              </button>
            </div>
          </div>

          <div className="file-toolbar-right">
            {fileData?.is_writable && (
              <>
                <button
                  className="btn btn-xs btn-secondary"
                  onClick={() => setCreateFolderOpen(true)}
                >
                  <FolderPlus size={14} color="var(--purple)" />
                  <span>New Folder</span>
                </button>

                <button
                  className="btn btn-xs btn-secondary"
                  onClick={() => setCreateFileOpen(true)}
                >
                  <FilePlus size={14} color="var(--accent)" />
                  <span>New File</span>
                </button>

                <button
                  className="btn btn-xs btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={14} className={uploading ? 'animate-bounce' : ''} />
                  <span>{uploading ? 'Uploading…' : 'Upload'}</span>
                </button>
              </>
            )}

            {selectedPaths.size > 0 && (
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => setDeleteTargets(Array.from(selectedPaths))}
                style={{ color: '#f87171' }}
              >
                <Trash2 size={14} />
                <span>Delete ({selectedPaths.size})</span>
              </button>
            )}
          </div>
        </div>

        {/* File Content Area */}
        <div className="file-content-scroll">
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading folder contents…
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
              <p style={{ margin: '0 0 12px', fontWeight: 600 }}>{error}</p>
              <button className="btn btn-xs btn-secondary" onClick={() => loadDirectory(currentPath, true)}>
                Retry
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {searchQuery ? `No files matching "${searchQuery}"` : 'This directory is empty.'}
            </div>
          ) : viewMode === 'list' ? (
            /* Table / List View */
            <table className="file-table">
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={toggleSelectAll}
                      style={{ padding: '2px' }}
                      title="Select All"
                    >
                      {selectedPaths.size === filteredItems.length && filteredItems.length > 0 ? (
                        <CheckSquare size={15} color="var(--purple)" />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                  </th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortBy('name');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    Name {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th
                    style={{ cursor: 'pointer', width: '100px' }}
                    onClick={() => {
                      if (sortBy === 'size') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortBy('size');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    Size {sortBy === 'size' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ width: '120px' }}>Permissions</th>
                  <th style={{ width: '120px' }}>Owner</th>
                  <th
                    style={{ cursor: 'pointer', width: '150px' }}
                    onClick={() => {
                      if (sortBy === 'modified') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortBy('modified');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    Modified {sortBy === 'modified' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isSelected = selectedPaths.has(item.path);
                  return (
                    <tr
                      key={item.path}
                      className={`file-table-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (item.is_dir) navigateTo(item.path);
                        else setPreviewFilePath(item.path);
                      }}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={(e) => toggleSelect(item.path, e)}
                          style={{ padding: '2px' }}
                        >
                          {isSelected ? (
                            <CheckSquare size={15} color="var(--purple)" />
                          ) : (
                            <Square size={15} color="var(--text-muted)" />
                          )}
                        </button>
                      </td>

                      <td>
                        <div className="file-name-cell" title={item.name}>
                          <div className={`file-icon-box cat-${item.category}`}>
                            {getFileCategoryIcon(item.category, item.is_dir)}
                          </div>
                          <span style={{ fontWeight: item.is_dir ? 600 : 400 }}>{item.name}</span>
                          {item.is_symlink && (
                            <span
                              className="badge badge-lavender"
                              style={{ fontSize: '0.68rem', padding: '1px 4px' }}
                            >
                              symlink
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {item.size_human}
                      </td>

                      <td className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.permissions}
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.owner}:{item.group}
                      </td>

                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.modified_human}
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {item.is_dir ? (
                            <button
                              className="btn btn-xs btn-ghost"
                              title="Enter folder"
                              onClick={() => navigateTo(item.path)}
                              style={{ padding: '4px', color: 'var(--purple)' }}
                            >
                              <Folder size={13} />
                            </button>
                          ) : (
                            <a
                              href={`/api/storage/file/raw?path=${encodeURIComponent(item.path)}&download=true`}
                              download
                              className="btn btn-xs btn-ghost"
                              title="Download"
                              style={{ padding: '4px' }}
                            >
                              <Download size={13} />
                            </a>
                          )}

                          <button
                            className="btn btn-xs btn-ghost"
                            title="Rename"
                            onClick={() => setRenameItem(item)}
                            style={{ padding: '4px' }}
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            className="btn btn-xs btn-ghost"
                            title="Delete"
                            onClick={() => setDeleteTargets([item.path])}
                            style={{ padding: '4px', color: '#f87171' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Grid / Icons View */
            <div className="file-grid-container">
              {filteredItems.map((item) => {
                const isSelected = selectedPaths.has(item.path);
                return (
                  <div
                    key={item.path}
                    className={`file-grid-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (item.is_dir) navigateTo(item.path);
                      else setPreviewFilePath(item.path);
                    }}
                    title={`${item.name} (${item.size_human})`}
                  >
                    <div
                      style={{ position: 'absolute', top: '6px', left: '6px' }}
                      onClick={(e) => toggleSelect(item.path, e)}
                    >
                      {isSelected ? (
                        <CheckSquare size={15} color="var(--purple)" />
                      ) : (
                        <Square size={15} color="var(--text-dim)" />
                      )}
                    </div>

                    <div className={`file-grid-icon-box cat-${item.category}`}>
                      {item.is_dir ? (
                        <Folder size={32} color="#c4b5fd" />
                      ) : (
                        getFileCategoryIcon(item.category, false)
                      )}
                    </div>

                    <div className="file-grid-name">{item.name}</div>
                    <div className="file-grid-meta">{item.size_human}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Status Bar ─────────────────────────────────────────── */}
        <div className="file-status-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span>
              {fileData?.total_items || 0} items ({fileData?.total_dirs || 0} folders,{' '}
              {fileData?.total_files || 0} files)
            </span>
            {selectedPaths.size > 0 && (
              <span style={{ color: 'var(--lavender-300)' }}>
                {selectedPaths.size} selected ({selectedSizeSum > 0 ? (selectedSizeSum / (1024 * 1024)).toFixed(1) + ' MB' : '0 B'})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {fileData?.disk && (
              <span>
                Free space: <strong style={{ color: 'var(--text-primary)' }}>{fileData.disk.free_human}</strong> of{' '}
                {fileData.disk.total_human} ({fileData.disk.use_pct}% used)
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {fileData?.is_writable ? (
                <>
                  <Unlock size={12} color="var(--green)" />
                  <span style={{ color: 'var(--green)' }}>Writable</span>
                </>
              ) : (
                <>
                  <Lock size={12} color="#fbbf24" />
                  <span style={{ color: '#fbbf24' }}>Read-Only</span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <FilePreviewModal
        isOpen={Boolean(previewFilePath)}
        filePath={previewFilePath}
        onClose={() => setPreviewFilePath(null)}
        onSaveSuccess={() => loadDirectory(currentPath, true)}
      />

      <CreateFolderModal
        isOpen={createFolderOpen}
        parentPath={currentPath}
        onClose={() => setCreateFolderOpen(false)}
        onSubmit={handleCreateFolder}
        loading={actionLoading}
      />

      <CreateFileModal
        isOpen={createFileOpen}
        parentPath={currentPath}
        onClose={() => setCreateFileOpen(false)}
        onSubmit={handleCreateFile}
        loading={actionLoading}
      />

      {renameItem && (
        <RenameModal
          isOpen={Boolean(renameItem)}
          currentPath={renameItem.path}
          currentName={renameItem.name}
          onClose={() => setRenameItem(null)}
          onSubmit={handleRename}
          loading={actionLoading}
        />
      )}

      {deleteTargets && (
        <ConfirmModal
          isOpen={Boolean(deleteTargets)}
          onClose={() => setDeleteTargets(null)}
          onConfirm={handleDeleteConfirm}
          isLoading={deleteLoading}
          isDanger={true}
          title="Delete Item(s)"
          message={`Are you sure you want to permanently delete ${deleteTargets.length} item(s)? This action cannot be undone.`}
          confirmLabel="Delete Permanently"
        />
      )}
    </div>
  );
};
