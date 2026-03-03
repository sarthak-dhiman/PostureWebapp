from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from django.utils import timezone

from .models import Organization, ServiceAccount, CCTVTelemetry, PlatformLog
from .authentication import ApiKeyAuthentication


class CCTVNodeRegisterView(APIView):
    """
    POST /api/v1/cctv/nodes/register/
    Registers a new CCTV node using an Organization invite code.
    Returns a 'node_token' (raw ApiKey) for future authentication.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        mac_address = request.data.get('mac_address')
        device_name = request.data.get('device_name')
        invite_code = request.data.get('organization_invite_code')

        if not all([mac_address, device_name, invite_code]):
            return Response(
                {"error": "Missing required fields: mac_address, device_name, organization_invite_code"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            org = Organization.objects.get(invite_code=invite_code)
        except Organization.DoesNotExist:
            return Response({"error": "Invalid organization invite code."}, status=status.HTTP_404_NOT_FOUND)

        # Look up or create the service account for this CCTV node
        # Using mac_address + device_name for the internal name
        account_name = f"CCTV [{mac_address}] - {device_name}"
        
        # We always generate a new key on register
        service_account, raw_key = ServiceAccount.create_with_key(
            organization=org,
            name=account_name,
            source_type=ServiceAccount.SourceType.CCTV_NODE
        )

        return Response({
            "message": "Node registered successfully.",
            "node_token": raw_key,
            "organization_id": str(org.id),
            "organization_name": org.name
        }, status=status.HTTP_201_CREATED)


class CCTVNodeTelemetryView(APIView):
    """
    POST /api/v1/cctv/nodes/telemetry/
    Allows a CCTV node to post its heartbeat/status.
    Requires 'Authorization: ApiKey <node_token>' header.
    """
    authentication_classes = [ApiKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, ServiceAccount) or user.source_type != ServiceAccount.SourceType.CCTV_NODE:
            return Response({"error": "Only CCTV Node service accounts can post telemetry."}, status=status.HTTP_403_FORBIDDEN)

        status_val = request.data.get('status', 'online')
        active_tracked_persons = request.data.get('active_tracked_persons', 0)
        current_fps = request.data.get('current_fps', 0.0)

        telemetry = CCTVTelemetry.objects.create(
            service_account=user,
            status=status_val,
            active_tracked_persons=active_tracked_persons,
            current_fps=current_fps
        )

        return Response({"message": "Telemetry logged.", "id": str(telemetry.id)}, status=status.HTTP_201_CREATED)


class CCTVEventLogView(APIView):
    """
    POST /api/v1/cctv/events/log/
    Allows a CCTV node to post anomaly/violation events.
    Requires 'Authorization: ApiKey <node_token>' header.
    """
    authentication_classes = [ApiKeyAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, ServiceAccount) or user.source_type != ServiceAccount.SourceType.CCTV_NODE:
            return Response({"error": "Only CCTV Node service accounts can post events."}, status=status.HTTP_403_FORBIDDEN)

        event_type = request.data.get('event_type')
        severity = request.data.get('severity', 'UNKNOWN')
        client_timestamp = request.data.get('timestamp')
        
        if not event_type:
            return Response({"error": "Missing required field: event_type"}, status=status.HTTP_400_BAD_REQUEST)

        # Store the raw payload inside the PlatformLog payload
        payload = {
            "event_type": event_type,
            "severity": severity,
            "confidence_score": request.data.get('confidence_score'),
            "subject_id": request.data.get('subject_id'),
            "snapshot_base64": request.data.get('snapshot_base64')
        }

        from dateutil.parser import parse
        try:
            timestamp = parse(client_timestamp) if client_timestamp else timezone.now()
        except Exception:
            timestamp = timezone.now()

        log = PlatformLog.objects.create(
            organization=user.organization,
            app_source=PlatformLog.AppSource.POSTURE_CCTV,
            service_account=user,
            payload=payload,
            timestamp=timestamp
        )

        return Response({"message": "Event logged.", "log_id": str(log.id)}, status=status.HTTP_201_CREATED)
