import asyncio
from unittest.mock import patch
import pytest

from server.auth.bridge import run_command_async, run_sudo_async, run_user_service_async


@pytest.mark.asyncio
async def test_run_command_async_success():
    code, out, err = await run_command_async(["echo", "hello"])
    assert code == 0
    assert out == "hello"


@pytest.mark.asyncio
async def test_run_command_async_timeout():
    code, out, err = await run_command_async(["sleep", "2"], timeout=0.1)
    assert code == -1
    assert "timed out" in err.lower()


@pytest.mark.asyncio
async def test_run_sudo_async_timeout_handling():
    with patch("server.auth.bridge.asyncio.wait_for", side_effect=asyncio.TimeoutError):
        code, out, err = await run_sudo_async(["apt-get", "upgrade"], password=None, timeout=1)
        assert code == -1
        assert "timed out" in err.lower()


@pytest.mark.asyncio
async def test_run_user_service_async_timeout_handling():
    with patch("server.auth.bridge.asyncio.wait_for", side_effect=asyncio.TimeoutError):
        code, out, err = await run_user_service_async(1000, ["systemctl", "--user", "status"], timeout=1)
        assert code == -1
        assert "timed out" in err.lower()
