"""Restore exercise: copy the live Firestore database into a temporary drill database, check it,
then delete the copy.

The drill database is restored from point-in-time recovery (a few minutes ago) or from the
latest daily backup. The check compares document counts with the live database and confirms
the restored records are consistent with each other and with the photos in Storage (photos
are not part of Firestore backups; Storage keeps deleted files for 7 days instead).

The copy holds residents' private data, so it is deleted at the end unless --keep is given.
Uses an existing gcloud login that administers the project. Prints counts only, never content.

  python scripts/restore-drill.py --account ADMIN_LOGIN              # from point-in-time recovery
  python scripts/restore-drill.py --account ADMIN_LOGIN --from-backup
"""
import argparse
import datetime as dt
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = 'civic263-df6ec'
LOCATION = 'europe-west1'
BUCKET = PROJECT + '.firebasestorage.app'
GCLOUD = r'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
ADMIN = f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
COLLECTIONS = ['reports', 'incidents', 'publicIncidents', 'fieldChecks', 'publicFieldChecks', 'reportEvents',
               'reviewAudit', 'appeals', 'contentFlags', 'contentReports', 'moderationAudit', 'staffMembers',
               'residentCommunity', 'residentNotifications', 'residentBlocks', 'accountDeletions']

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--account', required=True, help='Your existing gcloud administrator login')
parser.add_argument('--from-backup', action='store_true', help='Restore the latest daily backup instead')
parser.add_argument('--keep', action='store_true', help='Keep the drill database (delete it yourself)')
parser.add_argument('--resume', metavar='DRILL_ID', help='Check and delete an existing drill-... database instead')
args = parser.parse_args()
if args.resume and not args.resume.startswith('drill-'):
    parser.error('--resume only accepts a drill-... database')

headers = {'X-Goog-User-Project': PROJECT, 'Content-Type': 'application/json'}


def authorize():
    # gcloud hands out its cached token, which may expire part-way through a long drill.
    token = subprocess.check_output([GCLOUD, 'auth', 'print-access-token', '--account=' + args.account, '--quiet'], text=True).strip()
    headers['Authorization'] = 'Bearer ' + token


authorize()


def request(url, data=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    # A new copy keeps refusing requests for a while after its operation reports done.
    deadline = time.monotonic() + 1800
    refreshed = False
    while True:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, method=method, headers=headers), timeout=120) as response:
                return json.loads(response.read() or b'{}')
        except urllib.error.HTTPError as error:
            message = json.loads(error.read() or b'{}').get('error', {}).get('message', 'unknown error')
            if error.code == 401 and not refreshed:
                refreshed = True
                time.sleep(2)
                authorize()
                continue
            if error.code == 400 and 'in the middle of' in message and time.monotonic() < deadline:
                time.sleep(20)
                continue
            raise SystemExit(f'{method or "GET"} {url.split("?")[0]} failed ({error.code}): {message}') from None


def wait(operation):
    while not operation.get('done'):
        time.sleep(5)
        operation = request('https://firestore.googleapis.com/v1/' + operation['name'])
    if 'error' in operation:
        raise SystemExit('Restore failed: ' + operation['error'].get('message', 'unknown error'))


def count(database, collection):
    result = request(f'{ADMIN}/databases/{database}/documents:runAggregationQuery', {
        'structuredAggregationQuery': {
            'structuredQuery': {'from': [{'collectionId': collection}]},
            'aggregations': [{'alias': 'n', 'count': {}}],
        }})
    return int(result[0]['result']['aggregateFields']['n']['integerValue'])


def documents(database, collection, fields):
    mask = '&'.join('mask.fieldPaths=' + field for field in fields)
    page = ''
    while True:
        result = request(f'{ADMIN}/databases/{database}/documents/{collection}?pageSize=300&{mask}'
                         + ('&pageToken=' + urllib.parse.quote(page, safe='') if page else ''))
        for document in result.get('documents', []):
            yield document['name'].rsplit('/', 1)[-1], document.get('fields', {})
        page = result.get('nextPageToken', '')
        if not page:
            return


