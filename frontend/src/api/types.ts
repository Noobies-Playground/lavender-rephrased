export interface UserProfile {
  username: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
  groups: string[];
  is_admin: boolean;
  can_elevate: boolean;
  admin_remaining_seconds: number;
  connected?: boolean;
}

export interface LoginResponse {
  success: boolean;
  username: string;
  redirect: string;
  is_admin: boolean;
  can_elevate: boolean;
}

export interface ElevationResponse {
  success: boolean;
  is_admin: boolean;
  expires_in: number;
}

export interface SystemInfo {
  model?: string;
  os_name?: string;
  os_pretty?: string;
  os_version?: string;
  os_id?: string;
  kernel?: string;
  arch?: string;
  hostname?: string;
  uptime?: string;
  cpu_model?: string;
  cpu_cores?: number;
  total_memory?: string;
}

export interface CpuCoreUsage {
  core: number;
  usage: number | null;
}

export interface CpuInfo {
  count: number;
  load1?: number;
  load5?: number;
  load15?: number;
  per_core_usage?: CpuCoreUsage[];
  cpus?: Array<{
    core: number;
    frequency_mhz: number | null;
  }>;
}

export interface RamInfo {
  total?: number;
  used?: number;
  available?: number;
  free?: number;
  used_pct?: number;
  cached?: number;
  buffers?: number;
  swap_total?: number;
  swap_used?: number;
  swap_pct?: number;
}

export interface BatteryTelemetry {
  present?: boolean;
  percentage?: number;
  state?: string;
  battery_state?: string;
  charging?: boolean;
  discharging?: boolean;
  voltage?: number;
  energy_rate?: number;
  energy?: number;
  energy_full?: number;
  temperature?: number;
  capacity?: number;
  health?: string;
  time_to_empty?: number | string;
  time_to_full?: number | string;
}

export interface ThermalZone {
  name: string;
  display_name?: string;
  temp?: number;
  temp_celsius?: number;
  temp_millicelsius?: number;
  type?: string;
  warning?: boolean;
  crit?: number | boolean;
}

export interface NetworkTelemetry {
  iface?: string;
  interface?: string;
  rx_bytes?: number;
  tx_bytes?: number;
  rx_rate_bps?: number;
  tx_rate_bps?: number;
  rx_rate?: number;
  tx_rate?: number;
  rx_bytes_sec?: number;
  tx_bytes_sec?: number;
}

export interface LiveTelemetryData {
  cpu?: CpuInfo;
  ram?: RamInfo;
  battery?: BatteryTelemetry;
  thermal?: {
    zones?: ThermalZone[];
  } | ThermalZone[];
  network?: NetworkTelemetry;
}

export interface StorageDiskItem {
  filesystem?: string;
  size: string;
  used: string;
  available?: string;
  use_percent?: string;
  mount_point?: string;
  fs?: string;
  avail?: string;
  use_pct?: string;
  mount?: string;
  is_external?: boolean;
  pct_num?: number;
}

export interface StorageOverviewResponse {
  disks: StorageDiskItem[];
}

export type FileCategory =
  | 'folder'
  | 'code'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'document'
  | 'text'
  | 'binary';

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  symlink_target?: string | null;
  size: number;
  size_human: string;
  modified: number;
  modified_human: string;
  permissions: string;
  owner: string;
  group: string;
  extension: string;
  mime_type: string;
  category: FileCategory;
  is_writable: boolean;
}

export interface DiskUsageSummary {
  total: number;
  total_human: string;
  used: number;
  used_human: string;
  free: number;
  free_human: string;
  use_pct: number;
}

export interface FileListResponse {
  current_path: string;
  parent_path: string | null;
  home_path: string;
  is_writable: boolean;
  total_items: number;
  total_dirs: number;
  total_files: number;
  disk: DiskUsageSummary;
  items: FileItem[];
}

export interface FilePreviewResponse {
  name: string;
  path: string;
  size: number;
  size_human: string;
  mime_type: string;
  category: string;
  is_text: boolean;
  content: string | null;
  truncated: boolean;
  line_count: number;
  modified: string;
  permissions: string;
  is_writable: boolean;
}

