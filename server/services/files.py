"""
File browser service for Lavender dashboard.
Provides filesystem exploration, file viewing/editing, creation, deletion, rename, upload, and bookmark shortcuts.
"""
import os
import shutil
import stat
import pwd
import grp
import mimetypes
from datetime import datetime
from typing import List, Dict, Any, Optional

PROTECTED_PATHS = frozenset([
    "/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib32", "/lib64",
    "/proc", "/root", "/run", "/sbin", "/sys", "/usr", "/var",
    "/home"
])

CODE_EXTENSIONS = frozenset([
    ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".htm", ".css", ".scss", ".sass",
    ".less", ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".conf", ".cfg",
    ".sh", ".bash", ".zsh", ".fish", ".c", ".h", ".cpp", ".hpp", ".cc", ".rs",
    ".go", ".java", ".kt", ".rb", ".php", ".sql", ".md", ".markdown", ".dockerfile",
    ".env", ".gitignore", ".service", ".desktop"
])

IMAGE_EXTENSIONS = frozenset([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff", ".avif"
])

VIDEO_EXTENSIONS = frozenset([
    ".mp4", ".mkv", ".webm", ".avi", ".mov", ".wmv", ".flv", ".m4v"
])

AUDIO_EXTENSIONS = frozenset([
    ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".wma", ".opus"
])

ARCHIVE_EXTENSIONS = frozenset([
    ".zip", ".tar", ".gz", ".tgz", ".bz2", ".tbz2", ".xz", ".txz", ".7z", ".rar", ".iso", ".deb", ".rpm"
])

DOC_EXTENSIONS = frozenset([
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".csv"
])


def human_size(num_bytes: int) -> str:
    """Format bytes into readable string (e.g. 14.2 MB)."""
    if num_bytes < 0:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(num_bytes) < 1024.0:
            if unit == 'B':
                return f"{num_bytes} B"
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} PB"


def get_category(ext: str, mime: Optional[str] = None) -> str:
    """Determine high-level file category for icons and viewer behavior."""
    ext_lower = ext.lower() if ext else ""
    mime_lower = mime.lower() if mime else ""

    if ext_lower in CODE_EXTENSIONS or any(k in mime_lower for k in ("javascript", "json", "xml", "yaml")):
        return "code"
    if ext_lower in IMAGE_EXTENSIONS or mime_lower.startswith("image/"):
        return "image"
    if ext_lower in VIDEO_EXTENSIONS or mime_lower.startswith("video/"):
        return "video"
    if ext_lower in AUDIO_EXTENSIONS or mime_lower.startswith("audio/"):
        return "audio"
    if ext_lower in ARCHIVE_EXTENSIONS or any(k in mime_lower for k in ("zip", "tar", "archive", "compressed", "gzip")):
        return "archive"
    if ext_lower in DOC_EXTENSIONS or any(k in mime_lower for k in ("pdf", "document", "sheet", "presentation")):
        return "document"
    if ext_lower in (".txt", ".log", ""):
        return "text"
    return "binary"



def is_text_file(path: str, max_check: int = 4096) -> bool:
    """Check if file can be read as text by scanning initial bytes for nulls."""
    try:
        with open(path, "rb") as f:
            chunk = f.read(max_check)
            if b"\x00" in chunk:
                return False
            # Check UTF-8 decodability
            try:
                chunk.decode("utf-8")
                return True
            except UnicodeDecodeError:
                try:
                    chunk.decode("latin-1")
                    return True
                except Exception:
                    return False
    except Exception:
        return False


def sanitize_path(path: Optional[str], default_path: Optional[str] = None) -> str:
    """Resolve and normalize path to a clean absolute path."""
    if not path or not path.strip():
        if default_path and os.path.exists(default_path):
            path = default_path
        else:
            path = os.path.expanduser("~")

    # Replace ~ with home
    path = os.path.expanduser(path.strip())
    resolved = os.path.realpath(os.path.abspath(path))
    return resolved


