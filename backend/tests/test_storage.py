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
