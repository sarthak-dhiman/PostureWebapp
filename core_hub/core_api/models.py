import uuid
import hashlib
import secrets

from django.utils import timezone
from django.contrib.auth.models import AbstractUser
from django.db import models


class Organization(models.Model):
    """Root tenant. Every data point in the platform belongs to one Organization."""

    class InvitePolicy(models.TextChoices):
        OPEN_LINK = 'OPEN_LINK', 'Open Link (Auto-Join)'
        APPROVAL_REQUIRED = 'APPROVAL_REQUIRED', 'Approval Required'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    invite_code = models.CharField(max_length=64, unique=True, default=uuid.uuid4, help_text="Code used by employees to join this organization.")
    invite_policy = models.CharField(max_length=25, choices=InvitePolicy.choices, default=InvitePolicy.OPEN_LINK)
    max_seats = models.IntegerField(default=5, help_text="Maximum number of users allowed in this organization.")
    razorpay_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    current_period_end = models.DateTimeField(blank=True, null=True, help_text="End of the current billing cycle.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'

    def __str__(self):
        return self.name


class CustomUser(AbstractUser):
    """
    Human employee / patient account.
    Extends AbstractUser so Django's built-in auth machinery (sessions, admin,
    password hashing) is fully preserved.
    """

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        EMPLOYEE = 'EMPLOYEE', 'Employee'
        SOLO = 'SOLO', 'Solo User'

    # Superusers (platform admins) may have no org; hence null=True.
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name='users',
        null=True,
        blank=True,
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.SOLO,
    )
    is_email_verified = models.BooleanField(
        default=False, 
        help_text="Tracks whether the user has verified their email address via token."
    )
    phone_number = models.CharField(
        max_length=32,
        blank=True,
        null=True,
        help_text="Optional E.164 phone number for SMS verification."
    )
    is_phone_verified = models.BooleanField(
        default=False,
        help_text="Tracks whether the user's phone number has been verified."
    )
    monitoring_seconds_used = models.PositiveIntegerField(
        default=0,
        help_text="Total seconds of posture monitoring used (free tier cap: 604800s / 7 days)."
    )

    FREE_TIER_QUOTA_SECONDS = 604_800  # 7 days

    def quota_remaining_seconds(self):
        """Returns remaining free tier quota in seconds, or None if user has a paid plan."""
        if self.role == self.Role.SOLO:
            org = getattr(self, 'organization', None)
            has_sub = org.has_subscription() if org and hasattr(org, 'has_subscription') else bool(getattr(org, 'razorpay_subscription_id', None))
            if not has_sub:
                return max(0, self.FREE_TIER_QUOTA_SECONDS - self.monitoring_seconds_used)
        return None  # Unlimited for paid / org users

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'


class ServiceAccount(models.Model):
    """
    Headless identity for CCTV edge nodes and backend microservices (FastAPI Medical AI).
    Authentication is done via a hashed API key — the raw key is shown once at creation
    and never stored in the database.
    """

    class SourceType(models.TextChoices):
        CCTV_NODE = 'CCTV_NODE', 'CCTV Node'
        ML_SERVICE = 'ML_SERVICE', 'ML Microservice'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='service_accounts',
    )
    name = models.CharField(max_length=255)
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.CCTV_NODE,
        help_text='Determines which app_source values this account may submit.',
    )
    api_key_hash = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
        help_text='SHA-256 hex digest of the raw API key. Never store the raw key.',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['organization', 'name']
        verbose_name = 'Service Account'
        verbose_name_plural = 'Service Accounts'

    def __str__(self):
        return f'{self.name} [{self.organization}]'

    # ── DRF permission compatibility ──────────────────────────────────────────
    # DRF's IsAuthenticated calls `request.user.is_authenticated`.
    # ServiceAccount is not an AbstractUser subclass, so we declare these
    # class-level attributes to satisfy the DRF permission interface.
    is_authenticated = True
    is_anonymous = False



    @staticmethod
    def generate_raw_key() -> str:
        """Returns a cryptographically-secure 64-char hex token (256 bits of entropy)."""
        return secrets.token_hex(32)

    @staticmethod
    def hash_key(raw_key: str) -> str:
        """Deterministic SHA-256 hash of the raw key."""
        return hashlib.sha256(raw_key.encode('utf-8')).hexdigest()

    @classmethod
    def create_with_key(cls, organization, name, source_type=None) -> tuple['ServiceAccount', str]:
        """
        Factory method: generates a fresh key, persists only its hash.
        Returns (service_account_instance, raw_key).
        The caller MUST display raw_key to the operator and then discard it.
        """
        raw_key = cls.generate_raw_key()
        kwargs = dict(
            organization=organization,
            name=name,
            api_key_hash=cls.hash_key(raw_key),
        )
        if source_type is not None:
            kwargs['source_type'] = source_type
        account = cls.objects.create(**kwargs)
        return account, raw_key


