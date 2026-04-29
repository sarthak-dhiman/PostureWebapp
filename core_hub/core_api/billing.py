import uuid
from django.conf import settings
from .utils.cashfree import get_client
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser, Organization, GiftedSubscription, ProcessedWebhookEvent, BillingTransaction, Refund, Invoice
from .utils.billing_logic import reset_organization_usage
from .utils.email import send_billing_email
from .utils.monitoring import send_system_alert

# Initialize Cashfree client
cashfree_client = get_client()


def _is_placeholder_plan_id(plan_id) -> bool:
    """Frontend falls back to plan_mock_* when env plan IDs are unset; Razorpay rejects these."""
    return isinstance(plan_id, str) and plan_id.startswith("plan_mock_")


class CreateSubscriptionView(APIView):
    """
    POST /api/v1/billing/checkout/
    Generates a Cashfree Subscription (or a mock subscription in development).
    Expects a `plan_id` in the request body. Returns a `subscription_id`.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or not user.organization:
            return Response(
                {"detail": "Only human users with an organization can subscribe."},
                status=status.HTTP_403_FORBIDDEN
            )

        plan_id = request.data.get('plan_id')
        if not plan_id:
            # Fallback for frontend code that might still send `price_id`
            plan_id = request.data.get('price_id')
            if not plan_id:
                return Response({"detail": "plan_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Scaffold/Development Fallback bypasses Cashfree if client not configured
        if not cashfree_client.is_configured() or getattr(settings, 'CASHFREE_SECRET', '').endswith('placeholder'):
            # reuse existing DB field for compatibility
            subscription_id = f"cf_sub_mock_{plan_id}"
            user.organization.razorpay_subscription_id = subscription_id
            user.organization.current_period_end = timezone.now() + timezone.timedelta(days=30)
            user.organization.save()
            # Upgrade the user to ADMIN so they can access the enterprise dashboard
            if 'business' in plan_id.lower() or 'enterprise' in plan_id.lower():
                if user.role != CustomUser.Role.ADMIN:
                    user.role = CustomUser.Role.ADMIN
                    user.save(update_fields=['role'])
            return Response({'subscription_id': subscription_id})

        # For Cashfree we accept the plan_id from frontend; validate on server-side in a real integration

        try:
            # Prepare subscription payload for Cashfree (implementation-specific)
            subscription_data = {
                "plan_id": plan_id,
                "quantity": user.organization.max_seats,
                "notes": {
                    "organization_id": str(user.organization.id)
                }
            }
            
            # Add 7-day free trial for SOLO users on their first subscription
            if user.role == CustomUser.Role.SOLO:
                # Razorpay expects timestamp for start_at
                from datetime import timedelta
                import time
                start_time = int(time.time() + timedelta(days=7).total_seconds())
                subscription_data['start_at'] = start_time
                
            # Create subscription via Cashfree client (currently mocked)
            subscription = cashfree_client.create_subscription(
                plan_id=plan_id,
                quantity=user.organization.max_seats,
                notes=subscription_data.get('notes'),
                trial_days=7 if user.role == CustomUser.Role.SOLO else None
            )

            return Response({'subscription_id': subscription['id']})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GiftCheckoutSessionView(APIView):
    """
    POST /api/v1/billing/gift/checkout/
    Generates a Razorpay Order for gifting a subscription.
    Unlike recurring subscriptions, gifts are one-off purchases (Orders).
    Expects `plan_id` and `recipient_email` in the request body.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response(
                {"detail": "Only human users can gift a subscription."},
                status=status.HTTP_403_FORBIDDEN
            )

        plan_id = request.data.get('plan_id')
        if not plan_id:
            plan_id = request.data.get('price_id')
            
        recipient_email = request.data.get('recipient_email')
        
        if not plan_id or not recipient_email:
            return Response({"detail": "plan_id and recipient_email are required."}, status=status.HTTP_400_BAD_REQUEST)

        # We must look up the cost of the plan to create an Order.
        # Given we only have the plan ID here, we either fetch it from Razorpay
        # or have the frontend send the amount. We will fetch the plan.
        
        if not cashfree_client.is_configured() or getattr(settings, 'CASHFREE_SECRET', '').endswith('placeholder'):
            import uuid
            order_id = f"cf_order_test_{uuid.uuid4().hex[:16]}"
            GiftedSubscription.objects.create(
                buyer=user,
                recipient_email=recipient_email,
                razorpay_order_id=order_id,
                plan_id=plan_id,
            )
            return Response({'order_id': order_id})

        # For Cashfree, frontend should provide the amount or server must map plan_id -> amount.

        try:
            # TODO: map plan_id -> amount. For now, return a mocked Cashfree order.
            # Amounts in existing code are handled in paise in some places; frontend should provide amount in future.
            mocked_amount = 50000  # 500.00 as paise
            order = cashfree_client.create_order(amount_paise=mocked_amount, currency='INR', notes={
                'is_gift': 'true',
                'buyer_id': str(user.id),
                'recipient_email': recipient_email,
                'plan_id': plan_id
            })

            return Response({'order_id': order['id']})
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomerPortalView(APIView):
    """
    POST /api/v1/billing/customer-portal/
    Returns a customer portal URL or documentation link for managing subscription.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or not user.organization:
            return Response({"detail": "No organization associated."}, status=status.HTTP_403_FORBIDDEN)

        org = user.organization
        if not org.razorpay_subscription_id:
            return Response(
                {"detail": "Organization does not have an active subscription."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not cashfree_client.is_configured():
            return Response({"detail": "Cashfree client not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            portal = cashfree_client.fetch_subscription_portal_url(org.razorpay_subscription_id)
            return Response({'url': portal.get('url'), 'is_mock': portal.get('is_mock', False)})
        except Exception as e:
            # Fallback for mock subscriptions
            if org.razorpay_subscription_id and org.razorpay_subscription_id.startswith('cf_sub_mock_'):
                return Response({'url': 'https://developer.cashfree.com/docs/', 'is_mock': True})
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CreateRefundView(APIView):
    """
    POST /api/v1/billing/refund/
    Initiates a refund for a specific payment.
    Admin-only access.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or user.role != CustomUser.Role.ADMIN:
             return Response({"detail": "Admin access required."}, status=403)

        payment_id = request.data.get('payment_id')
        amount = request.data.get('amount') # in major units (e.g. 500.00)
        reason = request.data.get('reason', 'Customer requested refund')

        if not payment_id or not amount:
            return Response({"detail": "payment_id and amount are required."}, status=400)

        org = user.organization
        if not org:
            return Response({"detail": "No organization."}, status=403)

        # Mock logic
        if not cashfree_client.is_configured() or getattr(settings, 'CASHFREE_SECRET', '').endswith('placeholder'):
            refund = Refund.objects.create(
                organization=org,
                payment_id=payment_id,
                refund_id=f"cf_rfnd_mock_{uuid.uuid4().hex[:12]}",
                amount=amount,
                status=Refund.StatusTypes.PENDING,
                reason=reason
            )
            return Response({
                "status": "Refund initiated (Mock)",
                "refund_id": refund.refund_id
            })

        try:
            # Convert amount to paise
            amount_paise = int(float(amount) * 100)
            cf_refund = cashfree_client.refund_payment(payment_id=payment_id, amount_paise=amount_paise, reason=reason)

            refund = Refund.objects.create(
                organization=org,
                payment_id=payment_id,
                refund_id=cf_refund['id'],
                amount=amount,
                status=Refund.StatusTypes.PENDING,
                reason=reason
            )

            # Log Transaction
            BillingTransaction.objects.create(
                organization=org,
                transaction_id=cf_refund['id'],
                event_type="refund.initiated",
                amount=-float(amount),
                payload=cf_refund
            )

            return Response({
                "status": "processed",
                "refund_id": cf_refund['id']
            })

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class MockBillingActionView(APIView):
    """
    POST /api/v1/billing/mock-success/
    Simulates a Razorpay Webhook for development environments.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or not user.organization:
            return Response({"detail": "No organization."}, status=403)

        subscription_id = request.data.get('subscription_id')
        order_id = request.data.get('order_id')
        action = request.data.get('action', 'success') # success, failure, cancel
        org = user.organization

        if subscription_id:
            if action == 'success':
                org.razorpay_subscription_id = subscription_id
                org.is_active = True
                org.current_period_end = timezone.now() + timezone.timedelta(days=30)
                org.save()
                reset_organization_usage(org)
                
                # Elevate to Admin if solo
                if 'business' in subscription_id.lower() or 'enterprise' in subscription_id.lower():
                    if user.role != CustomUser.Role.ADMIN:
                        user.role = CustomUser.Role.ADMIN
                        user.save(update_fields=['role'])
                
                # Send Mock Email
                send_billing_email(user, 'payment_success', {
                    'plan_name': 'Premium (Mock)',
                    'org_name': org.name,
                    'cycle_end': org.current_period_end.strftime('%B %d, %Y')
                })

                # Create Mock Invoice
                mock_inv_id = f"inv_mock_{uuid.uuid4().hex[:8]}"
                Invoice.objects.create(
                    organization=org,
                    razorpay_invoice_id=mock_inv_id,
                    amount=500.00,
                    status=Invoice.Status.PAID,
                    invoice_pdf_url=f"https://razorpay.com/mock-invoice/{mock_inv_id}",
                    paid_at=timezone.now()
                )
                    
                return Response({"status": "Subscription activated (Mock)"})
            
            elif action == 'failure':
                send_billing_email(user, 'payment_failure', {
                    'org_name': org.name
                })
                print(f"[BILLING MOCK] Simulating payment failure for {subscription_id}")
                return Response({"status": "Payment failure simulated (Mock)"})
            
            elif action == 'cancel':
                org.is_active = False
                org.save(update_fields=['is_active'])
                
                send_billing_email(user, 'subscription_cancelled', {
                    'org_name': org.name
                })
                
                print(f"[BILLING MOCK] Simulating subscription cancellation for {subscription_id}")
                return Response({"status": "Subscription cancelled (Mock)"})

            elif action == 'refund':
                send_billing_email(user, 'refund_processed', {
                    'amount': '500.00',
                    'currency': 'INR'
                })
                print(f"[BILLING MOCK] Simulating refund for {subscription_id}")
                return Response({"status": "Refund processed (Mock)"})

            elif action == 'update':
                org.max_seats += 5
                org.save(update_fields=['max_seats'])
                
                send_billing_email(user, 'plan_updated', {
                    'org_name': org.name,
                    'plan_details': 'Enterprise (Mock)',
                    'max_seats': org.max_seats
                })
                print(f"[BILLING MOCK] Simulating plan update for {subscription_id}")
                return Response({"status": "Plan update simulated (Mock)"})

        if order_id:
            if action == 'success':
                # Find the gift
                gift = GiftedSubscription.objects.filter(razorpay_order_id=order_id).first()
                if gift:
                    gift.status = GiftedSubscription.StatusTypes.ACCEPTED
                    gift.save()
                    return Response({"status": "Gift activated (Mock)"})
            else:
                print(f"[BILLING MOCK] Simulating gift failure/cancel for {order_id}")
                return Response({"status": "Gift action simulated (Mock)"})

        return Response({"detail": "Nothing to do."}, status=400)


@method_decorator(csrf_exempt, name='dispatch')
class RazorpayWebhookView(APIView):
    """
    POST /api/v1/billing/webhook/
    Receives server-to-server events from Razorpay.
    Validates the cryptographic signature.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body.decode('utf-8')
        signature = request.META.get('HTTP_X_RAZORPAY_SIGNATURE')
        secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')

        if not signature or not secret:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            # Webhook HMAC does not use API key/secret; Utility works without a Client.
            razorpay.Utility().verify_webhook_signature(payload, signature, secret)
        except razorpay.errors.SignatureVerificationError as e:
            send_system_alert(
                "Webhook Signature Verification Failed",
                f"Signature: {signature}\nError: {str(e)}",
                severity="HIGH"
            )
            return Response({"error": "Invalid signature"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            send_system_alert(
                "Webhook Verification Unexpected Error",
                f"Error: {str(e)}",
                severity="CRITICAL"
            )
            return Response({"error": "Verification error"}, status=status.HTTP_400_BAD_REQUEST)

        import json
        event = json.loads(payload)
        event_id = event.get('id')
        
        if not event_id:
             return Response(status=status.HTTP_400_BAD_REQUEST)

        # Idempotency Check
        if ProcessedWebhookEvent.objects.filter(event_id=event_id).exists():
            print(f"[BILLING] Duplicate webhook detected: {event_id}. Skipping.")
            return Response({"status": "already_processed"}, status=status.HTTP_200_OK)

        # Mark as processed immediately to prevent race conditions (simple approach)
        ProcessedWebhookEvent.objects.create(event_id=event_id)

        event_type = event.get('event')

        # Parse Entities
        if event_type == 'subscription.authenticated' or event_type == 'subscription.activated':
            sub = event['payload']['subscription']['entity']
            notes = sub.get('notes', {})
            org_id = notes.get('organization_id')
            subscription_id = sub.get('id')

            if org_id and subscription_id:
                try:
                    org = Organization.objects.get(id=org_id)
                    org.razorpay_subscription_id = subscription_id
                    org.is_active = True
                    
                    # Sync billing period
                    current_end = sub.get('current_end')
                    if current_end:
                        org.current_period_end = timezone.datetime.fromtimestamp(current_end, tz=timezone.utc)
                    
                    org.save(update_fields=['razorpay_subscription_id', 'is_active', 'current_period_end'])
                    
                    # Log Transaction
                    BillingTransaction.objects.create(
                        organization=org,
                        transaction_id=subscription_id,
                        event_type=event_type,
                        payload=event
                    )
                    
                    # Reset usage for the new billing cycle
                    reset_organization_usage(org)
                    
                    # Send Email (to the first admin or the creating user)
                    admin_user = org.users.filter(role=CustomUser.Role.ADMIN).first() or org.users.first()
                    if admin_user:
                        send_billing_email(admin_user, 'payment_success', {
                            'plan_name': sub.get('plan_id', 'Premium'),
                            'org_name': org.name,
                            'cycle_end': org.current_period_end.strftime('%B %d, %Y')
                        })
                except Organization.DoesNotExist:
                    pass

        elif event_type in ['subscription.cancelled', 'subscription.completed']:
            sub = event['payload']['subscription']['entity']
            subscription_id = sub.get('id')
            try:
                org = Organization.objects.get(razorpay_subscription_id=subscription_id)
                org.is_active = False
                org.save(update_fields=['is_active'])
                
                # Log Transaction
                BillingTransaction.objects.create(
                    organization=org,
                    transaction_id=subscription_id,
                    event_type=event_type,
                    payload=event
                )
                
                # Send Email
                admin_user = org.users.filter(role=CustomUser.Role.ADMIN).first() or org.users.first()
                if admin_user:
                    send_billing_email(admin_user, 'subscription_cancelled', {
                        'org_name': org.name
                    })
                
                print(f"[BILLING] Subscription {subscription_id} cancelled/completed. Org {org.id} deactivated.")
            except Organization.DoesNotExist:
                pass

        elif event_type in ['subscription.pending', 'subscription.halted']:
            sub = event['payload']['subscription']['entity']
            subscription_id = sub.get('id')
            try:
                org = Organization.objects.get(razorpay_subscription_id=subscription_id)
                org.is_active = False
                org.save(update_fields=['is_active'])
                
                # Log Transaction
                BillingTransaction.objects.create(
                    organization=org,
                    transaction_id=subscription_id,
                    event_type=event_type,
                    payload=event
                )
                
                # Send Email (failure alert)
                admin_user = org.users.filter(role=CustomUser.Role.ADMIN).first() or org.users.first()
                if admin_user:
                    send_billing_email(admin_user, 'payment_failure', {
                        'org_name': org.name
                    })
                
                print(f"[BILLING] Subscription {subscription_id} entered status: {event_type}. Org {org.id} deactivated.")
            except Organization.DoesNotExist:
                pass

        elif event_type == 'subscription.updated':
            sub = event['payload']['subscription']['entity']
            subscription_id = sub.get('id')
            try:
                org = Organization.objects.get(razorpay_subscription_id=subscription_id)
                notes = sub.get('notes', {})

                quantity = sub.get('quantity')
                if quantity is not None:
                    try:
                        org.max_seats = int(quantity)
                    except (ValueError, TypeError):
                        pass
                else:
                    new_seats = notes.get('total_seats') or notes.get('max_seats')
                    if new_seats is not None:
                        try:
                            org.max_seats = int(new_seats)
                        except (ValueError, TypeError):
                            pass

                status_val = sub.get('status')
                org.is_active = status_val in ['active', 'authenticated']

                new_end_ts = sub.get('current_end')
                if new_end_ts:
                    new_end = timezone.datetime.fromtimestamp(new_end_ts, tz=timezone.utc)
                    if org.current_period_end and (new_end - org.current_period_end).days > 1:
                        reset_organization_usage(org)
                    org.current_period_end = new_end

                org.save(update_fields=['is_active', 'max_seats', 'current_period_end'])

                BillingTransaction.objects.create(
                    organization=org,
                    transaction_id=subscription_id,
                    event_type=event_type,
                    payload=event
                )

                admin_user = org.users.filter(role=CustomUser.Role.ADMIN).first() or org.users.first()
                if admin_user:
                    send_billing_email(admin_user, 'plan_updated', {
                        'org_name': org.name,
                        'plan_details': sub.get('plan_id', 'Updated Plan'),
                        'max_seats': org.max_seats
                    })

                print(f"[BILLING] Subscription {subscription_id} updated. Org {org.id} synced.")
            except Organization.DoesNotExist:
                pass

        elif event_type == 'subscription.charged':
            # Recurring payment successful
            sub = event['payload']['subscription']['entity']
            subscription_id = sub.get('id')
            try:
                org = Organization.objects.get(razorpay_subscription_id=subscription_id)
                org.is_active = True
                
                # Sync billing period
                current_end = sub.get('current_end')
                if current_end:
                    org.current_period_end = timezone.datetime.fromtimestamp(current_end, tz=timezone.utc)
                
                org.save(update_fields=['is_active', 'max_seats', 'current_period_end'])
                
                # Log Transaction
                BillingTransaction.objects.create(
                    organization=org,
                    transaction_id=subscription_id,
                    event_type=event_type,
                    payload=event
                )
                
                # Send Email
                admin_user = org.users.filter(role=CustomUser.Role.ADMIN).first() or org.users.first()
                if admin_user:
                    send_billing_email(admin_user, 'payment_success', {
                        'plan_name': sub.get('plan_id', 'Premium'),
                        'org_name': org.name,
                        'cycle_end': org.current_period_end.strftime('%B %d, %Y')
                    })
                
                # Reset usage for the new billing cycle
                reset_organization_usage(org)
                print(f"[BILLING] Subscription {subscription_id} charged successfully. Quota reset for Org {org.id}.")
            except Organization.DoesNotExist:
                pass

        elif event_type == 'order.paid':
            order = event['payload']['order']['entity']
            notes = order.get('notes', {})
            
            is_gift = notes.get('is_gift') == 'true'
            if is_gift:
                buyer_id = notes.get('buyer_id')
                recipient_email = notes.get('recipient_email')
                plan_id = notes.get('plan_id')
                # In order.paid, the payment entity is generally also provided inside the payload
                # but we can just use the order ID as the primary tracking key
                payment_id = ""
                if 'payment' in event['payload']:
                    payment_id = event['payload']['payment']['entity'].get('id', '')
                
                if buyer_id and recipient_email:
                    try:
                        buyer = CustomUser.objects.get(id=buyer_id)
                        GiftedSubscription.objects.create(
                            buyer=buyer,
                            recipient_email=recipient_email,
                            razorpay_order_id=order.get('id'),
                            razorpay_payment_id=payment_id,
                            plan_id=plan_id,
                            status=GiftedSubscription.StatusTypes.PENDING # Defaults to pending
                        )
                        
                        # Log Transaction
                        BillingTransaction.objects.create(
                            transaction_id=order.get('id'),
                            event_type=event_type,
                            payload=event
                        )
                    except CustomUser.DoesNotExist:
                        pass

        elif event_type == 'payment.failed':
            payment = event['payload']['payment']['entity']
            payment_id = payment.get('id')
            error_description = payment.get('error_description')
            print(f"[BILLING] Payment failed: {payment_id}. Error: {error_description}")
            
            # Log Transaction
            BillingTransaction.objects.create(
                transaction_id=payment_id,
                event_type=event_type,
                status="failed",
                payload=event
            )
            # In a real app, we would send an email to the user here.

        elif event_type == 'refund.processed':
            refund_entity = event['payload']['refund']['entity']
            refund_id = refund_entity.get('id')
            payment_id = refund_entity.get('payment_id')
            
            try:
                refund = Refund.objects.get(refund_id=refund_id)
                refund.status = Refund.StatusTypes.PROCESSED
                refund.save()
                
                # Log Transaction
                BillingTransaction.objects.create(
                    organization=refund.organization,
                    transaction_id=refund_id,
                    event_type=event_type,
                    amount=-float(refund.amount),
                    payload=event
                )
                print(f"[BILLING] Refund {refund_id} processed successfully.")
                
                # Send Email
                admin_user = refund.organization.users.filter(role=CustomUser.Role.ADMIN).first() or refund.organization.users.first()
                if admin_user:
                    send_billing_email(admin_user, 'refund_processed', {
                        'amount': refund.amount,
                        'currency': 'INR'
                    })
            except Refund.DoesNotExist:
                # If we don't have the record, it might have been initiated from dashboard
                pass

        elif event_type == 'refund.failed':
            refund_entity = event['payload']['refund']['entity']
            refund_id = refund_entity.get('id')
            
            try:
                refund = Refund.objects.get(refund_id=refund_id)
                refund.status = Refund.StatusTypes.FAILED
                refund.save()
                
                # Log Transaction
                BillingTransaction.objects.create(
                    organization=refund.organization,
                    transaction_id=refund_id,
                    event_type=event_type,
                    status="failed",
                    payload=event
                )
                print(f"[BILLING] Refund {refund_id} failed.")
            except Refund.DoesNotExist:
                pass

        elif event_type in ['invoice.paid', 'invoice.issued', 'invoice.failed']:
            invoice_data = event['payload']['invoice']['entity']
            invoice_id = invoice_data.get('id')
            subscription_id = invoice_data.get('subscription_id')

            try:
                if subscription_id:
                    org = Organization.objects.get(razorpay_subscription_id=subscription_id)
                else:
                    notes = invoice_data.get('notes', {})
                    org_id = notes.get('organization_id')
                    if org_id:
                        org = Organization.objects.get(id=org_id)
                    else:
                        raise Organization.DoesNotExist()

                if event_type == 'invoice.paid':
                    org.is_active = True
                    org.save(update_fields=['is_active'])
                    BillingTransaction.objects.create(
                        organization=org,
                        transaction_id=subscription_id or invoice_id,
                        event_type=event_type,
                        payload=event
                    )
                    print(
                        f"[BILLING] Invoice paid (invoice {invoice_id}). "
                        f"Subscription {subscription_id or 'N/A'}. Org {org.id} active."
                    )

                invoice_status = (
                    'paid' if event_type == 'invoice.paid' else
                    'issued' if event_type == 'invoice.issued' else 'failed'
                )

                Invoice.objects.update_or_create(
                    razorpay_invoice_id=invoice_id,
                    defaults={
                        'organization': org,
                        'razorpay_payment_id': invoice_data.get('payment_id'),
                        'amount': invoice_data.get('amount') / 100 if invoice_data.get('amount') else 0,
                        'currency': invoice_data.get('currency', 'INR'),
                        'status': invoice_status,
                        'invoice_pdf_url': invoice_data.get('short_url'),
                        'issued_at': timezone.datetime.fromtimestamp(
                            invoice_data.get('issued_at'), tz=timezone.utc
                        ) if invoice_data.get('issued_at') else timezone.now(),
                        'paid_at': timezone.now() if event_type == 'invoice.paid' else None
                    }
                )
                print(f"[BILLING] Invoice {invoice_id} synced for Org {org.id}. Status: {invoice_status}")
            except Organization.DoesNotExist:
                print(f"[BILLING WARNING] Received invoice {invoice_id} for unknown organization.")
                pass

        return Response(status=status.HTTP_200_OK)


class InvoiceListView(APIView):
    """
    GET /api/v1/billing/invoices/
    Returns the billing history (list of invoices) for the authenticated user's organization.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.organization:
            return Response([])

        invoices = Invoice.objects.filter(organization=user.organization)
        data = []
        for inv in invoices:
            data.append({
                "id": str(inv.id),
                "invoice_id": inv.razorpay_invoice_id,
                "amount": float(inv.amount),
                "currency": inv.currency,
                "status": inv.status,
                "pdf_url": inv.invoice_pdf_url,
                "issued_at": inv.issued_at,
                "paid_at": inv.paid_at
            })
        return Response(data)
