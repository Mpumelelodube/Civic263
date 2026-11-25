"""Add, remove or list Civic263 operators (moderators) in the live project.

Uses an existing gcloud login that administers the Firebase project. Prints no tokens or passwords.

  python scripts/manage-staff.py add --email operator@example.org --account ADMIN_LOGIN
  python scripts/manage-staff.py remove --email operator@example.org --account ADMIN_LOGIN
  python scripts/manage-staff.py list --account ADMIN_LOGIN
"""
import argparse
import json
import secrets
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = 'civic263-df6ec'
GCLOUD = r'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
IDENTITY = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}'
FIRESTORE = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('command', choices=['add', 'remove', 'list'])
parser.add_argument('--email', help='The operator account email')
parser.add_argument('--account', required=True, help='Your existing gcloud administrator login')
args = parser.parse_args()
if args.command != 'list' and not args.email:
    parser.error('--email is required for add and remove')

oauth = subprocess.check_output([GCLOUD, 'auth', 'print-access-token', '--account=' + args.account, '--quiet'], text=True).strip()
admin = {'Authorization': 'Bearer ' + oauth, 'X-Goog-User-Project': PROJECT}


def request(url, data=None, headers=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        message = json.loads(error.read() or b'{}').get('error', {}).get('message', 'unknown error')
        raise SystemExit(f'Request failed ({error.code}): {message}') from None


def lookup(email):
    users = request(IDENTITY + '/accounts:lookup', {'email': [email]}, admin).get('users', [])
    return users[0] if users else None


def staff_doc(uid, fields, mask):
    query = '&'.join('updateMask.fieldPaths=' + name for name in mask)
    return request(f'{FIRESTORE}/staffMembers/{uid}?{query}', {'fields': fields}, admin, 'PATCH')


now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
if args.command == 'list':
    for doc in request(FIRESTORE + '/staffMembers?pageSize=200', headers=admin).get('documents', []):
        fields = doc['fields']
        state = 'active' if fields.get('active', {}).get('booleanValue') else 'removed'
        print(f"{fields.get('email', {}).get('stringValue', '?')}\t{fields.get('role', {}).get('stringValue', '?')}\t{state}")
elif args.command == 'add':
    email = args.email.strip().lower()
    user = lookup(email)
    if user is None:
        # A random password nobody sees; the operator sets their own through the reset email.
        user = request(IDENTITY + '/accounts', {'email': email, 'emailVerified': True, 'password': secrets.token_urlsafe(32)}, admin)
        created = True
    else:
        created = False
        if not user.get('emailVerified'):
            raise SystemExit('That account has not verified its email. Ask the person to verify it first, then rerun.')
    staff_doc(user['localId'], {
        'email': {'stringValue': email}, 'role': {'stringValue': 'moderator'},
        'active': {'booleanValue': True}, 'grantedAt': {'stringValue': now},
    }, ['email', 'role', 'active', 'grantedAt'])
    if created:
        config = dict(line.split('=', 1) for line in Path('apps/ops/.env.local').read_text(encoding='utf-8').splitlines() if '=' in line)
        request('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=' + config['VITE_FIREBASE_API_KEY'].strip(),
                {'requestType': 'PASSWORD_RESET', 'email': email})
        print(f'Created operator {email}. A password-setting email was sent.')
    else:
        print(f'{email} is now an active operator. They sign in with their existing password.')
else:
    user = lookup(args.email.strip().lower())
    if user is None:
        raise SystemExit('No account uses that email.')
    staff_doc(user['localId'], {'active': {'booleanValue': False}, 'removedAt': {'stringValue': now}}, ['active', 'removedAt'])
    # Signs the account out everywhere; the console also re-checks the record on every command.
    request(IDENTITY + '/accounts:update', {'localId': user['localId'], 'validSince': str(int(time.time()))}, admin)
    print(f'{args.email} is no longer an operator and has been signed out.')
