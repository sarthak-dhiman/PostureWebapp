"""
Minimal Cashfree client wrapper used by billing code.
This provides a simple interface mirroring the previous Razorpay usage
but currently returns mocked responses if no live keys/configured endpoint is available.
Extend the HTTP calls here when integrating with Cashfree production/sandbox APIs.
"""
from dataclasses import dataclass
import uuid
from django.conf import settings


@dataclass
class CashfreeClient:
    app_id: str
    secret: str
    live: bool = False

    def is_configured(self) -> bool:
        return bool(self.app_id and self.secret)

    def create_subscription(self, plan_id: str, quantity: int, notes: dict | None = None, trial_days: int | None = None):
        # TODO: Implement actual Cashfree Subscription API calls.
        return {
            'id': f'cf_sub_{uuid.uuid4().hex[:16]}',
            'plan_id': plan_id,
            'quantity': quantity,
            'notes': notes or {}
        }

    def create_order(self, amount_paise: int, currency: str = 'INR', notes: dict | None = None):
        # Cashfree expects amounts in major units for most APIs; this wrapper keeps paise for parity with existing code.
        return {
            'id': f'cf_order_{uuid.uuid4().hex[:12]}',
            'amount': amount_paise,
            'currency': currency,
            'notes': notes or {}
        }

    def fetch_subscription_portal_url(self, subscription_id: str):
        # Cashfree may not provide a direct portal URL like Razorpay; return a helpful docs URL for now.
        return {
            'url': 'https://developer.cashfree.com/docs/',
            'is_mock': True
        }

    def refund_payment(self, payment_id: str, amount_paise: int, reason: str | None = None):
        return {
            'id': f'cf_refund_{uuid.uuid4().hex[:12]}',
            'payment_id': payment_id,
            'amount': amount_paise,
            'status': 'PENDING'
        }


# Initialize a module-level client instance using settings if available
_cashfree_client = CashfreeClient(
    app_id=getattr(settings, 'CASHFREE_APP_ID', ''),
    secret=getattr(settings, 'CASHFREE_SECRET', ''),
    live=getattr(settings, 'CASHFREE_LIVE', False)
)


def get_client():
    return _cashfree_client
