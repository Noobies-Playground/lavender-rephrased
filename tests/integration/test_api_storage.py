import pytest
import os
import tempfile


@pytest.mark.asyncio
async def test_get_storage_disks(auth_client):
    res = await auth_client.get("/api/storage")
    assert res.status_code == 200
    data = res.json()
    assert "disks" in data
    assert isinstance(data["disks"], list)


@pytest.mark.asyncio
async def test_get_storage_bookmarks(auth_client):
    res = await auth_client.get("/api/storage/bookmarks")
    assert res.status_code == 200
    data = res.json()
    assert "bookmarks" in data
    assert "disks" in data
    assert len(data["bookmarks"]) > 0


@pytest.mark.asyncio
async def test_list_files_and_crud(auth_client):
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a test file
        test_file = os.path.join(tmpdir, "hello.txt")
        with open(test_file, "w") as f:
            f.write("Hello, Lavender!")

        # List files
        res = await auth_client.get(f"/api/storage/files?path={tmpdir}")
        assert res.status_code == 200
        data = res.json()
        assert data["current_path"] == os.path.realpath(tmpdir)
        assert data["total_files"] == 1
        assert data["items"][0]["name"] == "hello.txt"

        # View file
        view_res = await auth_client.get(f"/api/storage/file/view?path={test_file}")
        assert view_res.status_code == 200
        vdata = view_res.json()
        assert vdata["is_text"] is True
        assert vdata["content"] == "Hello, Lavender!"

        # Save edit
        save_res = await auth_client.post(
            "/api/storage/file/save",
            json={"path": test_file, "content": "Updated content"}
        )
        assert save_res.status_code == 200

        with open(test_file, "r") as f:
            assert f.read() == "Updated content"

        # Create folder
        mkdir_res = await auth_client.post(
            "/api/storage/mkdir",
            json={"path": tmpdir, "name": "subfolder"}
        )
        assert mkdir_res.status_code == 200

        # Create file
        create_res = await auth_client.post(
            "/api/storage/file/create",
            json={"path": tmpdir, "name": "new.py", "content": "print('ok')"}
        )
        assert create_res.status_code == 200

        # Rename
        rename_res = await auth_client.post(
            "/api/storage/rename",
            json={"old_path": os.path.join(tmpdir, "new.py"), "new_name": "renamed.py"}
        )
        assert rename_res.status_code == 200
        assert os.path.exists(os.path.join(tmpdir, "renamed.py"))

        # Delete
        del_res = await auth_client.post(
            "/api/storage/delete",
            json={"paths": [os.path.join(tmpdir, "renamed.py"), os.path.join(tmpdir, "subfolder")]}
        )
        assert del_res.status_code == 200
        assert not os.path.exists(os.path.join(tmpdir, "renamed.py"))
