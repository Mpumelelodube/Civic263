"""Plan or apply Civic263's operational safety settings in the live project (P03).

Without --apply this only reads the project and prints what it would change. With --apply it
creates or updates, and is safe to rerun:

- a $5 monthly budget that counts this project only, emailing billing administrators at 50%,
  90% and 100% of actual spend and when the month's forecast passes 100%;
- an email alert channel, an uptime check of the public site and API every 15 minutes, a count
  of backend errors, and an alert for each;
- Firestore point-in-time recovery (7 days), delete protection and a daily backup kept 7 days;
- a cleanup rule for deployed function images, which otherwise accumulate with every deploy.

Uses an existing gcloud login that administers the project and its billing account. Prints no
tokens.

  python scripts/setup-operations.py --account ADMIN_LOGIN
  python scripts/setup-operations.py --account ADMIN_LOGIN --alert-email ADDRESS --apply
"""
import argparse
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = 'civic263-df6ec'
BILLING_ACCOUNT = '01E2B9-AAB814-BB40D9'
BUDGET_USD = 5
BUDGET_NAME = 'Civic263 monthly budget'
CHANNEL_NAME = 'Civic263 administrator email'
UPTIME_NAME = 'Civic263 public site and API'
UPTIME_HOST = 'civic263-df6ec.web.app'
ERROR_METRIC = 'civic263_backend_errors'
ERROR_THRESHOLD = 5  # errors in one hour; review retries log a few on their own
GCLOUD = r'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
MONITORING = f'https://monitoring.googleapis.com/v3/projects/{PROJECT}'
FIRESTORE = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)'

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--account', required=True, help='Your existing gcloud administrator login')
parser.add_argument('--alert-email', help='Where monitoring alerts go (defaults to --account)')
parser.add_argument('--apply', action='store_true', help='Make the changes; otherwise only plan')
args = parser.parse_args()
alert_email = (args.alert_email or args.account).strip()

token = subprocess.check_output([GCLOUD, 'auth', 'print-access-token', '--account=' + args.account, '--quiet'], text=True).strip()
headers = {'Authorization': 'Bearer ' + token, 'X-Goog-User-Project': PROJECT, 'Content-Type': 'application/json'}
changes = []


def request(url, data=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, method=method, headers=headers), timeout=60) as response:
            return json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        message = json.loads(error.read() or b'{}').get('error', {}).get('message', 'unknown error')
        raise SystemExit(f'{method or "GET"} {url.split("?")[0]} failed ({error.code}): {message}') from None


def step(description, action):
    changes.append(description)
    if args.apply:
        action()
        print('DONE   ' + description)
    else:
        print('PLAN   ' + description)


def wait(operation, base):
    while not operation.get('done'):
        time.sleep(3)
        operation = request(f'{base}/{operation["name"]}')
    if 'error' in operation:
        raise SystemExit('Operation failed: ' + operation['error'].get('message', 'unknown error'))


# ----- Budget (the API must be enabled on this project, which pays for the budget API calls)
service = f'https://serviceusage.googleapis.com/v1/projects/{PROJECT}/services/billingbudgets.googleapis.com'
if request(service).get('state') != 'ENABLED':
    step('enable the Cloud Billing Budget API on civic263-df6ec (no charge)',
         lambda: wait(request(service + ':enable', {}, 'POST'), 'https://serviceusage.googleapis.com/v1'))
    budgets = []
else:
    budgets = request(f'https://billingbudgets.googleapis.com/v1/billingAccounts/{BILLING_ACCOUNT}/budgets').get('budgets', [])
number = request(f'https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}')['projectNumber']
budget = {
    'displayName': BUDGET_NAME,
    # Only this project: the billing account also pays for unrelated projects.
    'budgetFilter': {'projects': [f'projects/{number}'], 'calendarPeriod': 'MONTH', 'creditTypesTreatment': 'INCLUDE_ALL_CREDITS'},
    'amount': {'specifiedAmount': {'currencyCode': 'USD', 'units': str(BUDGET_USD)}},
    'thresholdRules': [
        {'thresholdPercent': 0.5, 'spendBasis': 'CURRENT_SPEND'},
        {'thresholdPercent': 0.9, 'spendBasis': 'CURRENT_SPEND'},
        {'thresholdPercent': 1.0, 'spendBasis': 'CURRENT_SPEND'},
        {'thresholdPercent': 1.0, 'spendBasis': 'FORECASTED_SPEND'},
    ],
}
existing = next((item for item in budgets if item.get('displayName') == BUDGET_NAME), None)
if existing is None:
    step(f'create the ${BUDGET_USD}/month budget for civic263-df6ec only (alerts at 50%, 90%, 100% and forecast 100%)',
         lambda: request(f'https://billingbudgets.googleapis.com/v1/billingAccounts/{BILLING_ACCOUNT}/budgets', budget, 'POST'))
