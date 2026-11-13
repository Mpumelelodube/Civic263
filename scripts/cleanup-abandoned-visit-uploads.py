"""Admin-only cleanup of superseded leases belonging to committed community visits.

Dry-run by default. Never touches uncommitted attempts, retained evidence or public media.
Uses the configured gcloud user in memory; no runtime IAM grants are required.
"""
import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
import urllib.error

PROJECT = 'civic263-df6ec'
BUCKET = PROJECT + '.firebasestorage.app'
ACCOUNT = 'dubempumelelo9@gmail.com'


def abandoned(item, prefix, retained, now):
    name = item.get('name', '')
    if not name.startswith(prefix) or name in retained:
        return False
    if not re.fullmatch(r'[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg', name[len(prefix):]):
        return False
    try:
        created = dt.datetime.fromisoformat(item['timeCreated'].replace('Z', '+00:00'))
        return item['generation'].isdigit() and now - created >= dt.timedelta(days=7)
    except (KeyError, ValueError, TypeError):
        return False


def self_test():
    now = dt.datetime.now(dt.timezone.utc)
    prefix = 'private/reports/owner/' + 'a' * 40 + '/field-checks/' + 'b' * 40 + '/'
    item = {'name': prefix + 'a' * 8 + '-aaaa-aaaa-aaaa-' + 'a' * 12 + '/' +
            'b' * 8 + '-bbbb-bbbb-bbbb-' + 'b' * 12 + '.jpg',
            'generation': '123', 'timeCreated': (now - dt.timedelta(days=8)).isoformat()}
    assert abandoned(item, prefix, [], now)
    assert not abandoned(item, prefix, [item['name']], now)
    assert not abandoned({**item, 'timeCreated': now.isoformat()}, prefix, [], now)
    assert not abandoned({**item, 'name': prefix + '../retained.jpg'}, prefix, [], now)
    assert not abandoned({**item, 'generation': ''}, prefix, [], now)
    print('PASS: retained, recent, ambiguous and unrelated objects are excluded')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    cloud = shutil.which('gcloud') or r'C:/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd'
    token = subprocess.run([cloud, 'auth', 'print-access-token', '--account=' + ACCOUNT],
                           check=True, capture_output=True, text=True, timeout=60).stdout.strip()
    headers = {'Authorization': 'Bearer ' + token, 'x-goog-user-project': PROJECT}

    def request(url, method=None, allow_missing=False):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers, method=method), timeout=30) as response:
                return json.load(response) if response.status != 204 else {}
        except urllib.error.HTTPError as error:
            if allow_missing and error.code == 404:
                return {}
            raise

    docs = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/'
    storage = f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o'
    now = dt.datetime.now(dt.timezone.utc)
    candidates = removed = visits = 0
    page = ''
    while visits < 500:
        result = request(docs + 'fieldChecks?pageSize=100' + ('&pageToken=' + urllib.parse.quote(page, safe='') if page else ''))
        for document in result.get('documents', []):
            visits += 1
            fields = document['fields']
            text = lambda key: fields.get(key, {}).get('stringValue', '')
            visit_id, owner, report_id = text('id'), text('actorUid'), text('reportId')
            if not re.fullmatch(r'[a-f0-9]{40}', visit_id) or not re.fullmatch(r'[a-f0-9]{40}', report_id) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', owner):
                continue
            reservation = request(docs + 'fieldCheckSubmissions/' + visit_id, allow_missing=True).get('fields', {})
            receipt = reservation.get('receipt', {}).get('mapValue', {}).get('fields', {})
            if receipt.get('checkId', {}).get('stringValue') != visit_id or reservation.get('actorUid', {}).get('stringValue') != owner:
                continue
            retained = [value.get('stringValue', '') for value in fields.get('rawMediaPaths', {}).get('arrayValue', {}).get('values', [])]
            if not retained:
                continue
            prefix = f'private/reports/{owner}/{report_id}/field-checks/{visit_id}/'
            if any(not path.startswith(prefix) for path in retained):
                continue
            objects_page = ''
            while True:
                listing = request(storage + '?' + urllib.parse.urlencode({'prefix': prefix, 'maxResults': 1000, **({'pageToken': objects_page} if objects_page else {})}))
                for item in listing.get('items', []):
                    if not abandoned(item, prefix, retained, now):
                        continue
                    candidates += 1
                    if args.apply:
                        # Canonical visit evidence must remain unchanged since the inventory read.
                        latest = request('https://firestore.googleapis.com/v1/' + document['name'])
                        if latest.get('fields', {}).get('rawMediaPaths') != fields.get('rawMediaPaths'):
                            raise RuntimeError('Evidence changed; cleanup stopped without deleting this object')
                        request(storage + '/' + urllib.parse.quote(item['name'], safe='') + '?ifGenerationMatch=' + item['generation'], 'DELETE')
                        removed += 1
                objects_page = listing.get('nextPageToken', '')
                if not objects_page:
                    break
        page = result.get('nextPageToken', '')
        if not page:
            break
    print(json.dumps({'mode': 'apply' if args.apply else 'dry-run', 'committedVisitsChecked': visits,
                      'supersededObjectsOlderThan7Days': candidates, 'objectsRemoved': removed,
                      'moreVisitsRemain': bool(page)}))


if __name__ == '__main__':
    main()
