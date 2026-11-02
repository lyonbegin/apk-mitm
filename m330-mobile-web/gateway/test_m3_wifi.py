#!/usr/bin/env python3
"""Offline M3 Max Wi-Fi-only connector tests. No real AP joins or outbound network."""
import unittest
from unittest.mock import patch
import m3_onboard


class WiFiOnlyTest(unittest.TestCase):
    def test_no_bluetooth(self):
        with open(m3_onboard.__file__, "r", encoding="utf-8") as handle:
            code = handle.read()
        self.assertNotIn("BleakScanner", code)
        self.assertNotIn("navigator.bluetooth", code)
        self.assertNotIn("import bleak", code)

    @patch.object(m3_onboard, "active_wifi", return_value=None)
    @patch.object(m3_onboard, "lan_discovery", return_value=(0, "complete"))
    @patch.object(m3_onboard, "wifi_access_points", return_value=(["SmartLife-robot"], "complete"))
    def test_wifi_ap_found(self, *_):
        data, names = m3_onboard.wifi_report()
        self.assertEqual(data["schema_version"], 2)
        self.assertEqual(data["phase"], "wifi_ap_found")
        self.assertEqual(data["diagnostics"]["ap_candidates"], 1)
        self.assertFalse(data["diagnostics"]["wifi_ap_joined"])
        self.assertEqual(names, ["SmartLife-robot"])

    @patch.object(m3_onboard, "active_wifi", return_value="LEFANT-ABCD")
    @patch.object(m3_onboard, "lan_discovery", return_value=(0, "unavailable"))
    @patch.object(m3_onboard, "wifi_access_points", return_value=([], "unavailable"))
    def test_wifi_ap_association_not_authentication(self, *_):
        data, _ = m3_onboard.wifi_report()
        self.assertEqual(data["phase"], "wifi_ap_connected")
        self.assertTrue(data["diagnostics"]["wifi_ap_joined"])
        self.assertNotIn("device_authenticated", data)

    @patch.object(m3_onboard, "active_wifi", return_value=None)
    @patch.object(m3_onboard, "lan_discovery", return_value=(2, "complete"))
    @patch.object(m3_onboard, "wifi_access_points", return_value=([], "unavailable"))
    def test_router_lan_scan(self, *_):
        data, _ = m3_onboard.wifi_report()
        self.assertEqual(data["phase"], "wifi_lan_detected")
        self.assertEqual(data["diagnostics"]["lan_candidates"], 2)

    def test_explicit_join_required_and_no_auto_join(self):
        with self.assertRaises(ValueError):
            m3_onboard.join_ap("")
        with self.assertRaises(ValueError):
            m3_onboard.join_ap("x" * 100)

    @patch.object(m3_onboard.platform, "system", return_value="Linux")
    @patch.object(m3_onboard, "active_wifi", return_value="SmartLife-AB")
    @patch.object(m3_onboard, "run")
    def test_explicit_local_ap_join_linux(self, runner, *_):
        runner.return_value.returncode = 0
        self.assertTrue(m3_onboard.join_ap("SmartLife-AB"))
        runner.assert_called_with(["nmcli", "dev", "wifi", "connect", "SmartLife-AB"], timeout=25)

    def test_simulation_is_only_simulation(self):
        self.assertEqual(m3_onboard.main(["--simulate"]), 0)


if __name__ == "__main__":
    unittest.main()