class PlatformLog(models.Model):
    """
    Unified ingestion table — the single write target for all three client applications.

    Exactly one of `user` or `service_account` will be populated per row:
      • POSTURE_WEBCAM  → user (CustomUser via JWT)
      • MEDICAL_AI      → user (CustomUser via JWT, dashboard-triggered) OR
                          service_account (FastAPI backend via ApiKey)
      • POSTURE_CCTV    → service_account (CCTV edge node via ApiKey)
    """

    class AppSource(models.TextChoices):
        POSTURE_WEBCAM = 'POSTURE_WEBCAM', 'Posture Webcam'
        POSTURE_CCTV = 'POSTURE_CCTV', 'Posture CCTV'
        MEDICAL_AI = 'MEDICAL_AI', 'Medical AI'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name='logs',
        db_index=True,
    )
    app_source = models.CharField(
        max_length=20,
        choices=AppSource.choices,
        db_index=True,
    )

    # Nullable FKs — only one will be populated per record.
    user = models.ForeignKey(
        'core_api.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs',
    )
    service_account = models.ForeignKey(
        ServiceAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs',
    )

    # Flexible payload: time-series posture angles OR bounding-box diagnostics.
    payload = models.JSONField()

    # Client-reported event time (what happened) vs server ingestion time (when we received it).
    timestamp = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Platform Log'
        verbose_name_plural = 'Platform Logs'
        indexes = [
            models.Index(fields=['organization', 'timestamp'], name='idx_org_ts'),
            models.Index(fields=['app_source', 'timestamp'], name='idx_source_ts'),
            models.Index(fields=['user', 'timestamp'], name='idx_user_ts'),
        ]

    def __str__(self):
        actor = self.user or self.service_account or 'anonymous'
        return f'[{self.app_source}] {actor} @ {self.timestamp}'


class OAuthSession(models.Model):
    """
    Tracks the state of a PySide6 Desktop app Google OAuth 'Device Flow' polling sequence.
    The desktop app polls this session until 'status' changes from 'pending' to 'done'.
    """
    class StatusTypes(models.TextChoices):
        PENDING = 'pending', 'Pending User Action'
        DONE = 'done', 'Authentication Complete'
        INVALID = 'invalid', 'Session Expired/Invalid'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.CharField(max_length=100, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=StatusTypes.choices, default=StatusTypes.PENDING)
    payload = models.JSONField(null=True, blank=True, help_text="Stores the finalized NextAuth compatible payload (token, name, first_time, subscription)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.session_id} - {self.status}"


class GiftedSubscription(models.Model):
    """
    Tracks a subscription that was purchased as a gift for another user via email.
    If it is not accepted within 15 days, it is eligible for an automatic refund.
    """
    class StatusTypes(models.TextChoices):
        PENDING = 'PENDING', 'Pending Acceptance'
        ACCEPTED = 'ACCEPTED', 'Accepted & Active'
        REFUNDED = 'REFUNDED', 'Expired & Refunded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='gifts_sent')
    recipient_email = models.EmailField(db_index=True)
    
    # We need both: order id to verify payment initially, payment_id to issue the refund later
    razorpay_order_id = models.CharField(max_length=255, unique=True)
    razorpay_payment_id = models.CharField(max_length=255, blank=True, null=True)
    
    plan_id = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=StatusTypes.choices, default=StatusTypes.PENDING)
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.utils import timezone
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(days=15)
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Gifted Subscription'
        verbose_name_plural = 'Gifted Subscriptions'

    def __str__(self):
        return f"Gift from {self.buyer.email} to {self.recipient_email} ({self.status})"

class CCTVCamera(models.Model):
    """
    Represents a specific camera stream connected to an edge node.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_account = models.ForeignKey(
        ServiceAccount, 
        on_delete=models.CASCADE, 
        related_name='cameras'
    )
    uid = models.CharField(max_length=100, help_text="Client-side unique ID for the camera (e.g. cam_01)")
    name = models.CharField(max_length=255)
    room_type = models.CharField(max_length=100, default="General")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('service_account', 'uid')
        verbose_name = 'CCTV Camera'
        verbose_name_plural = 'CCTV Cameras'

    def __str__(self):
        return f"{self.name} ({self.service_account.name})"


class CCTVViolation(models.Model):
    """
    Logs specific AI-detected violations (e.g. Slouching, No PPE).
    """
    class Severity(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='cctv_violations')
    camera = models.ForeignKey(CCTVCamera, on_delete=models.CASCADE, related_name='violations')
    
    violation_type = models.CharField(max_length=100) # e.g. "Bad Posture", "Unauthorized Access"
    violator_name = models.CharField(max_length=255, blank=True, null=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.MEDIUM)
    
    snapshot_url = models.URLField(blank=True, null=True, help_text="Link to the captured frame if uploaded")
    payload = models.JSONField(default=dict, help_text="Additional metadata about the violation")
    
    timestamp = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'CCTV Violation'
        verbose_name_plural = 'CCTV Violations'


class CCTVTelemetry(models.Model):
    """
    Heartbeat and metrics log continuously pushed by CCTV edge nodes.
    Used by the dashboard to show green/red online status and current load.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_account = models.ForeignKey(
        ServiceAccount,
        on_delete=models.CASCADE,
        related_name='telemetry',
        db_index=True,
    )
    status = models.CharField(max_length=50, default="online")
    active_tracked_persons = models.IntegerField(default=0)
    current_fps = models.FloatField(default=0.0)
    
    # New: Detailed per-camera JSON payload
    payload = models.JSONField(default=dict, help_text="Rich telemetry data including per-camera stats")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'CCTV Telemetry'
        verbose_name_plural = 'CCTV Telemetry'

    def __str__(self):
        return f"[{self.service_account.name}] {self.status} / {self.current_fps}fps @ {self.created_at}"


