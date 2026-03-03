import hashlib
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import CustomUser, Organization, PlatformLog, ServiceAccount


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_org(name='Acme Corp') -> Organization:
    return Organization.objects.create(name=name)


def make_user(org, username='alice', role=CustomUser.Role.EMPLOYEE) -> CustomUser:
    user = CustomUser.objects.create_user(
        username=username,
        password='testpass123',
        organization=org,
        role=role,
    )
    return user


def make_service_account(org, source_type=ServiceAccount.SourceType.CCTV_NODE):
    account, raw_key = ServiceAccount.create_with_key(
        organization=org,
        name='Test Node',
        source_type=source_type,
    )
    return account, raw_key


# ── Test: ApiKeyAuthentication ────────────────────────────────────────────────

class TestApiKeyAuth(TestCase):
    """Unit tests for the custom DRF authentication class."""

    def setUp(self):
        self.org = make_org()
        self.account, self.raw_key = make_service_account(self.org)
        self.client = APIClient()

    def _auth_header(self, key):
        return {'HTTP_AUTHORIZATION': f'ApiKey {key}'}

    def test_valid_key_authenticates(self):
        """A correct raw key resolves to the matching ServiceAccount."""
        from .authentication import ApiKeyAuthentication
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/', HTTP_AUTHORIZATION=f'ApiKey {self.raw_key}')
        auth = ApiKeyAuthentication()
        result = auth.authenticate(request)
        self.assertIsNotNone(result)
        account, _ = result
        self.assertEqual(account.id, self.account.id)

    def test_invalid_key_raises(self):
        """A wrong key raises AuthenticationFailed."""
        from .authentication import ApiKeyAuthentication
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/', HTTP_AUTHORIZATION='ApiKey badkey')
        auth = ApiKeyAuthentication()
        with self.assertRaises(AuthenticationFailed):
            auth.authenticate(request)

    def test_bearer_header_is_ignored(self):
        """A Bearer scheme header is not processed by ApiKeyAuthentication."""
        from .authentication import ApiKeyAuthentication
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/', HTTP_AUTHORIZATION='Bearer sometoken')
        auth = ApiKeyAuthentication()
        result = auth.authenticate(request)
        self.assertIsNone(result)

    def test_inactive_key_rejected(self):
        """An inactive ServiceAccount cannot authenticate."""
        from .authentication import ApiKeyAuthentication
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework.test import APIRequestFactory

        self.account.is_active = False
        self.account.save()

        factory = APIRequestFactory()
        request = factory.post('/', HTTP_AUTHORIZATION=f'ApiKey {self.raw_key}')
        auth = ApiKeyAuthentication()
        with self.assertRaises(AuthenticationFailed):
            auth.authenticate(request)


# ── Test: LogIngestView — JWT (Human User) ────────────────────────────────────

