"""Admin-only sweep of photos no record names any more (P03 retention).

Finds objects under private/reports/ and public/incidents/ that no report, community visit or
public issue refers to, and that are at least 7 days old: uploads from abandoned or retried
attempts, superseded visit leases, derivative batches a review never adopted, and deletions
that a withdrawal or account deletion recorded but could not finish. Anything outside those
prefixes, or whose name does not match a known pattern, is counted and never touched.

Dry run by default: prints counts only, never names or content. --apply re-reads the records of
each affected report immediately before deleting, and deletes with a generation precondition,
so an object that became referenced, or was rewritten, in the meantime is kept. Deleted objects
stay recoverable for 7 days through the bucket's soft-delete policy.

The backend service account deliberately cannot list objects, so this runs with an
administrator's gcloud login rather than inside the app.

  python scripts/cleanup-orphans.py --self-test
  python scripts/cleanup-orphans.py --account ADMIN_LOGIN
  python scripts/cleanup-orphans.py --account ADMIN_LOGIN --apply
"""
import argparse
import collections
import datetime as dt
import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

PROJECT = 'civic263-df6ec'
BUCKET = PROJECT + '.firebasestorage.app'
GCLOUD = r'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
DOCS = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
OBJECTS = f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o'
MIN_AGE = dt.timedelta(days=7)
ID = r'[a-f0-9]{40}'
UID = r'[A-Za-z0-9_-]{1,128}'
FILE = r'[A-Za-z0-9_.-]{1,80}\.jpg'
# Every naming pattern the backend writes, with the report id as the first group.
PATTERNS = {
    'report originals': re.compile(rf'private/reports/{UID}/({ID})/{FILE}'),
    # resolution/{attempt}/{lease}/{photo}.jpg, plus older single-folder test fixtures.
    'resolution originals': re.compile(rf'private/reports/{UID}/({ID})/resolution/(?:[A-Za-z0-9_-]{{1,80}}/){{1,2}}{FILE}'),
    'visit originals': re.compile(rf'private/reports/{UID}/({ID})/field-checks/{ID}/[a-f0-9-]{{36}}/{FILE}'),
    'issue photos': re.compile(rf'public/incidents/({ID})/\d{{1,2}}\.jpg'),
    'resolution photos': re.compile(rf'public/incidents/({ID})/resolution/(?:[a-f0-9-]{{36}}/)?\d{{1,2}}\.jpg'),
    'visit photos': re.compile(rf'public/incidents/({ID})/field-checks/{ID}/[a-f0-9-]{{36}}/\d{{1,2}}\.jpg'),
}


def classify(name):
    for kind, pattern in PATTERNS.items():
        match = pattern.fullmatch(name)
        if match:
            return kind, match.group(1)
    return None, None


def strings(value):
    return [item.get('stringValue', '') for item in (value or {}).get('arrayValue', {}).get('values', [])]


def integer(value):
    return int((value or {}).get('integerValue', 0))


def text(value):
    return (value or {}).get('stringValue', '')


def referenced(report_id, report, incident, checks):
    """Every object the records of one report still name. Paths a withdrawal or erasure queued
    for deletion are excluded even if an older field still names them."""
    keep = set()
    pending = set()
    if report:
        keep.update(strings(report.get('rawMediaPaths')))
        keep.update(strings(report.get('resolutionEvidence', {}).get('mapValue', {}).get('fields', {}).get('rawMediaPaths')))
        pending.update(strings(report.get('mediaCleanup')))
    if incident:
        hold = text(incident.get('moderationHold', {}).get('mapValue', {}).get('fields', {}).get('status'))
        if not incident.get('withdrawnAt') and hold != 'removed':
            removed = {integer(item) for item in incident.get('removedPhotos', {}).get('arrayValue', {}).get('values', [])}
            stored = max(integer(incident.get('storedPhotoCount')), integer(incident.get('photoCount')))
            keep.update(f'public/incidents/{report_id}/{index}.jpg' for index in range(stored) if index not in removed)
            batch = text(incident.get('resolutionMediaBatchId'))
            resolution = incident.get('resolution', {}).get('mapValue', {}).get('fields', {})
            if batch:
                keep.update(f'public/incidents/{report_id}/resolution/{batch}/{index}.jpg'
                            for index in range(integer(resolution.get('photoCount'))))
    for check_id, check in checks:
        keep.update(strings(check.get('rawMediaPaths')))
        batch = text(check.get('reviewMediaBatchId'))
        if batch:
            keep.update(f'public/incidents/{report_id}/field-checks/{check_id}/{batch}/{index}.jpg'
                        for index in range(integer(check.get('photoCount'))))
    return keep - pending


