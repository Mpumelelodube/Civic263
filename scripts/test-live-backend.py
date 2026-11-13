"""Opt-in live validation. All auth tokens remain in memory; fixtures cannot publish."""
import argparse
import base64
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--account', required=True, help='An existing gcloud Firebase administrator login')
parser.add_argument('--allow-blocked-history', action='store_true', help='Continue other checks while the history invoker permission awaits approval; never reports history as passed.')
args = parser.parse_args()
project = 'civic263-df6ec'
base = f'https://europe-west1-{project}.cloudfunctions.net'
config = dict(line.split('=', 1) for line in Path('apps/mobile/.env.local').read_text(encoding='utf-8').splitlines() if '=' in line and not line.startswith('#'))
assert config['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] == project
key = config['EXPO_PUBLIC_FIREBASE_API_KEY'].strip().strip('"')

def request(url, data=None, headers=None, expected=200, form=False, method=None):
    body = (urllib.parse.urlencode(data) if form else json.dumps(data)).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json', **(headers or {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=65) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    assert status == expected, f'Unexpected HTTP status {status}, expected {expected}; response body withheld.'
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw

health = request(base + '/health')
assert health.get('testIdentityIsolation') is True, 'Deploy test isolation before running live fixtures.'
app_check = request('https://firebaseappcheck.googleapis.com/v1/projects/792490461250/apps/' + config['EXPO_PUBLIC_FIREBASE_APP_ID'] + ':exchangeDebugToken?key=' + key,
                    {'debugToken': config['EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN']})['token']
print('PASS: registered test build attestation', flush=True)
owner = request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + key, {'returnSecureToken': True})
gcloud = r'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
oauth = subprocess.check_output([gcloud, 'auth', 'print-access-token', '--account=' + args.account, '--quiet'], text=True).strip()
request(f'https://identitytoolkit.googleapis.com/v1/projects/{project}/accounts:update', {
    'localId': owner['localId'], 'displayName': 'Civic263 isolated backend test', 'customAttributes': json.dumps({'civic263Test': True}),
}, {'Authorization': 'Bearer ' + oauth, 'X-Goog-User-Project': project})
oauth = None
owner_token = request('https://securetoken.googleapis.com/v1/token?key=' + key,
                      {'grant_type': 'refresh_token', 'refresh_token': owner['refreshToken']}, form=True)['id_token']
claims = json.loads(base64.urlsafe_b64decode(owner_token.split('.')[1] + '==='))
assert claims.get('civic263Test') is True
print('PASS: server-controlled test identity; publication blocked', flush=True)

def call(name, data, token=owner_token, attested=True, expected=200):
    headers = {'Authorization': 'Bearer ' + token} if token else {}
    if attested:
        headers['X-Firebase-AppCheck'] = app_check
    result = request(base + '/' + name, {'data': data}, headers, expected)
    return result.get('result', result.get('data', result))

fixture_source = """
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('./functions/package.json', import.meta.url))('sharp');
import { randomUUID } from 'node:crypto';
const photos=[];
for (const background of ['red','green','blue']) {
 const bytes=await sharp({create:{width:80,height:60,channels:3,background}})
  .withMetadata({exif:{IFD0:{Artist:'PRIVATE TEST METADATA'}}}).jpeg().toBuffer();
 photos.push({id:randomUUID(),width:80,height:60,base64:bytes.toString('base64')});
}
process.stdout.write(JSON.stringify(photos));
"""
photos = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', fixture_source], text=True))
payload = {
    'submissionId': str(uuid.uuid4()), 'categoryId': 'other',
    'description': 'BACKEND VALIDATION ONLY. Synthetic test patterns, no real service issue.',
    'landmark': 'Private backend test, not a real location', 'photos': photos,
    'location': {'latitude': -17.8, 'longitude': 31, 'source': 'map'},
}
call('submitReport', payload, token=None, expected=401)
call('submitReport', payload, attested=False, expected=401)
overflow = call('submitReport', {**payload, 'photos': photos + [{**photos[0], 'id': str(uuid.uuid4())}]}, expected=400)
assert 'at most 3' in overflow['error']['message']
print('PASS: sign-in, App Check and maximum-three-photo boundary', flush=True)
receipt = call('submitReport', payload)
assert receipt['testOnly'] is True and receipt['photoCount'] == 3
report_id = receipt['reportId']
assert call('submitReport', payload)['reportId'] == report_id
call('submitReport', {**payload, 'description': 'Changed retry payload must be refused.'}, expected=409)
print('PASS: three live private uploads and idempotent receipt', flush=True)
empty_receipt = call('submitReport', {**payload, 'submissionId': str(uuid.uuid4()), 'photos': []})
assert empty_receipt['testOnly'] is True and empty_receipt['photoCount'] == 0
assert call('getMyReport', {'reportId': empty_receipt['reportId']})['photos'] == []
print('PASS: report submission and retrieval without photos', flush=True)
if not args.allow_blocked_history:
    listed = call('getMyReports', {})
    report = next(item for item in listed['reports'] if item['id'] == report_id)
    assert report['testOnly'] is True
    assert not {'ownerUid', 'rawMediaPaths', 'reviewLease', 'internalNotes'} & report.keys()
