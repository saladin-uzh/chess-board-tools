"""Offline API-boundary tests; these never access Chrome Web Store."""

import importlib.util
import io
import hashlib
import json
import tempfile
import zipfile
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error

SPEC = importlib.util.spec_from_file_location(
    'publish_extension', Path(__file__).resolve().parents[1] / 'scripts/publish-extension.py')
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)


def revision(state, version):
    return {'state': state, 'distributionChannels': [{'crxVersion': version}]}


class SubmissionTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            'GITHUB_REF': 'refs/heads/prod', 'GITHUB_SHA': 'test-sha',
            'GITHUB_STEP_SUMMARY': '',
            **{key: 'configured' for key in P.CONFIG},
            'CWS_EXTENSION_ID': 'a' * 32,
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_missing_configuration_does_not_access_api(self):
        with patch.dict(os.environ, {'CWS_REFRESH_TOKEN': ''}), patch.object(P, 'request') as api:
            P.main()
            api.assert_not_called()

    def test_non_prod_cannot_submit(self):
        with patch.dict(os.environ, {'GITHUB_REF': 'refs/heads/dev'}):
            with self.assertRaisesRegex(P.SubmissionError, 'restricted'):
                P.main()

    def test_existing_versions_skip_without_upload(self):
        for key, state in [('publishedItemRevisionStatus', 'PUBLISHED'),
                           ('submittedItemRevisionStatus', 'PENDING_REVIEW'),
                           ('submittedItemRevisionStatus', 'STAGED')]:
            with self.subTest(state=state), patch.object(P, 'artifact', return_value=(b'zip', '1.2.0')), \
                    patch.object(P, 'request', side_effect=[{'access_token': 'test'},
                        {key: revision(state, '1.2.0')}]) as api:
                P.main()
                self.assertEqual(api.call_count, 2)

    def test_other_pending_version_blocks(self):
        for state in ['PENDING_REVIEW', 'STAGED']:
            with self.assertRaisesRegex(P.SubmissionError, 'Another version'):
                P.should_upload({'submittedItemRevisionStatus': revision(state, '1.1.0')}, '1.2.0')

    def test_lower_version_rejected(self):
        with self.assertRaisesRegex(P.SubmissionError, 'lower'):
            P.should_upload({'publishedItemRevisionStatus': revision('PUBLISHED', '1.3.0')}, '1.2.0')

    def test_numeric_comparison_and_new_version(self):
        self.assertTrue(P.should_upload({
            'publishedItemRevisionStatus': revision('PUBLISHED', '1.9.0')}, '1.10.0'))

    def test_unknown_revision_fails_closed(self):
        with self.assertRaises(P.SubmissionError):
            P.should_upload({'submittedItemRevisionStatus': {'state': 'PENDING_REVIEW'}}, '1.2.0')

    def run_submission(self, replies):
        with patch.object(P, 'artifact', return_value=(b'verified-zip', '1.2.1')), \
                patch.object(P, 'request', side_effect=[{'access_token': 'test'}, {}, *replies]) as api, \
                patch.object(P.time, 'sleep'), patch.object(P, 'report') as report:
            P.main()
            return api.call_args_list, report.call_args_list

    def test_success_submits_exact_payload_and_reports_review(self):
        calls, reports = self.run_submission([
            {'uploadState': 'SUCCEEDED', 'crxVersion': '1.2.1'}, {'state': 'PENDING_REVIEW'}])
        self.assertEqual(calls[2].args[1], b'verified-zip')
        self.assertTrue(calls[3].args[0].endswith(':publish'))
        self.assertIn('not yet confirmed', reports[-1].args[0])

    def test_async_upload_polls_before_publish(self):
        calls, _ = self.run_submission([
            {'uploadState': 'IN_PROGRESS'}, {'lastAsyncUploadState': 'IN_PROGRESS'},
            {'lastAsyncUploadState': 'SUCCEEDED'}, {'state': 'PENDING_REVIEW'}])
        self.assertTrue(calls[3].args[0].endswith(':fetchStatus'))
        self.assertTrue(calls[5].args[0].endswith(':publish'))

    def test_failed_upload_never_publishes(self):
        with patch.object(P, 'artifact', return_value=(b'zip', '1.2.1')), \
                patch.object(P, 'request', side_effect=[{'access_token': 'test'}, {},
                    {'uploadState': 'FAILED'}]) as api:
            with self.assertRaisesRegex(P.SubmissionError, 'Upload failed'):
                P.main()
            self.assertEqual(api.call_count, 3)

    def test_async_upload_timeout_is_bounded(self):
        with patch.object(P, 'artifact', return_value=(b'zip', '1.2.1')), \
                patch.object(P, 'request', side_effect=[{'access_token': 'test'}, {},
                    {'uploadState': 'IN_PROGRESS'}, *[{'lastAsyncUploadState': 'IN_PROGRESS'}] * 30]) as api, \
                patch.object(P.time, 'sleep') as sleep:
            with self.assertRaisesRegex(P.SubmissionError, 'five minutes'):
                P.main()
            self.assertEqual(sleep.call_count, 30)
            self.assertEqual(api.call_count, 33)

    def test_artifact_integrity_and_source_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'extension.zip'
            manifest = json.dumps({'version': '1.2.1'}).encode()
            with zipfile.ZipFile(archive, 'w') as output:
                output.writestr('manifest.json', manifest)
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            provenance = {'sha256': digest, 'sourceCommit': 'test-sha', 'version': '1.2.1',
                          'files': {'manifest.json': hashlib.sha256(manifest).hexdigest()}}
            archive.with_suffix('.zip.sha256').write_text(digest + '  extension.zip\n')
            archive.with_suffix('.zip.provenance.json').write_text(json.dumps(provenance))
            self.assertEqual(P.artifact(directory)[1], '1.2.1')
            with patch.dict(os.environ, {'GITHUB_SHA': 'different-sha'}):
                with self.assertRaisesRegex(P.SubmissionError, 'source commit'):
                    P.artifact(directory)
            archive.write_bytes(b'corrupt')
            with self.assertRaisesRegex(P.SubmissionError, 'checksum'):
                P.artifact(directory)

    def test_http_error_does_not_expose_response_body(self):
        error = urllib.error.HTTPError('https://example.invalid', 401, 'secret', {}, io.BytesIO(b'secret'))
        with patch.object(P.urllib.request, 'urlopen', side_effect=error):
            with self.assertRaisesRegex(P.SubmissionError, r'HTTP 401') as caught:
                P.request('https://example.invalid')
            self.assertNotIn('secret', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
