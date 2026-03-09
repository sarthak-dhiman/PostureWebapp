import uuid
import hashlib
import secrets

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
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
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
    monitoring_seconds_used = models.PositiveIntegerField(
        default=0,
        help_text="Total seconds of posture monitoring used (free tier cap: 36000s / 10hrs)."
    )

    FREE_TIER_QUOTA_SECONDS = 36_000  # 10 hours

    def quota_remaining_seconds(self):
        """Returns remaining free tier quota in seconds, or None if user has a paid plan."""
        if self.role == self.Role.SOLO:
            org = getattr(self, 'organization', None)
            has_sub = org.has_subscription() if org and hasattr(org, 'has_subscription') else bool(getattr(org, 'stripe_subscription_id', None))
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
    
    # We need both: checkout session to verify payment initially, payment_intent to issue the refund later
    stripe_checkout_session_id = models.CharField(max_length=255, unique=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    
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

