#!/usr/bin/env python3
"""Offline tests: actual registration worker status must never claim paired before proof."""
import json
import subprocess
import threading
import unittest
from unittest.mock import patch, Mock

import m3_pair_job


class TestPairJob(unittest.TestCase):
    def config(self):
        return {"ssid":"Home24","wifi_password":"home-private-123",
                "api_key":"user-client-id","api_secret":"private-client-secret",
                "schema":"com.example.channel","region":"cn"}

    def test_validate_requires_authorized_credential(self):
        cfg = self.config()
        self.assertEqual(m3_pair_job.validate(cfg)["region"], "cn")
        del cfg["api_secret"]
        with self.assertRaises(ValueError):
            m3_pair_job.validate(cfg)
        with self.assertRaises(ValueError):
            m3_pair_job.validate(dict(self.config(),region="invalid"))

    def test_success_requires_cloud_confirmation_from_worker(self):
        result = json.dumps({"code":"CLOUD_PAIRED","cloud_confirmed":True,
                             "credentials_saved":True,
                             "devices":[{"ref":"0123456789ab","has_local_key":True}]})
        with patch.object(m3_pair_job,"RUNNING",True):
            code = m3_pair_job._run(self.config(), runner=lambda *args,**kw:
                    subprocess.CompletedProcess(args[0],0,stdout=result+"\n",stderr=""))
        self.assertEqual(code,"CLOUD_PAIRED")
        state = m3_pair_job.status()
        self.assertTrue(state["registered"])
        self.assertFalse(state["hardware_control_verified"])
        self.assertNotIn(self.config()["wifi_password"],json.dumps(state))
        self.assertNotIn(self.config()["api_secret"],json.dumps(state))

    def test_api_error_does_not_count_as_registration(self):
        with patch.object(m3_pair_job,"RUNNING",True):
            code = m3_pair_job._run(self.config(),runner=lambda *args,**kw:
                    subprocess.CompletedProcess(args[0],1,stdout='{"code":"DEVICE_DID_NOT_ACTIVATE"}\n',stderr="private-client-secret"))
        self.assertEqual(code,"DEVICE_DID_NOT_ACTIVATE")
        self.assertFalse(m3_pair_job.status()["registered"])
        self.assertNotIn("private-client-secret",json.dumps(m3_pair_job.status()))

    def test_worker_cannot_claim_success_with_nonzero_exit(self):
        with patch.object(m3_pair_job,"RUNNING",True):
            code = m3_pair_job._run(self.config(),runner=lambda *args,**kw:
                    subprocess.CompletedProcess(args[0],1,stdout='{"code":"CLOUD_PAIRED","devices":[]}\n',stderr=""))
        self.assertEqual(code,"WORKER_FAILED")
        self.assertFalse(m3_pair_job.status()["registered"])

    def test_secrets_go_over_stdin_not_process_arguments(self):
        captured={}
        def runner(args,**kw):
            captured.update(args=args,**kw)
            return subprocess.CompletedProcess(args,1,stdout='{"code":"TUYA_PROJECT_AUTH_REJECTED"}\n',stderr="")
        m3_pair_job._run(self.config(),runner=runner)
        self.assertEqual(captured["args"][0],"node")
        self.assertNotIn("private-client-secret",str(captured["args"]))
        self.assertIn("private-client-secret",captured["input"])
        self.assertTrue(captured["capture_output"])
        self.assertFalse(m3_pair_job.status()["registered"])


if __name__=="__main__":
    unittest.main()