export interface BookmarkItem {
  name: string;
  path: string;
  icon: string;
  type: 'user' | 'system';
}

export interface BookmarksResponse {
  bookmarks: BookmarkItem[];
  disks: StorageDiskItem[];
}


export interface ServiceItem {
  unit: string;
  name?: string;
  load?: string;
  load_state?: string;
  active?: string;
  active_state?: string;
  sub?: string;
  sub_state?: string;
  description?: string;
  scope?: string;
}

export interface ServicesListResponse {
  services: ServiceItem[];
  count: number;
}

export interface ProcessItem {
  pid: number;
  user: string;
  cpu: number;
  cpu_time?: number;
  time?: string;
  mem: number;
  mem_pct?: number;
  vsz?: number;
  rss?: number;
  stat?: string;
  command: string;
  name: string;
}

export interface ProcessesOverviewResponse {
  processes: ProcessItem[];
  load: {
    '1min'?: number;
    '5min'?: number;
    '15min'?: number;
    '1m'?: number;
    '5m'?: number;
    '15m'?: number;
    load1?: number;
    load5?: number;
    load15?: number;
    running?: string | number;
    total?: string | number;
    uptime_seconds?: number;
    uptime_formatted?: string;
    [key: string]: unknown;
  };
  memory: {
    raw?: string;
    error?: string;
    parsed?: {
      total?: string;
      used?: string;
      free?: string;
      shared?: string;
      percent?: number;
      swap_total?: string;
      swap_used?: string;
      swap_free?: string;
    };
    [key: string]: unknown;
  };
}

export interface NetworkInterfaceAddress {
  address: string;
  cidr: string;
  broadcast?: string | null;
  scope?: string;
}

export interface NetworkInterfaceStats {
  rx_bytes: number;
  tx_bytes: number;
  rx_packets: number;
  tx_packets: number;
  rx_errors?: number;
  tx_errors?: number;
}

export interface NetworkInterfaceItem {
  name: string;
  ip?: string;
  mac?: string | null;
  state?: string;
  type?: string;
  category?: 'wireless' | 'ethernet' | 'loopback' | 'bridge' | 'virtual' | 'cellular' | string;
  is_up?: boolean;
  is_default?: boolean;
  mtu?: number;
  speed?: string | null;
  flags?: string[];
  addresses?: string[];
  ipv4?: NetworkInterfaceAddress[];
  ipv6?: NetworkInterfaceAddress[];
  rx_bytes?: number;
  tx_bytes?: number;
  rx_bytes_fmt?: string;
  tx_bytes_fmt?: string;
  stats?: NetworkInterfaceStats;
}

export interface WifiNetworkItem {
  ssid: string;
  bssid?: string;
  signal?: number;
  frequency?: string;
  security?: string;
  channel?: string;
  rate?: string;
  mode?: string;
  is_current?: boolean;
}

export interface WifiDetails {
  has_hardware?: boolean;
  connected?: boolean;
  interface?: string | null;
  ssid?: string | null;
  bssid?: string | null;
  signal_percent?: number | null;
  signal_dbm?: string | null;
  quality?: string | null;
  frequency?: string | null;
  channel?: string | null;
  bitrate?: string | null;
  tx_power?: string | null;
  security?: string | null;
  mode?: string | null;
  driver?: string | null;
  nearby?: WifiNetworkItem[];
  networks?: WifiNetworkItem[];
  available_interfaces?: string[];
  rfkill_blocked?: boolean;
  message?: string | null;
  source?: string | null;
}

export interface DnsServerItem {
  ip: string;
  provider: string;
  is_primary: boolean;
  is_stub?: boolean;
}

export interface DnsDetails {
  servers?: DnsServerItem[];
  upstream_ips?: string[];
  has_local_stub?: boolean;
  stub_ip?: string | null;
  search_domains?: string[];
  resolver_type?: string;
}

export interface GatewayItem {
  gateway: string;
  interface: string;
  protocol?: string;
  metric?: number;
  prefsrc?: string;
}