else:
    print('PENDING: owner history invocation permission; not counted as a passed check', flush=True)
detail = call('getMyReport', {'reportId': report_id})
assert len(detail['photos']) == 3
for photo in detail['photos']:
    image = base64.b64decode(photo['base64'])
    assert image.startswith(b'\xff\xd8\xff') and b'PRIVATE TEST METADATA' not in image
print('PASS: owner details and sanitized original photo retrieval', flush=True)
other = request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + key, {'returnSecureToken': True})
call('getMyReport', {'reportId': report_id}, token=other['idToken'], expected=404)
document = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/reports/{report_id}'
request(document, headers={'Authorization': 'Bearer ' + other['idToken']}, expected=403)
request(document, {'fields': {'description': {'stringValue': 'Forbidden direct write'}}},
        {'Authorization': 'Bearer ' + owner_token}, expected=403, method='PATCH')
private_path = f"private/reports/{owner['localId']}/{report_id}/{photos[0]['id']}.jpg"
request(f'https://firebasestorage.googleapis.com/v0/b/{project}.firebasestorage.app/o/' + urllib.parse.quote(private_path, safe='') + '?alt=media',
        headers={'Authorization': 'Firebase ' + owner_token}, expected=403)
request(base + '/publicApi/incidents/' + report_id, expected=404)
print('PASS: cross-owner, direct-write, raw-media and public-record isolation', flush=True)
for attempt in range(12):
    report = call('getMyReport', {'reportId': report_id}) if args.allow_blocked_history else next(item for item in call('getMyReports', {})['reports'] if item['id'] == report_id)
    if report['reviewStatus'] == 'held':
        break
    time.sleep(5)
assert report['reviewStatus'] == 'held' and report['publicationStatus'] == 'hidden', 'Review trigger did not finish the test-isolation check.'
public = request(base + '/publicApi/incidents')
assert all(item['id'] != report_id for item in public['incidents'])
print('PASS: automatic worker kept synthetic test report private', flush=True)
# Synthetic coordinates belong only to the server-claimed private test identity; not a physical GPS test.
fix = {'latitude': -17.8, 'longitude': 31, 'accuracyMeters': 5, 'timestamp': int(time.time() * 1000), 'mocked': False}
resolution_command = {'action': 'resolve', 'reportId': report_id, 'attemptId': str(uuid.uuid4()), 'location': fix,
                      'photos': [{**photos[0], 'captureSource': 'camera', 'capturedAt': fix['timestamp'], 'location': fix}]}
call('submitReport', resolution_command, token=None, expected=401)
call('submitReport', resolution_command, attested=False, expected=401)
call('submitReport', resolution_command, token=other['idToken'], expected=404)
# Unpublished content is never exposed to community reviewers, including its owner.
call('submitReport', resolution_command, expected=404)
call('submitReport', {**resolution_command, 'action': 'report-fix'}, expected=404)
call('submitReport', {'action': 'community-context', 'reportId': report_id}, expected=404)
profile = call('submitReport', {'action': 'community-profile'})
assert profile['preferences'] == {'reviewer': False, 'nearbyAlerts': False, 'backgroundAlerts': False, 'pushUpdates': False}
preferences = {**profile['preferences'], 'reviewer': True}
assert call('submitReport', {'action': 'community-preferences', 'preferences': preferences})['preferences']['reviewer'] is True
assert call('submitReport', {'action': 'community-inbox'})['items'] == []
assert call('submitReport', {'action': 'community-visits'})['items'] == []
call('submitReport', {'action': 'community-preferences', 'preferences': profile['preferences']})
unchanged = call('getMyReport', {'reportId': report_id})
assert unchanged['workflowStatus'] == 'received' and len(unchanged['photos']) == 3
request(base + '/publicApi/incidents/' + report_id, expected=404)
print('PASS: community preferences/inbox and private-report isolation; no private report can enter public community review', flush=True)
Path('.local').mkdir(exist_ok=True)
Path('.local/live-backend-test-result.json').write_text(json.dumps({
    'reportId': report_id, 'reference': receipt['reference'], 'testOnly': True,
    'photoCount': 3, 'reviewStatus': report['reviewStatus'], 'historyVerified': not args.allow_blocked_history, 'passedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
}, indent=2), encoding='utf-8')
print(('Available live checks passed; owner history remains pending approval.' if args.allow_blocked_history else 'All live backend checks passed.') + ' Only a non-secret test receipt was saved; no authentication tokens were written.', flush=True)
