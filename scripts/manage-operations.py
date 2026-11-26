"""Switch paid automatic review (OpenAI Decisions) on or off in the live project.

While it is off, new reports wait privately in the operators' Held queue, and new resolution and
visit photos stay private. Nothing is lost: an operator can still publish any held report.
Reports that waited while review was off are not reviewed automatically afterwards.

Uses an existing gcloud login that administers the Firebase project. Prints no tokens.

  python scripts/manage-operations.py review status --account ADMIN_LOGIN
  python scripts/manage-operations.py review off --account ADMIN_LOGIN --note "Keep costs down"
  python scripts/manage-operations.py review on --account ADMIN_LOGIN --note "Pilot launch"
"""
import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = 'civic263-df6ec'
GCLOUD = r'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
SWITCH = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/operations/automaticReview'

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('control', choices=['review'])
parser.add_argument('state', choices=['status', 'on', 'off'])
parser.add_argument('--account', required=True, help='Your existing gcloud administrator login')
parser.add_argument('--note', default='', help='Why it changed (kept with the setting)')
args = parser.parse_args()

oauth = subprocess.check_output([GCLOUD, 'auth', 'print-access-token', '--account=' + args.account, '--quiet'], text=True).strip()
admin = {'Authorization': 'Bearer ' + oauth, 'X-Goog-User-Project': PROJECT, 'Content-Type': 'application/json'}


def request(url, data=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, method=method, headers=admin), timeout=60) as response:
            return json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        if error.code == 404 and method is None:
            return {}
        message = json.loads(error.read() or b'{}').get('error', {}).get('message', 'unknown error')
        raise SystemExit(f'Request failed ({error.code}): {message}') from None


def describe(fields):
    enabled = fields.get('enabled', {}).get('booleanValue') is True
    changed = fields.get('changedAt', {}).get('stringValue', 'never set')
    note = fields.get('note', {}).get('stringValue', '')
    return f"Automatic review is {'ON' if enabled else 'OFF'} (changed {changed}){': ' + note if note else ''}"


if args.state == 'status':
    print(describe(request(SWITCH).get('fields', {})))
else:
    fields = {
        'enabled': {'booleanValue': args.state == 'on'},
        'changedAt': {'stringValue': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())},
        'note': {'stringValue': args.note.strip()[:200]},
    }
    mask = '&'.join('updateMask.fieldPaths=' + name for name in fields)
    print(describe(request(f'{SWITCH}?{mask}', {'fields': fields}, 'PATCH').get('fields', {})))