def orphaned(item, keep, now):
    kind, _ = classify(item.get('name', ''))
    if kind is None or item['name'] in keep or not str(item.get('generation', '')).isdigit():
        return False
    try:
        created = dt.datetime.fromisoformat(item['timeCreated'].replace('Z', '+00:00'))
    except (KeyError, ValueError):
        return False
    return now - created >= MIN_AGE


def self_test():
    now = dt.datetime.now(dt.timezone.utc)
    rid, cid, lease = 'a' * 40, 'b' * 40, '12345678-1234-1234-1234-123456789abc'
    old = (now - dt.timedelta(days=8)).isoformat()
    item = lambda name, created=old: {'name': name, 'generation': '7', 'timeCreated': created}
    original = f'private/reports/owner-1/{rid}/photo-1.jpg'
    visit = f'private/reports/visitor-2/{rid}/field-checks/{cid}/{lease}/photo-2.jpg'
    derivative = f'public/incidents/{rid}/0.jpg'
    report = {'rawMediaPaths': {'arrayValue': {'values': [{'stringValue': original}]}}}
    incident = {'photoCount': {'integerValue': '1'}}
    check = {'rawMediaPaths': {'arrayValue': {'values': [{'stringValue': visit}]}}}
    keep = referenced(rid, report, incident, [(cid, check)])
    assert classify(original) == ('report originals', rid)
    assert classify(visit) == ('visit originals', rid)
    assert classify(f'private/reports/owner-1/{rid}/resolution/{lease}/{lease}/{lease}.jpg') == ('resolution originals', rid)
    assert classify(f'private/reports/o/{rid}/../x.jpg')[0] is None
    assert classify('public/site/logo.jpg')[0] is None
    assert not orphaned(item(original), keep, now) and not orphaned(item(visit), keep, now)
    assert not orphaned(item(derivative), keep, now)
    stray = f'private/reports/owner-1/{rid}/abandoned.jpg'
    assert orphaned(item(stray), keep, now)
    assert not orphaned(item(stray, now.isoformat()), keep, now), 'recent uploads may still be in flight'
    assert not orphaned({**item(stray), 'generation': ''}, keep, now)
    assert not orphaned(item('public/site/logo.jpg'), keep, now), 'unknown names are never touched'
    removed = {**incident, 'removedPhotos': {'arrayValue': {'values': [{'integerValue': '0'}]}}}
    assert orphaned(item(derivative), referenced(rid, report, removed, []), now)
    withdrawn = {**report, 'mediaCleanup': {'arrayValue': {'values': [{'stringValue': original}]}}}
    assert orphaned(item(original), referenced(rid, withdrawn, incident, []), now)
    assert orphaned(item(derivative), referenced(rid, report, {**incident, 'withdrawnAt': {'stringValue': 'x'}}, []), now)
    batch = f'public/incidents/{rid}/field-checks/{cid}/{lease}/0.jpg'
    adopted = {**check, 'reviewMediaBatchId': {'stringValue': lease}, 'photoCount': {'integerValue': '1'}}
    assert not orphaned(item(batch), referenced(rid, report, incident, [(cid, adopted)]), now)
    assert orphaned(item(batch), keep, now), 'a batch the visit never adopted is an orphan'
    print('PASS: referenced, recent, unknown and generation-less objects are kept; strays, removed and queued deletions are found')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--account', help='Your existing gcloud administrator login')
    parser.add_argument('--apply', action='store_true', help='Delete what the dry run finds')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.account:
        parser.error('--account is required')
    token = subprocess.check_output([GCLOUD, 'auth', 'print-access-token', '--account=' + args.account, '--quiet'], text=True).strip()
    headers = {'Authorization': 'Bearer ' + token, 'X-Goog-User-Project': PROJECT, 'Content-Type': 'application/json'}

    def request(url, data=None, method=None, allow_missing=False):
        body = json.dumps(data).encode() if data is not None else None
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, method=method, headers=headers), timeout=60) as response:
                return json.loads(response.read() or b'{}')
        except urllib.error.HTTPError as error:
            if allow_missing and error.code in (404, 412):
                return None
            raise

    def documents(collection, fields):
        mask = '&'.join('mask.fieldPaths=' + field for field in fields)
        page = ''
        while True:
            result = request(f'{DOCS}/{collection}?pageSize=300&{mask}' + ('&pageToken=' + urllib.parse.quote(page, safe='') if page else ''))
            for document in result.get('documents', []):
                yield document['name'].rsplit('/', 1)[-1], document.get('fields', {})
            page = result.get('nextPageToken', '')
            if not page:
                return

    report_fields = ['rawMediaPaths', 'resolutionEvidence', 'mediaCleanup']
    incident_fields = ['photoCount', 'storedPhotoCount', 'removedPhotos', 'withdrawnAt', 'moderationHold',
                       'resolutionMediaBatchId', 'resolution']
    check_fields = ['reportId', 'rawMediaPaths', 'reviewMediaBatchId', 'photoCount']

    def records(report_id):
        report = request(f'{DOCS}/reports/{report_id}', allow_missing=True)
        incident = request(f'{DOCS}/incidents/{report_id}', allow_missing=True)
        found = request(f'{DOCS}:runQuery', {'structuredQuery': {
            'from': [{'collectionId': 'fieldChecks'}],
            'where': {'fieldFilter': {'field': {'fieldPath': 'reportId'}, 'op': 'EQUAL', 'value': {'stringValue': report_id}}}}}, 'POST')
        checks = [(item['document']['name'].rsplit('/', 1)[-1], item['document'].get('fields', {}))
                  for item in found if 'document' in item]
        return referenced(report_id, (report or {}).get('fields'), (incident or {}).get('fields'), checks)

    reports = dict(documents('reports', report_fields))
    incidents = dict(documents('incidents', incident_fields))
    checks_by_report = collections.defaultdict(list)
    for check_id, check in documents('fieldChecks', check_fields):
        checks_by_report[text(check.get('reportId'))].append((check_id, check))
    now = dt.datetime.now(dt.timezone.utc)
    totals = collections.Counter()
    candidates = collections.defaultdict(list)
    page = ''
    while True:
        query = {'fields': 'items(name,generation,timeCreated,size),nextPageToken', 'maxResults': 1000,
                 **({'pageToken': page} if page else {})}
        listing = request(OBJECTS + '?' + urllib.parse.urlencode(query))
        for item in listing.get('items', []):
            kind, report_id = classify(item['name'])
            totals[kind or 'other (never touched)'] += 1
            if kind is None:
                continue
            keep = referenced(report_id, reports.get(report_id), incidents.get(report_id), checks_by_report.get(report_id, []))
            if orphaned(item, keep, now):
                candidates[report_id].append((kind, item))
        page = listing.get('nextPageToken', '')
        if not page:
            break

    found = collections.Counter(kind for items in candidates.values() for kind, _ in items)
    size = sum(int(item.get('size', 0)) for items in candidates.values() for _, item in items)
    removed = kept = 0
    if args.apply:
        for report_id, items in candidates.items():
            keep = records(report_id)  # fresh read just before deleting
            for _, item in items:
                if item['name'] in keep:
                    kept += 1
                    continue
                url = f'{OBJECTS}/{urllib.parse.quote(item["name"], safe="")}?ifGenerationMatch={item["generation"]}'
                if request(url, method='DELETE', allow_missing=True) is None:
                    kept += 1  # already gone, or rewritten since the listing
                else:
                    removed += 1
    print(json.dumps({
        'mode': 'apply' if args.apply else 'dry-run',
        'objectsByKind': dict(totals),
        'unreferencedOlderThan7Days': dict(found),
        'unreferencedBytes': size,
        'objectsRemoved': removed,
        'keptOnRecheck': kept,
    }, indent=2))


if __name__ == '__main__':
    main()