elif existing.get('amount', {}).get('specifiedAmount', {}).get('units') != str(BUDGET_USD) or len(existing.get('thresholdRules', [])) != 4:
    mask = 'updateMask=amount,thresholdRules,budgetFilter'
    step(f'update the budget to ${BUDGET_USD}/month with four alert thresholds',
         lambda: request(f'https://billingbudgets.googleapis.com/v1/{existing["name"]}?{mask}', budget, 'PATCH'))
else:
    print(f'OK     ${BUDGET_USD}/month budget for civic263-df6ec')

# ----- Alert channel
channels = request(MONITORING + '/notificationChannels').get('notificationChannels', [])
channel = next((item for item in channels if item.get('displayName') == CHANNEL_NAME), None)
if channel is None:
    def create_channel():
        global channel
        channel = request(MONITORING + '/notificationChannels', {
            'type': 'email', 'displayName': CHANNEL_NAME, 'labels': {'email_address': alert_email}}, 'POST')
    step('create the email alert channel for the administrator', create_channel)
else:
    print('OK     email alert channel')

# ----- Uptime check of the public site and API (Hosting -> health function)
checks = request(MONITORING + '/uptimeCheckConfigs').get('uptimeCheckConfigs', [])
uptime = next((item for item in checks if item.get('displayName') == UPTIME_NAME), None)
if uptime is None:
    def create_uptime():
        global uptime
        uptime = request(MONITORING + '/uptimeCheckConfigs', {
            'displayName': UPTIME_NAME,
            'monitoredResource': {'type': 'uptime_url', 'labels': {'project_id': PROJECT, 'host': UPTIME_HOST}},
            'httpCheck': {'path': '/api/health', 'port': 443, 'useSsl': True, 'validateSsl': True, 'requestMethod': 'GET'},
            'contentMatchers': [{'content': 'Civic263', 'matcher': 'CONTAINS_STRING'}],
            'period': '900s', 'timeout': '10s',
            'selectedRegions': ['EUROPE', 'USA', 'ASIA_PACIFIC'],
        }, 'POST')
    step(f'create an uptime check of https://{UPTIME_HOST}/api/health every 15 minutes from 3 regions', create_uptime)
else:
    print('OK     uptime check')

# ----- Backend error count (log-based metric)
metric_url = f'https://logging.googleapis.com/v2/projects/{PROJECT}/metrics/{ERROR_METRIC}'
try:
    with urllib.request.urlopen(urllib.request.Request(metric_url, headers=headers), timeout=60):
        print('OK     backend error metric')
except urllib.error.HTTPError as error:
    if error.code != 404:
        raise
    step('count ERROR logs from the Cloud Functions services as a log-based metric', lambda: request(
        f'https://logging.googleapis.com/v2/projects/{PROJECT}/metrics', {
            'name': ERROR_METRIC,
            'description': 'Civic263 backend errors (Cloud Functions on Cloud Run, severity ERROR or worse).',
            'filter': 'resource.type="cloud_run_revision" AND severity>=ERROR',
            'metricDescriptor': {'metricKind': 'DELTA', 'valueType': 'INT64', 'unit': '1'},
        }, 'POST'))

# ----- Alert policies (about $0.10 per condition per month)
policies = request(MONITORING + '/alertPolicies').get('alertPolicies', [])
names = {item.get('displayName') for item in policies}


def policy(display, condition, documentation):
    if display in names:
        print('OK     alert: ' + display)
        return
    step('create alert: ' + display, lambda: request(MONITORING + '/alertPolicies', {
        'displayName': display,
        'combiner': 'OR',
        'conditions': [condition(display)],
        'notificationChannels': [channel['name']] if channel else [],
        'alertStrategy': {'autoClose': '86400s'},
        'documentation': {'content': documentation, 'mimeType': 'text/markdown'},
    }, 'POST'))