def stored_objects():
    names, page = set(), ''
    while True:
        query = {'prefix': '', 'fields': 'items(name),nextPageToken', 'maxResults': 1000, **({'pageToken': page} if page else {})}
        result = request(f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o?' + urllib.parse.urlencode(query))
        names.update(item['name'] for item in result.get('items', []))
        page = result.get('nextPageToken', '')
        if not page:
            return names


def strings(value):
    return [item.get('stringValue', '') for item in value.get('arrayValue', {}).get('values', [])]


def integer(value, default=0):
    return int(value.get('integerValue', default)) if value else default


started = dt.datetime.now(dt.timezone.utc)
drill = args.resume or 'drill-' + started.strftime('%Y%m%d-%H%M')
assert drill.startswith('drill-') and drill != '(default)'
if args.resume:
    snapshot = 'unknown (resumed)'
    print(f'Checking the existing {drill}...')
elif args.from_backup:
    backups = [item for item in request(f'{ADMIN}/locations/{LOCATION}/backups').get('backups', [])
               if item.get('database', '').endswith('/databases/(default)') and item.get('state') == 'READY']
    if not backups:
        raise SystemExit('No ready backup of the live database yet. The first daily backup runs within 24 hours of scheduling.')
    source = max(backups, key=lambda item: item['snapshotTime'])
    print(f'Restoring the backup taken at {source["snapshotTime"]} into {drill}...')
    wait(request(f'{ADMIN}/databases:restore', {'databaseId': drill, 'backup': source['name']}, 'POST'))
    snapshot = source['snapshotTime']
else:
    # A whole minute, a couple of minutes back, is always inside the recovery window once enabled.
    snapshot = (started - dt.timedelta(minutes=2)).replace(second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')
    print(f'Cloning the live database as it was at {snapshot} into {drill}...')
    wait(request(f'{ADMIN}/databases:clone', {
        'databaseId': drill,
        'pitrSnapshot': {'database': f'projects/{PROJECT}/databases/(default)', 'snapshotTime': snapshot}}, 'POST'))

problems = []
try:
    print(f'Restored in {int((dt.datetime.now(dt.timezone.utc) - started).total_seconds())} s. Document counts (drill / live now):')
    for collection in COLLECTIONS:
        restored, live = count(drill, collection), count('(default)', collection)
        print(f'  {collection:24} {restored:6} / {live:6}')
        # Live data keeps changing after the snapshot; a restore with more than live is suspect,
        # and one missing most of a collection is a failure.
        if live and restored < live * 0.9 and live - restored > 2:
            problems.append(f'{collection}: the drill has {restored} documents, live has {live}')

    objects = stored_objects()
    reports = dict(documents(drill, 'reports', ['rawMediaPaths', 'moderationStatus', 'publicationStatus']))
    incidents = dict(documents(drill, 'incidents', ['publicationStatus', 'photoCount', 'storedPhotoCount', 'removedPhotos', 'withdrawnAt']))
    missing_originals = sum(
        1 for fields in reports.values() for path in strings(fields.get('rawMediaPaths', {})) if path not in objects)
    published = list(documents(drill, 'publicIncidents', ['photoCount']))
    orphan_public = sum(1 for report_id, _ in published
                        if incidents.get(report_id, {}).get('publicationStatus', {}).get('stringValue') != 'published'
                        or report_id not in reports)
    missing_derivatives = 0
    for report_id, _ in published:
        incident = incidents.get(report_id, {})
        stored = max(integer(incident.get('storedPhotoCount')), integer(incident.get('photoCount')))
        removed = {int(item.get('integerValue', -1)) for item in incident.get('removedPhotos', {}).get('arrayValue', {}).get('values', [])}
        missing_derivatives += sum(1 for index in range(stored)
                                   if index not in removed and f'public/incidents/{report_id}/{index}.jpg' not in objects)
    print(f'  private originals named by restored reports but missing in Storage: {missing_originals}')
    print(f'  public records without a matching restored report and incident:    {orphan_public}')
    print(f'  public photos named by restored incidents but missing in Storage:  {missing_derivatives}')
    if orphan_public:
        problems.append(f'{orphan_public} public record(s) lack their report or incident')
    if missing_derivatives:
        problems.append(f'{missing_derivatives} published photo(s) are missing from Storage')
    # Originals erased since the snapshot are expected to be missing; they are reported, not failed.
except (SystemExit, Exception) as error:
    # Report why the check stopped before cleanup, so a cleanup error cannot hide it.
    problems.append(f'the check stopped: {error}')
    print('CHECK STOPPED: ' + str(error))
finally:
    if args.keep:
        print(f'Kept {drill}. It holds private data: delete it when done with '
              f'gcloud firestore databases delete --database={drill} --project={PROJECT}')
    else:
        # A copy inherits the live database's delete protection; lift it on the drill copy only.
        assert drill.startswith('drill-')
        if request(f'{ADMIN}/databases/{drill}').get('deleteProtectionState') == 'DELETE_PROTECTION_ENABLED':
            wait(request(f'{ADMIN}/databases/{drill}?updateMask=deleteProtectionState',
                         {'deleteProtectionState': 'DELETE_PROTECTION_DISABLED'}, 'PATCH'))
        wait(request(f'{ADMIN}/databases/{drill}', method='DELETE'))
        print(f'Deleted {drill}.')

if problems:
    print('DRILL FAILED: ' + '; '.join(problems))
    sys.exit(1)
print(f'DRILL PASSED: snapshot {snapshot}, restored and checked in '
      f'{int((dt.datetime.now(dt.timezone.utc) - started).total_seconds())} s.')
