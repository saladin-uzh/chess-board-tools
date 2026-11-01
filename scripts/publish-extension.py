#!/usr/bin/env python3
"""Submit a verified build artifact to Chrome Web Store API v2."""

import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

CONFIG = ('CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN',
          'CWS_PUBLISHER_ID', 'CWS_EXTENSION_ID')
BASE = 'https://chromewebstore.googleapis.com'


class SubmissionError(Exception):
    """A safe, actionable message without credentials or response bodies."""



def report(message):
    print(message)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
            output.write(message + '\n')


def request(url, data=None, headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(
                url, data=data, headers=headers or {}), timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # API bodies may contain credentials or arbitrary input; never log them.
        raise SubmissionError(f'API request failed (HTTP {error.code})') from None
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise SubmissionError('API request failed: network error or invalid JSON') from None


def version(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d+(?:\.\d+){0,3}', value):
        raise SubmissionError('Invalid extension version')
    parts = tuple(int(part) for part in value.split('.'))
    if any(part > 65535 for part in parts):
        raise SubmissionError('Invalid extension version component')
    return parts + (0,) * (4 - len(parts))


def revisions(status, key):
    revision = status.get(key)
    if not revision:
        return None, []
    values = [channel['crxVersion'] for channel in revision.get('distributionChannels', [])]
    if not values:
        raise SubmissionError('Store revision has no version; inspect Developer Dashboard')
    for value in values:
        version(value)
    return revision.get('state'), values


def should_upload(status, candidate):
    current = version(candidate)
    if status.get('takenDown'):
        raise SubmissionError('Store item is taken down; inspect Developer Dashboard')
    published_state, published = revisions(status, 'publishedItemRevisionStatus')
    submitted_state, submitted = revisions(status, 'submittedItemRevisionStatus')
    if any(current < version(value) for value in published + submitted):
        raise SubmissionError('Build version is lower than an existing store revision')
    if published_state == 'PUBLISHED' and any(current == version(value) for value in published):
        report(f'Publication skipped: version {candidate} is already published.')
        return False
    if submitted_state in ('PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'):
        if any(current == version(value) for value in submitted):
            report(f'Publication skipped: version {candidate} already submitted ({submitted_state}).')
            return False
        raise SubmissionError('Another version is submitted or staged; finish it in Developer Dashboard')
    if submitted_state and submitted_state not in ('REJECTED', 'CANCELLED'):
        raise SubmissionError('Unknown store submission state; inspect Developer Dashboard')
    return True


def artifact(directory):
    archives = list(Path(directory).glob('*.zip'))
    if len(archives) != 1:
        raise SubmissionError('Expected exactly one ZIP artifact')
    path = archives[0]
    payload = path.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    provenance = json.loads(path.with_suffix('.zip.provenance.json').read_text())
    expected = path.with_suffix('.zip.sha256').read_text().split()[0]
    if digest != expected or digest != provenance['sha256']:
        raise SubmissionError('Artifact checksum mismatch')
    if provenance['sourceCommit'] != os.environ['GITHUB_SHA']:
        raise SubmissionError('Artifact source commit mismatch')
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(provenance['files']):
            raise SubmissionError('Artifact ZIP integrity or membership mismatch')
        for name, checksum in provenance['files'].items():
            if hashlib.sha256(archive.read(name)).hexdigest() != checksum:
                raise SubmissionError('Artifact runtime file checksum mismatch')
        manifest = json.loads(archive.read('manifest.json'))
    if manifest['version'] != provenance['version']:
        raise SubmissionError('Artifact version mismatch')
    version(manifest['version'])
    return payload, manifest['version']


def main(directory='build'):
    if os.environ.get('GITHUB_REF') != 'refs/heads/prod':
        raise SubmissionError('Publication is restricted to prod')
    if not all(os.environ.get(key) for key in CONFIG):
        report('Publication skipped: configure all CWS secrets and variables. Build artifact is available.')
        return
    publisher = os.environ['CWS_PUBLISHER_ID']
    extension = os.environ['CWS_EXTENSION_ID']
    if not re.fullmatch(r'[A-Za-z0-9_-]+', publisher) or not re.fullmatch(r'[a-p]{32}', extension):
        raise SubmissionError('Invalid publisher or extension ID')
    payload, candidate = artifact(directory)
    token = request('https://oauth2.googleapis.com/token', urllib.parse.urlencode({
        'client_id': os.environ['CWS_CLIENT_ID'],
        'client_secret': os.environ['CWS_CLIENT_SECRET'],
        'refresh_token': os.environ['CWS_REFRESH_TOKEN'],
        'grant_type': 'refresh_token',
    }).encode(), {'Content-Type': 'application/x-www-form-urlencoded'})['access_token']
    print(f'::add-mask::{token}')
    headers = {'Authorization': f'Bearer {token}'}
    item = f'publishers/{publisher}/items/{extension}'
    endpoint = f'{BASE}/v2/{item}'
    if not should_upload(request(endpoint + ':fetchStatus', headers=headers), candidate):
        return
    upload = request(f'{BASE}/upload/v2/{item}:upload', payload,
                     {**headers, 'Content-Type': 'application/zip'})
    state = upload.get('uploadState')
    # Reference enums use IN_PROGRESS; the API guide also documents UPLOAD_IN_PROGRESS.
    for _ in range(30):
        if state not in ('IN_PROGRESS', 'UPLOAD_IN_PROGRESS'):
            break
        time.sleep(10)
        state = request(endpoint + ':fetchStatus', headers=headers).get('lastAsyncUploadState')
    if state != 'SUCCEEDED':
        raise SubmissionError('Upload failed or did not complete within five minutes')
    if upload.get('crxVersion') and upload['crxVersion'] != candidate:
        raise SubmissionError('Uploaded version mismatch')
    result = request(endpoint + ':publish', json.dumps({
        'publishType': 'DEFAULT_PUBLISH', 'skipReview': False, 'blockOnWarnings': True,
    }).encode(), {**headers, 'Content-Type': 'application/json'})
    state = result.get('state')
    if state == 'PENDING_REVIEW':
        report(f'Version {candidate} submitted for review; publication is not yet confirmed.')
    elif state == 'PUBLISHED':
        report(f'Version {candidate} published (confirmed by Chrome Web Store API).')
    else:
        raise SubmissionError('Unexpected publication state; inspect Developer Dashboard before retrying')


if __name__ == '__main__':
    try:
        main(sys.argv[1] if len(sys.argv) > 1 else 'build')
    except SubmissionError as error:
        report(f'Publication failed: {error}')
        sys.exit(1)
    except (ValueError, KeyError, OSError, zipfile.BadZipFile):
        # Only controlled errors are safe to print; never expose external values.
        report('Publication failed. Check configuration, version and Developer Dashboard; see CI documentation.')
        sys.exit(1)