policy('Civic263 site or API is down', lambda display: {
    'displayName': display,
    'conditionThreshold': {
        'filter': ('metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND resource.type="uptime_url" '
                   f'AND metric.label.check_id="{(uptime or {}).get("name", "").rsplit("/", 1)[-1]}"'),
        'aggregations': [{'alignmentPeriod': '1200s', 'perSeriesAligner': 'ALIGN_NEXT_OLDER',
                          'crossSeriesReducer': 'REDUCE_COUNT_FALSE', 'groupByFields': ['resource.label.*']}],
        'comparison': 'COMPARISON_GT', 'thresholdValue': 1, 'duration': '0s', 'trigger': {'count': 1},
    },
}, 'The public health endpoint failed from more than one region. See docs/OPERATIONS_RUNBOOK.md, "Site or API down".')
policy('Civic263 backend errors', lambda display: {
    'displayName': display,
    'conditionThreshold': {
        'filter': f'metric.type="logging.googleapis.com/user/{ERROR_METRIC}" AND resource.type="cloud_run_revision"',
        'aggregations': [{'alignmentPeriod': '3600s', 'perSeriesAligner': 'ALIGN_SUM', 'crossSeriesReducer': 'REDUCE_SUM'}],
        'comparison': 'COMPARISON_GT', 'thresholdValue': ERROR_THRESHOLD - 1, 'duration': '0s', 'trigger': {'count': 1},
    },
}, f'At least {ERROR_THRESHOLD} backend errors in an hour. See docs/OPERATIONS_RUNBOOK.md, "Backend errors".')

# ----- Firestore recovery
database = request(FIRESTORE)
updates = {}
if database.get('pointInTimeRecoveryEnablement') != 'POINT_IN_TIME_RECOVERY_ENABLED':
    updates['pointInTimeRecoveryEnablement'] = 'POINT_IN_TIME_RECOVERY_ENABLED'
if database.get('deleteProtectionState') != 'DELETE_PROTECTION_ENABLED':
    updates['deleteProtectionState'] = 'DELETE_PROTECTION_ENABLED'
if updates:
    mask = '&'.join('updateMask=' + key for key in updates)
    step('turn on Firestore ' + ' and '.join(
        {'pointInTimeRecoveryEnablement': 'point-in-time recovery (7 days)', 'deleteProtectionState': 'delete protection'}[key]
        for key in updates), lambda: wait(request(f'{FIRESTORE}?{mask}', updates, 'PATCH'), 'https://firestore.googleapis.com/v1'))
else:
    print('OK     Firestore point-in-time recovery and delete protection')
schedules = request(FIRESTORE + '/backupSchedules').get('backupSchedules', [])
if not any('dailyRecurrence' in item and item.get('retention') == '604800s' for item in schedules):
    step('schedule a daily Firestore backup kept for 7 days',
         lambda: request(FIRESTORE + '/backupSchedules', {'dailyRecurrence': {}, 'retention': '604800s'}, 'POST'))
else:
    print('OK     daily Firestore backup kept 7 days')

# ----- Function images: every deploy adds images; keep storage inside the free allowance.
repository = f'https://artifactregistry.googleapis.com/v1/projects/{PROJECT}/locations/europe-west1/repositories/gcf-artifacts'
policies_wanted = {
    'delete-older-than-7-days': {'id': 'delete-older-than-7-days', 'action': 'DELETE', 'condition': {'olderThan': '604800s'}},
    # KEEP wins over DELETE, so the images behind current and previous deployments stay.
    'keep-two-latest': {'id': 'keep-two-latest', 'action': 'KEEP', 'mostRecentVersions': {'keepCount': 2}},
}
current = request(repository)
if set(current.get('cleanupPolicies', {})) != set(policies_wanted) or current.get('cleanupPolicyDryRun'):
    step(f'delete function images older than 7 days, keeping the 2 latest of each (now {int(current.get("sizeBytes", 0)) // 2**20} MB)',
         lambda: request(repository + '?updateMask=cleanupPolicies,cleanupPolicyDryRun',
                         {'cleanupPolicies': policies_wanted, 'cleanupPolicyDryRun': False}, 'PATCH'))
else:
    print('OK     function image cleanup policy')

if not changes:
    print('Everything is already in place.')
elif not args.apply:
    print(f'{len(changes)} change(s) planned. Rerun with --apply to make them.')
