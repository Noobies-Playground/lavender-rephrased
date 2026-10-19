'''Unit tests for dashboard.services.network functions.'''

import pytest
from dashboard.services.network import get_known_dns_provider, format_bytes

def test_get_known_dns_provider():
    # Test known DNS providers (IPv4 and IPv6)
    assert get_known_dns_provider("1.1.1.1") == "Cloudflare DNS"
    assert get_known_dns_provider("1.0.0.1") == "Cloudflare DNS"
    assert get_known_dns_provider("2606:4700:4700::1111") == "Cloudflare DNS"
    assert get_known_dns_provider("8.8.8.8") == "Google Public DNS"
    assert get_known_dns_provider("8.8.4.4") == "Google Public DNS"
    assert get_known_dns_provider("2001:4860:4860::8888") == "Google Public DNS"
    assert get_known_dns_provider("9.9.9.9") == "Quad9"
    assert get_known_dns_provider("149.112.112.112") == "Quad9"
    assert get_known_dns_provider("2620:fe::fe") == "Quad9"
    assert get_known_dns_provider("208.67.222.222") == "OpenDNS"
    assert get_known_dns_provider("94.140.14.14") == "AdGuard DNS"

    # Test local/private IPs
    assert get_known_dns_provider("127.0.0.1") == "Local Stub Resolver"
    assert get_known_dns_provider("::1") == "Local Stub Resolver"
    assert get_known_dns_provider("192.168.1.1") == "Local Router / Gateway"
    assert get_known_dns_provider("10.0.0.1") == "Local Router / Gateway"
    assert get_known_dns_provider("172.16.0.1") == "Local Router / Gateway"
    assert get_known_dns_provider("172.31.255.254") == "Local Router / Gateway"

    # Test unknown/ISP DNS
    assert get_known_dns_provider("75.75.75.75") == "ISP / Custom DNS" # Comcast
    assert get_known_dns_provider("64.6.64.6") == "ISP / Custom DNS" # Verizon

    # Test empty/None IP
    assert get_known_dns_provider("") == "Unknown"
    assert get_known_dns_provider(None) == "Unknown"

def test_format_bytes():
    assert format_bytes(0) == "0 B"
    assert format_bytes(100) == "100 B"
    assert format_bytes(1023) == "1023 B"
    assert format_bytes(1024) == "1.0 KB"
    assert format_bytes(1536) == "1.5 KB"
    assert format_bytes(1024 * 1024) == "1.0 MB"
    assert format_bytes(1024 * 1024 * 1.5) == "1.5 MB"
    assert format_bytes(1024**3) == "1.0 GB"
    assert format_bytes(1024**4) == "1.0 TB"
    assert format_bytes(1024**5) == "1.0 PB"
    assert format_bytes(1024**6) == "1024.0 PB" # Should ideally be Exabytes, but the loop stops at PB. Check code for exact logic.