export interface NetworkSummaryInfo {
  is_online?: boolean;
  primary_interface?: string | null;
  primary_type?: string | null;
  primary_ip?: string | null;
  primary_mac?: string | null;
  default_gateway?: string | null;
  primary_dns?: string | null;
  primary_dns_provider?: string | null;
  total_rx_fmt?: string;
  total_tx_fmt?: string;
  wifi_connected?: boolean;
  wifi_ssid?: string | null;
  wifi_signal?: number | null;
}

export interface NetworkSummaryResponse {
  summary: NetworkSummaryInfo;
  interfaces: NetworkInterfaceItem[];
  wifi: WifiDetails;
  dns: string[];
  dns_details: DnsDetails;
  gateways: GatewayItem[];
}

export interface PingResponse {
  target: string;
  transmitted: number;
  received: number;
  packet_loss?: number;
  packet_loss_percent?: number;
  min_latency?: number | null;
  avg_latency?: number | null;
  max_latency?: number | null;
  mdev_latency?: number | null;
  avg_latency_ms?: number | null;
  output?: string;
  error?: string;
  success: boolean;
}

export interface DnsQueryResponse {
  domain: string;
  resolved_ip?: string;
  time_ms?: number;
  latency_ms?: number;
  ipv4?: string[];
  ipv6?: string[];
  count?: number;
  success: boolean;
  error?: string;
}

export interface PackageItem {
  name: string;
  version?: string;
  description?: string;
  installed?: boolean;
  upgradable?: boolean;
  new_version?: string;
}

export interface PackagesOverviewResponse {
  backend: string;
  backend_name: string;
  backend_short: string;
  installed_count: number;
  upgradable_count: number;
  upgradable: PackageItem[];
  installed: PackageItem[];
}

export interface UserSessionItem {
  user: string;
  tty: string;
  from?: string;
  host?: string;
  login_time?: string;
  idle?: string;
}

export interface UserStorageInfo {
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent_used: number;
}

export interface UserItem {
  name?: string;
  username?: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
  comment?: string;
  groups: string[];
  is_human?: boolean;
  is_admin?: boolean;
  is_current?: boolean;
  is_active?: boolean;
  home_exists?: boolean;
  home_storage?: UserStorageInfo | null;
  ssh_keys_count?: number;
}

export interface SshKeyItem {
  index: number;
  type: string;
  preview: string;
  comment: string;
  raw?: string;
}

export interface GroupCategoryItem {
  name: string;
  gid: number;
  members: string[];
  category: 'Privileged' | 'Hardware' | 'Services' | 'System' | 'General' | string;
  description: string;
  member_count: number;
}

export interface LoginHistoryItem {
  user: string;
  tty: string;
  host: string;
  time: string;
}

export interface SecurityPosture {
  elevation_engine?: string;
  has_sudo?: boolean;
  has_doas?: boolean;
  visudo_ok?: boolean;
  visudo_msg?: string;
  sshd_active?: boolean;
  root_ssh_login?: string;
  password_auth?: string;
}

export interface UsersMetrics {
  active_sessions_count: number;
  human_users_count: number;
  total_ssh_keys: number;
  is_elevated: boolean;
}

export interface UsersOverviewResponse {
  human_users: UserItem[];
  system_users: UserItem[];
  groups_categorized: GroupCategoryItem[] | Record<string, string[]>;
  active_sessions: UserSessionItem[];
  login_history: LoginHistoryItem[];
  security: SecurityPosture;
  metrics: UsersMetrics;
  current_user?: UserProfile;
  sudoers?: Record<string, unknown>;
}

export interface PowerStateResponse {
  active_governor: string;
  available_governors: string[];
  scheduled?: {
    action: string;
    time: string;
    remaining_minutes: number;
  } | null;
}

export interface SystemLogEntry {
  timestamp?: string;
  message?: string;
  service?: string;
  level?: string;
}

export type SystemLogItem = string | SystemLogEntry;

export interface SystemLogsResponse {
  logs: SystemLogItem[];
  count?: number;
  service?: string;
}

