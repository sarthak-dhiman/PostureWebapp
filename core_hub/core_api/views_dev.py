from rest_framework import status
from rest_framework.permissions import IsAdminUser, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from .models import Invoice, Organization, CustomUser, AuditLog, PlatformLog, SupportTicket, SupportTicketMessage

class IsSuperUser(BasePermission):
    """
    Allow access only to superusers.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)

class DevMetricsView(APIView):
    """
    GET /api/v1/dev/metrics/
    Aggregates business and system metrics for developers.
    """
    permission_classes = [IsSuperUser]

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        
        # 1. Revenue Metrics
        total_revenue = Invoice.objects.filter(status='paid').aggregate(Sum('amount'))['amount__sum'] or 0
        monthly_revenue = Invoice.objects.filter(status='paid', paid_at__gte=thirty_days_ago).aggregate(Sum('amount'))['amount__sum'] or 0
        
        # 2. Subscription Metrics
        active_subscriptions = Organization.objects.filter(razorpay_subscription_id__isnull=False, is_active=True).count()
        total_orgs = Organization.objects.count()
        
        # 3. User Metrics
        total_users = CustomUser.objects.count()
        new_users_30d = CustomUser.objects.filter(date_joined__gte=thirty_days_ago).count()
        
        # 4. Demographics (Simplified)
        roles_breakdown = CustomUser.objects.values('role').annotate(count=Count('role'))
        
        # 5. Ad Revenue (Mock)
        # Assuming ad revenue is tracked externally and periodically updated in a setting or new model
        ad_revenue = 125.50 # Placeholder for actual ad system integration
        
        return Response({
            "revenue": {
                "total": float(total_revenue),
                "monthly": float(monthly_revenue),
                "ad_revenue": ad_revenue,
                "currency": "INR"
            },
            "subscriptions": {
                "active": active_subscriptions,
                "total_orgs": total_orgs,
                "conversion_rate": (active_subscriptions / total_orgs * 100) if total_orgs > 0 else 0
            },
            "users": {
                "total": total_users,
                "growth_30d": new_users_30d,
                "roles": {r['role']: r['count'] for r in roles_breakdown}
            },
            "system_health": {
                "errors_24h": PlatformLog.objects.filter(payload__contains={'level': 'error'}, timestamp__gte=now - timedelta(hours=24)).count(),
                "audit_events_24h": AuditLog.objects.filter(created_at__gte=now - timedelta(hours=24)).count()
            }
        })

class DevLogStreamView(APIView):
    """
    GET /api/v1/dev/logs/
    Returns recent system and audit logs.
    """
    permission_classes = [IsSuperUser]

    def get(self, request):
        log_type = request.query_params.get('type', 'audit')
        limit = int(request.query_params.get('limit', 50))
        
        if log_type == 'platform':
            logs = PlatformLog.objects.all()[:limit]
            data = [{
                "id": str(l.id),
                "source": l.app_source,
                "actor": str(l.user or l.service_account),
                "timestamp": l.timestamp,
                "payload": l.payload
            } for l in logs]
        else:
            logs = AuditLog.objects.all()[:limit]
            data = [{
                "id": str(l.id),
                "action": l.action,
                "actor": l.actor.email if l.actor else "System",
                "description": l.description,
                "created_at": l.created_at,
                "payload": l.payload
            } for l in logs]
            
        return Response(data)

class SupportPortalDevView(APIView):
    """
    Dev management for support tickets.
    """
    permission_classes = [IsSuperUser]

    def get(self, request):
        tickets = SupportTicket.objects.all()
        data = [{
            "id": str(t.id),
            "user": t.user.email,
            "subject": t.subject,
            "category": t.category,
            "status": t.status,
            "created_at": t.created_at,
            "last_message": t.messages.last().content if t.messages.exists() else None
        } for t in tickets]
        return Response(data)

    def post(self, request):
        ticket_id = request.data.get('ticket_id')
        content = request.data.get('content')
        status_update = request.data.get('status')
        
        try:
            ticket = SupportTicket.objects.get(id=ticket_id)
            if content:
                SupportTicketMessage.objects.create(
                    ticket=ticket,
                    sender=request.user,
                    content=content
                )
            if status_update:
                ticket.status = status_update
                ticket.save()
            return Response({"status": "updated"})
        except SupportTicket.DoesNotExist:
            return Response({"error": "Ticket not found"}, status=status.HTTP_404_NOT_FOUND)

class SupportTicketView(APIView):
    """
    POST /api/v1/support/tickets/
    Allows authenticated users to create support tickets.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subject = request.data.get('subject')
        content = request.data.get('content')
        category = request.data.get('category', 'OTHER')
        
        if not subject or not content:
            return Response({"error": "Subject and content are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        ticket = SupportTicket.objects.create(
            user=request.user,
            subject=subject,
            category=category
        )
        
        SupportTicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            content=content
        )
        
        return Response({
            "id": str(ticket.id),
            "status": ticket.status
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        """
        List user's own tickets.
        """
        tickets = SupportTicket.objects.filter(user=request.user)
        data = [{
            "id": str(t.id),
            "subject": t.subject,
            "status": t.status,
            "created_at": t.created_at
        } for t in tickets]
        return Response(data)
