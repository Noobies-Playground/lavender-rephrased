import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NetworkPage } from './NetworkPage';
import { api } from '../../api/client';
import { ToastProvider } from '../../context/ToastContext';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('NetworkPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockNetworkData = {
    interfaces: [
      {
        name: 'eth0',
        ip: '192.168.1.150',
        mac: 'b8:27:eb:11:22:33',
        state: 'UP',
        category: 'ethernet',
        speed: '1000 Mb/s',
        rx_bytes_fmt: '12.5 MB',
        tx_bytes_fmt: '8.2 MB',
      },
      {
        name: 'wlan0',
        ip: '192.168.1.151',
        mac: 'b8:27:eb:44:55:66',
        state: 'UP',
        category: 'wireless',
        speed: '54 Mb/s',
        rx_bytes_fmt: '25.0 MB',
        tx_bytes_fmt: '14.1 MB',
      },
    ],
    wifi: {
      has_hardware: true,
      connected: true,
      ssid: 'LavenderNet-5G',
      bssid: '9E:03:8E:A1:24:D9',
      signal_percent: 82,
      frequency: '5180 MHz',
      channel: '36',
      bitrate: '270 Mbit/s',
      security: 'WPA2-PSK',
      networks: [
        { ssid: 'LavenderNet-5G', signal: 82, security: 'WPA2-PSK', frequency: '5180 MHz' },
        { ssid: 'GuestWifi', signal: 45, security: 'Open', frequency: '2412 MHz' },
      ],
      nearby: [
        { ssid: 'LavenderNet-5G', signal: 82, security: 'WPA2-PSK', frequency: '5180 MHz' },
        { ssid: 'GuestWifi', signal: 45, security: 'Open', frequency: '2412 MHz' },
      ],
    },
    dns: ['1.1.1.1', '8.8.8.8'],
    dns_details: {
      servers: [
        { ip: '1.1.1.1', provider: 'Cloudflare DNS', is_primary: true },
        { ip: '8.8.8.8', provider: 'Google Public DNS', is_primary: false },
      ],
      upstream_ips: ['1.1.1.1', '8.8.8.8'],
      has_local_stub: true,
    },
    gateways: [
      { gateway: '192.168.1.1', interface: 'wlan0' },
    ],
    summary: {
      is_online: true,
      primary_interface: 'wlan0',
      primary_type: 'wireless',
      primary_ip: '192.168.1.151',
      default_gateway: '192.168.1.1',
      primary_dns: '1.1.1.1',
      primary_dns_provider: 'Cloudflare DNS',
      total_rx_fmt: '37.5 MB',
      total_tx_fmt: '22.3 MB',
      wifi_connected: true,
      wifi_ssid: 'LavenderNet-5G',
      wifi_signal: 82,
    },
  };

  it('renders network interfaces and active WiFi connection in summary and tabs', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockNetworkData);

    render(
      <ToastProvider>
        <MemoryRouter>
          <NetworkPage />
        </MemoryRouter>
      </ToastProvider>
    );

    // Initial interfaces tab
    expect(await screen.findByText('eth0')).toBeInTheDocument();
    expect(screen.getByText('wlan0')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.150')).toBeInTheDocument();
    expect(screen.getByText('b8:27:eb:11:22:33')).toBeInTheDocument();
    expect(screen.getAllByText('LavenderNet-5G').length).toBeGreaterThan(0);

    // Switch to WiFi Tab
    const wifiTabBtn = screen.getByRole('button', { name: /WiFi/i });
    act(() => {
      fireEvent.click(wifiTabBtn);
    });

    expect(await screen.findByText('Connected Network')).toBeInTheDocument();
    expect(screen.getByText('GuestWifi')).toBeInTheDocument();
    expect(screen.getByText('9E:03:8E:A1:24:D9')).toBeInTheDocument();
  });

  it('triggers WiFi scan and displays updated networks', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockNetworkData);
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      networks: [
        { ssid: 'NewHotspot', signal: 95, security: 'WPA3', frequency: '5GHz' },
      ],
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <NetworkPage />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText('eth0');

    // Switch to WiFi Tab
    const wifiTabBtn = screen.getByRole('button', { name: /WiFi/i });
    act(() => {
      fireEvent.click(wifiTabBtn);
    });

    const scanBtn = await screen.findByRole('button', { name: /Scan Wireless Networks/i });
    act(() => {
      fireEvent.click(scanBtn);
    });

    expect(await screen.findByText('NewHotspot')).toBeInTheDocument();
    expect(screen.getByText('WPA3')).toBeInTheDocument();
  });

  it('executes Ping test and displays statistics in Connectivity tab', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/ping')) {
        return Promise.resolve({
          target: '1.1.1.1',
          transmitted: 3,
          received: 3,
          packet_loss: 0,
          avg_latency: 12.45,
          avg_latency_ms: 12.45,
          min_latency: 10.1,
          max_latency: 14.8,
          success: true,
        });
      }
      return Promise.resolve(mockNetworkData);
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <NetworkPage />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText('eth0');

    // Switch to Connectivity Tab
    const connTabBtn = screen.getByRole('button', { name: /Connectivity/i });
    act(() => {
      fireEvent.click(connTabBtn);
    });

    const pingBtn = await screen.findByRole('button', { name: /^Ping$/i });
    act(() => {
      fireEvent.click(pingBtn);
    });

    expect(await screen.findByText(/12\.4 ms/i)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 3/i)).toBeInTheDocument();
    expect(screen.getByText(/0% Loss/i)).toBeInTheDocument();
  });

  it('executes DNS query and displays resolved IP in DNS tab', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/dns-query')) {
        return Promise.resolve({
          domain: 'google.com',
          resolved_ip: '142.250.190.46',
          time_ms: 18.2,
          latency_ms: 18.2,
          ipv4: ['142.250.190.46'],
          ipv6: ['2607:f8b0:4004:800::200e'],
          count: 2,
          success: true,
        });
      }
      return Promise.resolve(mockNetworkData);
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <NetworkPage />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText('eth0');

    // Switch to DNS Tab
    const dnsTabBtn = screen.getByRole('button', { name: /DNS/i });
    act(() => {
      fireEvent.click(dnsTabBtn);
    });

    expect(await screen.findByText('Upstream DNS Servers')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare DNS')).toBeInTheDocument();

    const dnsBtn = screen.getByRole('button', { name: /^Resolve$/i });
    act(() => {
      fireEvent.click(dnsBtn);
    });

    expect(await screen.findByText(/18.2 ms/i)).toBeInTheDocument();
    expect(screen.getAllByText('142.250.190.46').length).toBeGreaterThan(0);
  });

  it('filters interfaces and toggles table view', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockNetworkData);

    render(
      <ToastProvider>
        <MemoryRouter>
          <NetworkPage />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText('eth0');

    // Click Dense Table View switcher
    const tableViewBtn = screen.getByTitle('Dense Table View');
    act(() => {
      fireEvent.click(tableViewBtn);
    });

    // Check table headers
    expect(screen.getByText('Traffic (RX / TX)')).toBeInTheDocument();

    // Test filter search
    const searchInput = screen.getByPlaceholderText(/Filter interfaces/i);
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'wlan' } });
    });

    expect(screen.getByText('wlan0')).toBeInTheDocument();
    expect(screen.queryByText('eth0')).not.toBeInTheDocument();
  });
});
