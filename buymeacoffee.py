# buymeacoffee.py
import os
import requests
from datetime import datetime, timezone
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class BuyMeACoffeeAPI:
    def __init__(self):
        self.token = os.environ.get('BUYMEACOFFEE_TOKEN')
        self.base_url = 'https://developers.buymeacoffee.com/api/v1'
        self.headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test emails configuration
        self.test_emails = {
            'premium': [
                'premium@test.com',
                'test.premium@gmail.com',
                'premium.test@gmail.com'
            ],
            'free': [
                'free@test.com',
                'test.free@gmail.com',
                'free.test@gmail.com'
            ]
        }

    def is_test_email(self, email):
        """Check if email is a test email and return its tier"""
        email_lower = email.lower()
        
        if email_lower in self.test_emails['premium']:
            return 'premium'
        if email_lower in self.test_emails['free']:
            return 'free'
        return None

    def get_supporters(self):
        """Fetch all supporters (both subscriptions and one-time supporters)"""
        supporters = []
        try:
            # Fetch recurring supporters (subscriptions)
            subscriptions = self.fetch_supporters('subscriptions', params={'status': 'active'})
            supporters.extend(subscriptions)
            
            # Fetch one-time supporters
            one_time_supporters = self.fetch_supporters('supporters')
            supporters.extend(one_time_supporters)
            
        except Exception as e:
            logger.error(f"Error fetching supporters: {e}")
        
        return supporters

    def fetch_supporters(self, endpoint, params=None):
        """Helper function to fetch supporters data from a given endpoint"""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()
            return data.get('data', [])
        except requests.RequestException as e:
            logger.error(f"API request failed for {endpoint}: {e}")
            return []

    def get_supporter_status(self, email):
        """Check if an email belongs to a supporter"""
        try:
            if not email:
                return {'is_supporter': False, 'tier': 'free'}

            # Check for test emails first
            test_tier = self.is_test_email(email)
            if test_tier:
                logger.debug(f"Test email detected: {email} (Tier: {test_tier})")
                if test_tier == 'premium':
                    return {
                        'is_supporter': True,
                        'tier': 'premium',
                        'last_support_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'total_support': 20.00  # Example value
                    }
                return {'is_supporter': False, 'tier': 'free'}

            # Fetch all supporters
            supporters = self.get_supporters()
            logger.debug(f"Total supporters fetched: {len(supporters)}")
            
            # Search for the supporter by email
            for supporter in supporters:
                supporter_email = supporter.get('payer_email') or supporter.get('support_email') or ''
                if supporter_email.lower() == email.lower():
                    # Determine if subscription is active
                    if 'subscription_current_period_end' in supporter:
                        # Check if the subscription is still active (within 30 days)
                        end_date_str = supporter.get('subscription_current_period_end')
                        if end_date_str:
                            end_date = datetime.strptime(end_date_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                            now = datetime.now(timezone.utc)
                            days_since_end = (now - end_date).days
                            if days_since_end <= 30:
                                total_support = float(supporter.get('subscription_coffee_price', 0)) * supporter.get('subscription_coffee_num', 1)
                                return {
                                    'is_supporter': True,
                                    'tier': 'premium',
                                    'last_support_date': supporter.get('subscription_updated_on'),
                                    'total_support': total_support
                                }
                    else:
                        # One-time supporter
                        total_support = float(supporter.get('support_coffee_price', 0)) * supporter.get('support_coffees', 1)
                        return {
                            'is_supporter': True,
                            'tier': 'premium',
                            'last_support_date': supporter.get('support_updated_on'),
                            'total_support': total_support
                        }
            
            logger.debug(f"No supporter found for email: {email}")
            return {'is_supporter': False, 'tier': 'free'}

        except Exception as e:
            logger.error(f"Error checking supporter status: {e}")
            return {'is_supporter': False, 'tier': 'free'}

    def get_premium_features(self):
        """Get list of premium features"""
        return {
            'premium': {
                'reviews_per_day': 15,
                'features': [
                    'Detailed design analysis',
                    'Implementation recommendations',
                    'Technical considerations',
                    'Export reviews as PDF',
                    'Priority support'
                ]
            },
            'free': {
                'reviews_per_day': 5,
                'features': [
                    'Basic design feedback',
                    'Core UX/UI analysis',
                    'Simple recommendations'
                ]
            }
        }

    def get_support_url(self):
        """Get the support URL"""
        return "https://www.buymeacoffee.com/pranaysuyash"