class ProcessedWebhookEvent(models.Model):
    """
    Ensures idempotency for Razorpay webhooks.
    We store the unique 'event_id' from the payload.
    """
    event_id = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Processed Webhook Event'
        verbose_name_plural = 'Processed Webhook Events'

    def __str__(self):
        return self.event_id


class BillingTransaction(models.Model):
    """
    Audit log for all payment-related activities.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, related_name='transactions')
    transaction_id = models.CharField(max_length=100, db_index=True, help_text="Razorpay Order ID or Payment ID")
    event_type = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=50, default="processed")
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Billing Transaction'
        verbose_name_plural = 'Billing Transactions'

    def __str__(self):
        return f"{self.event_type} - {self.transaction_id} - {self.created_at}"


class Refund(models.Model):
    """
    Tracks refund requests and their outcomes.
    """
    class StatusTypes(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSED = 'processed', 'Processed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='refunds')
    payment_id = models.CharField(max_length=100, db_index=True)
    refund_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=StatusTypes.choices, default=StatusTypes.PENDING)
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Refund {self.amount} for {self.payment_id} ({self.status})"


class Invoice(models.Model):
    """
    Stores metadata for billing documents generated by the payment gateway.
    """
    class Status(models.TextChoices):
        ISSUED = 'issued', 'Issued'
        PAID = 'paid', 'Paid'
        CANCELLED = 'cancelled', 'Cancelled'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invoices')
    razorpay_invoice_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    razorpay_payment_id = models.CharField(max_length=255, null=True, blank=True)
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ISSUED)
    
    invoice_pdf_url = models.URLField(max_length=1024, null=True, blank=True)
    issued_at = models.DateTimeField(default=timezone.now)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issued_at']
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'

    def __str__(self):
        return f"Invoice {self.razorpay_invoice_id or self.id} - {self.organization.name}"


class AuditLog(models.Model):
    """
    Security audit trail for tracking administrative and sensitive system actions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    actor = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='actions_performed')
    
    action = models.CharField(max_length=100, db_index=True) # e.g. ROLE_CHANGE, SEAT_UPDATE
    description = models.TextField()
    payload = models.JSONField(default=dict, help_text="Stores before/after state or raw request data")
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        actor_name = self.actor.email if self.actor else "System"
        return f"[{self.action}] {actor_name} @ {self.created_at}"


class SupportTicket(models.Model):
    """
    User-initiated support request.
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        RESOLVED = 'RESOLVED', 'Resolved'
        CLOSED = 'CLOSED', 'Closed'

    class Category(models.TextChoices):
        BILLING = 'BILLING', 'Billing Issue'
        TECHNICAL = 'TECHNICAL', 'Technical Problem'
        FEATURE_REQUEST = 'FEATURE', 'Feature Request'
        OTHER = 'OTHER', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='tickets')
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"[{self.status}] {self.subject} - {self.user.email}"


class SupportTicketMessage(models.Model):
    """
    A single message within a support ticket thread.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    
    content = models.TextField()
    is_internal = models.BooleanField(default=False, help_text="If true, only developers see this message")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"From {self.sender.email} @ {self.created_at}"


class PhoneOTP(models.Model):
    """
    Temporarily stores phone verification codes for users.
    Codes are short-lived and single-use.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='phone_otps')
    code = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP for {self.user.email} ({'used' if self.used else 'new'})"


class AdWatch(models.Model):
    """
    Records an ad watch event for a user. In production, `validated` should only
    be True after verifying the provider's proof/token/webhook.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='ad_watches')
    provider = models.CharField(max_length=100, default='mock')
    ad_id = models.CharField(max_length=255, blank=True, null=True)
    validated = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"AdWatch {self.provider}:{self.ad_id} by {self.user.email} ({'validated' if self.validated else 'unvalidated'})"


class AdRewardGrant(models.Model):
    """
    Records rewards given to users for watching ads (credits or AI access).
    """
    class GrantType(models.TextChoices):
        CREDIT = 'CREDIT', 'Credit Seconds'
        AI_ACCESS = 'AI_ACCESS', 'AI Access Uses'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='ad_rewards')
    grant_type = models.CharField(max_length=20, choices=GrantType.choices)
    amount_seconds = models.IntegerField(null=True, blank=True)
    uses = models.IntegerField(default=0)
    source = models.CharField(max_length=50, default='ads')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Reward {self.grant_type} for {self.user.email} ({self.amount_seconds or self.uses})"