class TestLogIngestJWT(TestCase):
    """Integration tests for the ingest endpoint authenticated via JWT."""

    def setUp(self):
        self.org = make_org()
        self.user = make_user(self.org)
        self.client = APIClient()
        # Obtain JWT token programmatically.
        resp = self.client.post(
            '/api/v1/auth/token/',
            {'username': 'alice', 'password': 'testpass123'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.token = resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def _valid_payload(self, source='POSTURE_WEBCAM'):
        return {
            'app_source': source,
            'payload': {'angle': 12.5, 'confidence': 0.92},
            'timestamp': timezone.now().isoformat(),
        }

    def test_webcam_ingest_creates_log(self):
        resp = self.client.post('/api/v1/logs/ingest/', self._valid_payload(), format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertIn('log_id', resp.data)
        log = PlatformLog.objects.get(pk=resp.data['log_id'])
        self.assertEqual(log.user, self.user)
        self.assertIsNone(log.service_account)
        self.assertEqual(log.app_source, 'POSTURE_WEBCAM')
        self.assertEqual(log.organization, self.org)

    def test_medical_ai_ingest_allowed_for_jwt(self):
        resp = self.client.post('/api/v1/logs/ingest/', self._valid_payload('MEDICAL_AI'), format='json')
        self.assertEqual(resp.status_code, 201)

    def test_cctv_source_rejected_for_jwt(self):
        """Human users must not be able to impersonate CCTV nodes."""
        resp = self.client.post('/api/v1/logs/ingest/', self._valid_payload('POSTURE_CCTV'), format='json')
        self.assertEqual(resp.status_code, 400)

    def test_missing_payload_returns_400(self):
        data = self._valid_payload()
        data.pop('payload')
        resp = self.client.post('/api/v1/logs/ingest/', data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_empty_payload_returns_400(self):
        data = self._valid_payload()
        data['payload'] = {}
        resp = self.client.post('/api/v1/logs/ingest/', data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_future_timestamp_returns_400(self):
        data = self._valid_payload()
        data['timestamp'] = (timezone.now() + timedelta(hours=1)).isoformat()
        resp = self.client.post('/api/v1/logs/ingest/', data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_unauthenticated_returns_401(self):
        self.client.credentials()  # clear
        resp = self.client.post('/api/v1/logs/ingest/', self._valid_payload(), format='json')
        self.assertEqual(resp.status_code, 401)


# ── Test: LogIngestView — API Key (Service Account) ───────────────────────────

class TestLogIngestApiKey(TestCase):
    """Integration tests for the ingest endpoint authenticated via API Key."""

    def setUp(self):
        self.org = make_org()
        self.cctv_account, self.cctv_key = make_service_account(
            self.org, source_type=ServiceAccount.SourceType.CCTV_NODE
        )
        self.ml_account, self.ml_key = make_service_account(
            self.org, source_type=ServiceAccount.SourceType.ML_SERVICE
        )
        self.client = APIClient()

    def _valid_cctv_payload(self):
        return {
            'app_source': 'POSTURE_CCTV',
            'payload': {'zone': 'floor2', 'person_count': 3},
            'timestamp': timezone.now().isoformat(),
        }

    def test_cctv_node_ingest_creates_log(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'ApiKey {self.cctv_key}')
        resp = self.client.post('/api/v1/logs/ingest/', self._valid_cctv_payload(), format='json')
        self.assertEqual(resp.status_code, 201)
        log = PlatformLog.objects.get(pk=resp.data['log_id'])
        self.assertEqual(log.service_account, self.cctv_account)
        self.assertIsNone(log.user)
        self.assertEqual(log.app_source, 'POSTURE_CCTV')

    def test_ml_service_can_ingest_medical_ai(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'ApiKey {self.ml_key}')
        data = {
            'app_source': 'MEDICAL_AI',
            'payload': {'condition': 'jaundice', 'confidence': 0.87},
            'timestamp': timezone.now().isoformat(),
        }
        resp = self.client.post('/api/v1/logs/ingest/', data, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_cctv_node_cannot_submit_webcam_source(self):
        """CCTV nodes must not be able to forge Webcam logs."""
        self.client.credentials(HTTP_AUTHORIZATION=f'ApiKey {self.cctv_key}')
        data = {
            'app_source': 'POSTURE_WEBCAM',
            'payload': {'angle': 5.0},
            'timestamp': timezone.now().isoformat(),
        }
        resp = self.client.post('/api/v1/logs/ingest/', data, format='json')
        self.assertEqual(resp.status_code, 400)


# ── Test: Multi-Tenancy Isolation ─────────────────────────────────────────────

class TestOrganizationIsolation(TestCase):
    """
    Ensures that data from one organization cannot be injected under another.
    The organization is always resolved from the authenticated credential,
    never from client-supplied data.
    """

    def setUp(self):
        self.org_a = make_org('Org A')
        self.org_b = make_org('Org B')
        self.user_a = make_user(self.org_a, username='user_a')
        self.client = APIClient()

        resp = self.client.post(
            '/api/v1/auth/token/',
            {'username': 'user_a', 'password': 'testpass123'},
            format='json',
        )
        self.token = resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_log_always_belongs_to_authenticated_users_org(self):
        """
        Even if a client somehow crafts a request for org_b,
        the log must be persisted under org_a (user_a's org).
        The API does not accept an `organization` field from the client.
        """
        data = {
            'app_source': 'POSTURE_WEBCAM',
            'payload': {'angle': 7.2},
            'timestamp': timezone.now().isoformat(),
            # Attempting to inject a foreign org — the serializer ignores this.
            'organization': str(self.org_b.id),
        }
        resp = self.client.post('/api/v1/logs/ingest/', data, format='json')
        self.assertEqual(resp.status_code, 201)
        log = PlatformLog.objects.get(pk=resp.data['log_id'])
        self.assertEqual(log.organization, self.org_a)
        self.assertNotEqual(log.organization, self.org_b)


# ── Test: UserProfileView ─────────────────────────────────────────────────────

class TestUserProfileView(TestCase):
    def setUp(self):
        self.org = make_org('Tech Corp')
        self.user = make_user(self.org, username='bob')
        self.client = APIClient()
        
        # Authenticate
        resp = self.client.post(
            '/api/v1/auth/token/',
            {'username': 'bob', 'password': 'testpass123'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_get_user_profile(self):
        resp = self.client.get('/api/v1/users/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['username'], 'bob')
        self.assertEqual(resp.data['organization']['name'], 'Tech Corp')
        self.assertFalse(resp.data['organization']['has_subscription'])

    def test_service_account_rejected(self):
        """Service accounts cannot access the human user profile endpoint."""
        account, raw_key = make_service_account(self.org)
        self.client.credentials(HTTP_AUTHORIZATION=f'ApiKey {raw_key}')
        resp = self.client.get('/api/v1/users/me/')
        self.assertEqual(resp.status_code, 403)


# ── Test: Billing Endpoints ───────────────────────────────────────────────────

class TestBillingEndpoints(TestCase):
    def setUp(self):
        self.org = make_org()
        self.user = make_user(self.org, username='charlie')
        self.client = APIClient()
        resp = self.client.post(
            '/api/v1/auth/token/',
            {'username': 'charlie', 'password': 'testpass123'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session(self, mock_create):
        mock_create.return_value.url = 'https://checkout.stripe.com/test'
        
        resp = self.client.post('/api/v1/billing/checkout/', {'price_id': 'price_123'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['url'], 'https://checkout.stripe.com/test')
        
        # Ensure client_reference_id matches the org
        mock_create.assert_called_once()
        args, kwargs = mock_create.call_args
        self.assertEqual(kwargs['client_reference_id'], str(self.org.id))

    def test_checkout_requires_price_id(self):
        resp = self.client.post('/api/v1/billing/checkout/', {}, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch('stripe.billing_portal.Session.create')
    @patch('stripe.Subscription.retrieve')
    def test_customer_portal(self, mock_retrieve, mock_create):
        # Fake an active subscription on the org
        self.org.stripe_subscription_id = 'sub_123'
        self.org.save()
        
        mock_retrieve.return_value.customer = 'cus_456'
        mock_create.return_value.url = 'https://billing.stripe.com/test'
        
        resp = self.client.post('/api/v1/billing/portal/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['url'], 'https://billing.stripe.com/test')

    def test_customer_portal_requires_subscription(self):
        # Org has no stripe_subscription_id
        resp = self.client.post('/api/v1/billing/portal/')
        self.assertEqual(resp.status_code, 400)

    @patch('stripe.Webhook.construct_event')
    def test_stripe_webhook_checkout_completed(self, mock_webhook):
        mock_webhook.return_value = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'client_reference_id': str(self.org.id),
                    'subscription': 'sub_789'
                }
            }
        }
        
        # Webhooks don't use JWT, they use stripe signatures
        self.client.credentials() 
        resp = self.client.post('/api/v1/billing/webhook/', {}, format='json', HTTP_STRIPE_SIGNATURE='test_sig')
        
        self.assertEqual(resp.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.stripe_subscription_id, 'sub_789')
        self.assertTrue(self.org.is_active)

