from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import PlatformLog


class PlatformLogSerializer(serializers.ModelSerializer):
    """
    Validates and deserialises inbound telemetry payloads.

    Fields supplied by the client: app_source, payload, timestamp.
    Fields injected by the view:   organization, user, service_account.
    """

    # Accept ISO-8601 datetime strings from clients.
    timestamp = serializers.DateTimeField()

    class Meta:
        model = PlatformLog
        fields = ['app_source', 'payload', 'timestamp']

    # ── Field-level validation ────────────────────────────────────────────────

    def validate_payload(self, value):
        if not isinstance(value, dict) or not value:
            raise serializers.ValidationError(
                'payload must be a non-empty JSON object.'
            )
        return value

    def validate_timestamp(self, value):
        """
        Reject timestamps more than 5 minutes in the future (clock-skew guard).
        Stale historical timestamps are allowed — edge nodes may batch-upload.
        """
        now = timezone.now()
        clock_skew_tolerance = timedelta(minutes=5)
        if value > now + clock_skew_tolerance:
            raise serializers.ValidationError(
                'timestamp is too far in the future. Check the client clock.'
            )
        return value

    # ── Object-level validation ───────────────────────────────────────────────

    def validate(self, attrs):
        """
        Cross-field validation: enforce allowed app_source values per caller type.
        `allowed_sources` is injected into the serializer context by the view.
        """
        allowed_sources = self.context.get('allowed_sources')
        if allowed_sources is not None:
            if attrs['app_source'] not in allowed_sources:
                raise serializers.ValidationError({
                    'app_source': (
                        f"'{attrs['app_source']}' is not permitted for this credential. "
                        f"Allowed: {allowed_sources}"
                    )
                })
        return attrs

    def create(self, validated_data):
        """
        Merges view-injected fields (organization, user, service_account)
        from serializer context before saving.
        """
        context_fields = {
            k: self.context[k]
            for k in ('organization', 'user', 'service_account')
            if k in self.context
        }
        return PlatformLog.objects.create(**validated_data, **context_fields)
