import stripe
from django.conf import settings
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser, Organization, GiftedSubscription

stripe.api_key = settings.STRIPE_SECRET_KEY


class CreateCheckoutSessionView(APIView):
    """
    POST /api/v1/billing/checkout/
    Generates a Stripe Checkout Session URL for the authenticated user's organization.
    Expects a `price_id` in the request body.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or not user.organization:
            return Response(
                {"detail": "Only human users with an organization can subscribe."},
                status=status.HTTP_403_FORBIDDEN
            )

        price_id = request.data.get('price_id')
        if not price_id:
            return Response({"detail": "price_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # FRONTEND_URL ideally comes from settings (.env), hardcoded for scaffold purposes
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        # Scaffold/Development Fallback bypasses Stripe if using placeholder keys
        if getattr(settings, 'STRIPE_SECRET_KEY', '').endswith('placeholder'):
            user.organization.stripe_subscription_id = f"sub_mock_{price_id}"
            user.organization.save()
            # Upgrade the user to ADMIN so they can access the enterprise dashboard
            if user.role != CustomUser.Role.ADMIN:
                user.role = CustomUser.Role.ADMIN
                user.save(update_fields=['role'])
            return Response({'url': f'{frontend_url}/dashboard?session_id=mock_session_123'})

        try:
            # Add 7-day free trial for SOLO users on their first subscription
            subscription_data = {}
            if user.role == CustomUser.Role.SOLO:
                subscription_data['trial_period_days'] = 7

            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[
                    {
                        'price': price_id,
                        'quantity': 1,
                    },
                ],
                mode='subscription',
                subscription_data=subscription_data,
                success_url=f'{frontend_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}',
                cancel_url=f'{frontend_url}/pricing',
                # Store the organization ID in metadata so the webhook knows who paid
                client_reference_id=str(user.organization.id),
                metadata={
                    "organization_id": str(user.organization.id)
                }
            )
            return Response({'url': checkout_session.url})
        except stripe.error.StripeError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GiftCheckoutSessionView(APIView):
    """
    POST /api/v1/billing/gift/checkout/
    Generates a Stripe Checkout Session URL for gifting a subscription.
    Expects `price_id` and `recipient_email` in the request body.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response(
                {"detail": "Only human users can gift a subscription."},
                status=status.HTTP_403_FORBIDDEN
            )

        price_id = request.data.get('price_id')
        recipient_email = request.data.get('recipient_email')
        
        if not price_id or not recipient_email:
            return Response({"detail": "price_id and recipient_email are required."}, status=status.HTTP_400_BAD_REQUEST)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        # Scaffold/Development Fallback bypasses Stripe if using placeholder keys
        if getattr(settings, 'STRIPE_SECRET_KEY', '').endswith('placeholder'):
            from .models import GiftedSubscription
            import uuid
            GiftedSubscription.objects.create(
                buyer=user,
                recipient_email=recipient_email,
                stripe_checkout_session_id=f"cs_test_{uuid.uuid4().hex[:16]}",
                stripe_price_id=price_id,
            )
            return Response({'url': f'{frontend_url}/pricing?gift_success=true'})

        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[
                    {
                        'price': price_id,
                        'quantity': 1,
                    },
                ],
                mode='subscription',
                success_url=f'{frontend_url}/pricing?gift_success=true',
                cancel_url=f'{frontend_url}/pricing',
                metadata={
                    "is_gift": "true",
                    "buyer_id": str(user.id),
                    "recipient_email": recipient_email,
                    "plan_id": price_id
                }
            )
            return Response({'url': checkout_session.url})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomerPortalView(APIView):
    """
    POST /api/v1/billing/portal/
    Generates a Stripe Customer Portal URL for an authorized user to manage their subscription.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or not user.organization:
            return Response({"detail": "No organization associated."}, status=status.HTTP_403_FORBIDDEN)

        org = user.organization
        # We need the Stripe Customer ID. In a full implementation, you'd save stripe_customer_id
        # on the Organization model when the checkout completes. For now, we simulate this.
        # But wait, we can retrieve the subscription to find the customer ID.
        if not org.stripe_subscription_id:
            return Response(
                {"detail": "Organization does not have an active subscription."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            subscription = stripe.Subscription.retrieve(org.stripe_subscription_id)
            customer_id = subscription.customer

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            portal_session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f'{frontend_url}/settings',
            )
            return Response({'url': portal_session.url})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    """
    POST /api/v1/billing/webhook/
    Receives server-to-server events from Stripe. Bypasses authentication (AllowAny)
    and validates the Stripe cryptographical signature instead.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        except ValueError as e:
            # Invalid payload
            return Response(status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            
            is_gift = session.get('metadata', {}).get('is_gift') == 'true'
            
            if is_gift:
                buyer_id = session.get('metadata', {}).get('buyer_id')
                recipient_email = session.get('metadata', {}).get('recipient_email')
                plan_id = session.get('metadata', {}).get('plan_id')
                
                payment_intent_id = session.get('payment_intent')
                # For subscriptions, the first payment is usually on the invoice, but we can store the session
                
                if buyer_id and recipient_email:
                    try:
                        buyer = CustomUser.objects.get(id=buyer_id)
                        GiftedSubscription.objects.create(
                            buyer=buyer,
                            recipient_email=recipient_email,
                            stripe_checkout_session_id=session.get('id'),
                            stripe_payment_intent_id=payment_intent_id,
                            plan_id=plan_id
                        )
                        # We would also trigger an email here in a real production system
                    except CustomUser.DoesNotExist:
                        pass
            else:
                org_id = session.get('client_reference_id')
                subscription_id = session.get('subscription')

                if org_id and subscription_id:
                    try:
                        org = Organization.objects.get(id=org_id)
                        org.stripe_subscription_id = subscription_id
                        org.is_active = True
                        org.save(update_fields=['stripe_subscription_id', 'is_active'])
                    except Organization.DoesNotExist:
                        pass

        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            subscription_id = subscription.get('id')
            try:
                # Find the org with this subscription and disable it
                org = Organization.objects.get(stripe_subscription_id=subscription_id)
                org.is_active = False
                org.save(update_fields=['is_active'])
            except Organization.DoesNotExist:
                pass
        
        # Other events can be handled here (e.g. invoice.payment_failed)

        return Response(status=status.HTTP_200_OK)