def list_directory(
    path: Optional[str] = None,
    show_hidden: bool = False,
    sort_by: str = "name",
    order: str = "asc",
    user_home: Optional[str] = None
) -> Dict[str, Any]:
    """
    List contents of directory with rich POSIX metadata, disk usage, and permission details.
    """
    canonical_path = sanitize_path(path, user_home)

    if not os.path.exists(canonical_path):
        raise FileNotFoundError(f"Path does not exist: {canonical_path}")
    if not os.path.isdir(canonical_path):
        raise NotADirectoryError(f"Path is not a directory: {canonical_path}")

    # Check read permission
    if not os.access(canonical_path, os.R_OK):
        raise PermissionError(f"Read permission denied for directory: {canonical_path}")

    parent_path = os.path.dirname(canonical_path) if canonical_path != "/" else None
    is_writable = os.access(canonical_path, os.W_OK)

    # Disk usage for the filesystem hosting this path
    disk_total = 0
    disk_used = 0
    disk_free = 0
    disk_use_pct = 0
    try:
        du = shutil.disk_usage(canonical_path)
        disk_total = du.total
        disk_used = du.used
        disk_free = du.free
        if disk_total > 0:
            disk_use_pct = round((disk_used / disk_total) * 100, 1)
    except Exception:
        pass

    items: List[Dict[str, Any]] = []
    total_dirs = 0
    total_files = 0

    try:
        with os.scandir(canonical_path) as it:
            for entry in it:
                try:
                    name = entry.name
                    if not show_hidden and name.startswith('.'):
                        continue

                    is_symlink = entry.is_symlink()
                    symlink_target = None
                    if is_symlink:
                        try:
                            symlink_target = os.readlink(entry.path)
                        except Exception:
                            pass

                    try:
                        st = entry.stat(follow_symlinks=False)
                        is_dir = entry.is_dir(follow_symlinks=True)
                    except Exception:
                        try:
                            st = entry.stat(follow_symlinks=False)
                            is_dir = False
                        except Exception:
                            continue

                    if is_dir:
                        total_dirs += 1
                    else:
                        total_files += 1

                    size = st.st_size
                    size_str = human_size(size) if not is_dir else "—"

                    try:
                        perms = stat.filemode(st.st_mode)
                    except Exception:
                        perms = "??????????"

                    try:
                        owner = pwd.getpwuid(st.st_uid).pw_name
                    except Exception:
                        owner = str(st.st_uid)

                    try:
                        group = grp.getgrgid(st.st_gid).gr_name
                    except Exception:
                        group = str(st.st_gid)

                    mtime = st.st_mtime
                    mtime_str = datetime.fromtimestamp(mtime).strftime("%b %d, %Y %H:%M")

                    _, ext = os.path.splitext(name)
                    mime_type, _ = mimetypes.guess_type(entry.path)
                    category = "folder" if is_dir else get_category(ext, mime_type)

                    items.append({
                        "name": name,
                        "path": entry.path,
                        "is_dir": is_dir,
                        "is_symlink": is_symlink,
                        "symlink_target": symlink_target,
                        "size": size,
                        "size_human": size_str,
                        "modified": mtime,
                        "modified_human": mtime_str,
                        "permissions": perms,
                        "owner": owner,
                        "group": group,
                        "extension": ext.lower() if ext else "",
                        "mime_type": mime_type or "application/octet-stream",
                        "category": category,
                        "is_writable": os.access(entry.path, os.W_OK),
                    })
                except Exception:
                    continue
    except PermissionError:
        raise PermissionError(f"Permission denied accessing directory: {canonical_path}")
    except Exception as e:
        raise RuntimeError(f"Error reading directory: {str(e)}")

    # Sorting: folders first, then files
    reverse = (order.lower() == "desc")

    def sort_key(item: Dict[str, Any]):
        is_dir_priority = 0 if item["is_dir"] else 1
        val: Any = item.get(sort_by)
        if val is None:
            val = item.get("name", "")
        if isinstance(val, str):
            val = val.lower()
        return (is_dir_priority, val)

    items.sort(key=sort_key, reverse=reverse)

    return {
        "current_path": canonical_path,
        "parent_path": parent_path,
        "home_path": user_home or os.path.expanduser("~"),
        "is_writable": is_writable,
        "total_items": len(items),
        "total_dirs": total_dirs,
        "total_files": total_files,
        "disk": {
            "total": disk_total,
            "total_human": human_size(disk_total),
            "used": disk_used,
            "used_human": human_size(disk_used),
            "free": disk_free,
            "free_human": human_size(disk_free),
            "use_pct": disk_use_pct,
        },
        "items": items,
    }


