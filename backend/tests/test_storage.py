import json

from app.storage import Storage


def test_storage_reads_audits_and_compacts_samples(tmp_path):
    storage = Storage(str(tmp_path / "inverter.db"))
    storage.add_sample({"battery_voltage": 51.2})
    storage.audit("setting_change", "accepted", "output_source_priority", new_value="sbu")

    assert len(storage.history(1)) == 1
    assert storage.audit_rows()[0]["result"] == "accepted"

    storage.compact(-1)
    assert storage.history(1) == []
    storage.close()


def test_storage_reads_explicit_history_range(tmp_path):
    storage = Storage(str(tmp_path / "inverter.db"))
    rows = [
        ("2026-01-01T00:00:00+00:00", {"battery_voltage": 50.1}),
        ("2026-01-01T01:00:00+00:00", {"battery_voltage": 51.2}),
        ("2026-01-01T02:00:00+00:00", {"battery_voltage": 52.3}),
    ]
    for captured_at, data in rows:
        storage.connection.execute("INSERT INTO samples VALUES (?, ?)", (captured_at, json.dumps(data)))
    storage.connection.commit()

    samples = storage.history_range("2026-01-01T00:30:00+00:00", "2026-01-01T01:30:00+00:00")

    assert samples == [{"captured_at": "2026-01-01T01:00:00+00:00", "battery_voltage": 51.2}]
    storage.close()
