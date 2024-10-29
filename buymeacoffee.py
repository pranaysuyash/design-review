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

    def get_supporter_status(self, email):
        """Check if an email belongs to a supporter"""
        try:
            if not email:
                return {'is_supporter': False, 'tier': 'free'}

            # Check for test emails
            test_tier = self.is_test_email(email)
            if test_tier:
                logger.debug(f"Test email detected: {email} (Tier: {test_tier})")
                if test_tier == 'premium':
                    return {
                        'is_supporter': True,
                        'tier': 'premium',
                        'last_support_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'total_support': 20.00
                    }
                return {'is_supporter': False, 'tier': 'free'}

            # Real API call for non-test emails
            try:
                logger.debug(f"Checking supporter status for: {email}")
                response = requests.get(
                    f'{self.base_url}/supporters',
                    headers=self.headers
                )
                response.raise_for_status()
                supporters = response.json().get('data', [])

                # Find the supporter by email
                supporter = next(
                    (s for s in supporters if s.get('email', '').lower() == email.lower()),
                    None
                )

                if not supporter:
                    logger.debug(f"No supporter found for email: {email}")
                    return {'is_supporter': False, 'tier': 'free'}

                # Check if support was within last 30 days
                last_support_str = supporter.get('support_created_on')
                if not last_support_str:
                    return {'is_supporter': False, 'tier': 'free'}

                last_support = datetime.strptime(
                    last_support_str,
                    '%Y-%m-%d %H:%M:%S'
                ).replace(tzinfo=timezone.utc)
                
                now = datetime.now(timezone.utc)
                days_since_support = (now - last_support).days

                if days_since_support > 30:
                    logger.debug(f"Support expired for email: {email}")
                    return {'is_supporter': False, 'tier': 'free'}

                total_support = float(supporter.get('support_coffee_price', 0))
                return {
                    'is_supporter': True,
                    'tier': 'premium',
                    'last_support_date': last_support_str,
                    'total_support': total_support
                }

            except requests.RequestException as e:
                logger.error(f"API request failed: {str(e)}")
                return {'is_supporter': False, 'tier': 'free'}

        except Exception as e:
            logger.error(f"Error checking supporter status: {str(e)}")
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