def read_file_preview(path: str, max_bytes: int = 2 * 1024 * 1024) -> Dict[str, Any]:
    """
    Read file content for preview / editor.
    If text, returns decoded string content up to max_bytes.
    """
    canonical_path = sanitize_path(path)
    if not os.path.exists(canonical_path):
        raise FileNotFoundError(f"File not found: {canonical_path}")
    if os.path.isdir(canonical_path):
        raise IsADirectoryError(f"Target is a directory: {canonical_path}")
    if not os.access(canonical_path, os.R_OK):
        raise PermissionError(f"Read permission denied for file: {canonical_path}")

    st = os.stat(canonical_path)
    size = st.st_size
    _, ext = os.path.splitext(canonical_path)
    mime_type, _ = mimetypes.guess_type(canonical_path)
    category = get_category(ext, mime_type)

    text_check = is_text_file(canonical_path)
    content: Optional[str] = None
    truncated = False
    line_count = 0

    if text_check:
        try:
            with open(canonical_path, "rb") as f:
                raw_bytes = f.read(max_bytes + 1)
                if len(raw_bytes) > max_bytes:
                    truncated = True
                    raw_bytes = raw_bytes[:max_bytes]

                try:
                    content = raw_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    content = raw_bytes.decode("latin-1", errors="replace")

                line_count = content.count("\n") + (1 if content else 0)
        except Exception as e:
            content = f"Error reading file content: {str(e)}"
            text_check = False

    return {
        "name": os.path.basename(canonical_path),
        "path": canonical_path,
        "size": size,
        "size_human": human_size(size),
        "mime_type": mime_type or "application/octet-stream",
        "category": category,
        "is_text": text_check,
        "content": content,
        "truncated": truncated,
        "line_count": line_count,
        "modified": datetime.fromtimestamp(st.st_mtime).strftime("%b %d, %Y %H:%M"),
        "permissions": stat.filemode(st.st_mode),
        "is_writable": os.access(canonical_path, os.W_OK),
    }


def save_file_content(path: str, content: str) -> Dict[str, Any]:
    """Save updated text content to file."""
    canonical_path = sanitize_path(path)
    if not os.path.exists(canonical_path):
        raise FileNotFoundError(f"File not found: {canonical_path}")
    if os.path.isdir(canonical_path):
        raise IsADirectoryError(f"Target is a directory: {canonical_path}")
    if not os.access(canonical_path, os.W_OK):
        raise PermissionError(f"Write permission denied for file: {canonical_path}")

    # Write content atomically with UTF-8 encoding
    temp_path = f"{canonical_path}.lavender_tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(temp_path, canonical_path)
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

    st = os.stat(canonical_path)
    return {
        "success": True,
        "path": canonical_path,
        "size": st.st_size,
        "size_human": human_size(st.st_size),
        "modified": datetime.fromtimestamp(st.st_mtime).strftime("%b %d, %Y %H:%M"),
    }


def make_directory(parent_path: str, name: str) -> Dict[str, Any]:
    """Create a new directory inside parent_path."""
    name = name.strip()
    if not name or "/" in name or "\\" in name or name in (".", ".."):
        raise ValueError("Invalid directory name")

    canonical_parent = sanitize_path(parent_path)
    if not os.path.isdir(canonical_parent):
        raise NotADirectoryError(f"Parent is not a directory: {canonical_parent}")
    if not os.access(canonical_parent, os.W_OK):
        raise PermissionError(f"Permission denied to create folder in: {canonical_parent}")

    target_path = os.path.join(canonical_parent, name)
    if os.path.exists(target_path):
        raise FileExistsError(f"Directory or file already exists: {name}")

    os.makedirs(target_path, exist_ok=False)
    return {"success": True, "path": target_path, "name": name}


def create_new_file(parent_path: str, name: str, content: str = "") -> Dict[str, Any]:
    """Create a new file with optional content."""
    name = name.strip()
    if not name or "/" in name or "\\" in name or name in (".", ".."):
        raise ValueError("Invalid file name")

    canonical_parent = sanitize_path(parent_path)
    if not os.path.isdir(canonical_parent):
        raise NotADirectoryError(f"Parent is not a directory: {canonical_parent}")
    if not os.access(canonical_parent, os.W_OK):
        raise PermissionError(f"Permission denied to create file in: {canonical_parent}")

    target_path = os.path.join(canonical_parent, name)
    if os.path.exists(target_path):
        raise FileExistsError(f"File or directory already exists: {name}")

    with open(target_path, "w", encoding="utf-8") as f:
        f.write(content or "")

    return {"success": True, "path": target_path, "name": name}


def rename_entry(old_path: str, new_name: str) -> Dict[str, Any]:
    """Rename a file or folder."""
    new_name = new_name.strip()
    if not new_name or "/" in new_name or "\\" in new_name or new_name in (".", ".."):
        raise ValueError("Invalid new name")

    canonical_old = sanitize_path(old_path)
    if canonical_old in PROTECTED_PATHS:
        raise ValueError("Cannot rename protected system path")
    if not os.path.exists(canonical_old):
        raise FileNotFoundError(f"Source not found: {canonical_old}")

    parent_dir = os.path.dirname(canonical_old)
    if not os.access(parent_dir, os.W_OK):
        raise PermissionError(f"Permission denied in parent directory: {parent_dir}")

    target_path = os.path.join(parent_dir, new_name)
    if os.path.exists(target_path):
        raise FileExistsError(f"Destination already exists: {new_name}")

    os.rename(canonical_old, target_path)
    return {"success": True, "old_path": canonical_old, "new_path": target_path, "name": new_name}


def delete_entries(paths: List[str]) -> Dict[str, Any]:
    """Delete files and directories safely."""
    results = []
    for p in paths:
        canonical = sanitize_path(p)
        if canonical in PROTECTED_PATHS or canonical == "/home":
            raise ValueError(f"Cannot delete protected system directory: {canonical}")
        if not os.path.exists(canonical) and not os.path.islink(canonical):
            continue

        parent = os.path.dirname(canonical)
        if not os.access(parent, os.W_OK):
            raise PermissionError(f"Permission denied to delete in: {parent}")

        if os.path.islink(canonical) or not os.path.isdir(canonical):
            os.remove(canonical)
        else:
            shutil.rmtree(canonical)

        results.append(canonical)

    return {"success": True, "deleted": results}


def get_quick_bookmarks(user_home: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return common user folders and system shortcut bookmarks."""
    home = sanitize_path(user_home or os.path.expanduser("~"))

    candidates = [
        {"name": "Home", "path": home, "icon": "home", "type": "user"},
        {"name": "Desktop", "path": os.path.join(home, "Desktop"), "icon": "monitor", "type": "user"},
        {"name": "Documents", "path": os.path.join(home, "Documents"), "icon": "file-text", "type": "user"},
        {"name": "Downloads", "path": os.path.join(home, "Downloads"), "icon": "download", "type": "user"},
        {"name": "Pictures", "path": os.path.join(home, "Pictures"), "icon": "image", "type": "user"},
        {"name": "Videos", "path": os.path.join(home, "Videos"), "icon": "video", "type": "user"},
        {"name": "Music", "path": os.path.join(home, "Music"), "icon": "music", "type": "user"},
        {"name": "Root (/)", "path": "/", "icon": "hard-drive", "type": "system"},
        {"name": "/etc", "path": "/etc", "icon": "settings", "type": "system"},
        {"name": "/var/log", "path": "/var/log", "icon": "terminal", "type": "system"},
        {"name": "/tmp", "path": "/tmp", "icon": "zap", "type": "system"},
    ]

    valid_bookmarks = []
    for b in candidates:
        if os.path.exists(b["path"]) and os.path.isdir(b["path"]):
            valid_bookmarks.append(b)

    return valid_bookmarks
