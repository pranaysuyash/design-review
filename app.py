# app.py
import os
import logging
from flask import Flask, render_template, request, jsonify, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from utils import encode_image, generate_design_review
from buymeacoffee import BuyMeACoffeeAPI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY')

# Secure session cookies
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax'
)

# Initialize Buy Me a Coffee API
bmac_api = BuyMeACoffeeAPI()

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"]
    }
})

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize Limiter with no default limits
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[]
)

def is_supporter():
    """Helper function to determine if current session user is a supporter"""
    email = session.get('email', '')
    supporter_status = bmac_api.get_supporter_status(email)
    return supporter_status.get('is_supporter', False)

def get_rate_limit():
    """Determine rate limit based on supporter status"""
    return "15 per day" if is_supporter() else "5 per day"

@app.route('/')
def index():
    email = session.get('email', '')
    is_supporter_flag = False
    rate_info = {
        'requests_used': 0,
        'requests_limit': 5
    }

    buymeacoffee_url = bmac_api.get_support_url()

    if email:
        supporter_status = bmac_api.get_supporter_status(email)
        is_supporter_flag = supporter_status.get('is_supporter', False)
        rate_info['requests_limit'] = 15 if is_supporter_flag else 5
    else:
        supporter_status = None

    return render_template(
        'index.html',
        rate_info=rate_info,
        supporter_status=supporter_status,
        buymeacoffee_url=buymeacoffee_url  # Added this line
    )

@app.route('/set-email', methods=['POST'])
def set_email():
    try:
        email = request.form.get('email', '').strip()
        if not email:
            return jsonify({'error': 'Email address is required'}), 400

        # Validate email format
        import re
        email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        if not re.match(email_regex, email):
            return jsonify({'error': 'Invalid email address'}), 400

        # Store email in session
        session['email'] = email

        # Check supporter status
        supporter_status = bmac_api.get_supporter_status(email)
        is_supporter_flag = supporter_status.get('is_supporter', False)

        rate_info = {
            'requests_used': 0,  # Implement actual tracking if needed
            'requests_limit': 15 if is_supporter_flag else 5
        }

        return jsonify({
            'message': 'Email set successfully',
            'supporter_status': supporter_status,
            'rate_info': rate_info
        }), 200

    except Exception as e:
        logger.error(f"Error in set_email: {str(e)}")
        return jsonify({'error': 'An error occurred', 'message': str(e)}), 500

@app.route('/analyze', methods=['POST'])
@limiter.limit(get_rate_limit)
def analyze_design():
    try:
        logger.debug("Starting design analysis")

        if 'image' not in request.files:
            logger.error("No file part in request")
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['image']
        if file.filename == '':
            logger.error("No selected file")
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            logger.error(f"Invalid file type: {file.filename}")
            return jsonify({
                'error': 'Invalid file type. Supported formats: PNG, JPG, JPEG'
            }), 400

        # Read and validate file
        try:
            image_data = file.read()
            logger.debug(f"Successfully read image data, size: {len(image_data)} bytes")
        except Exception as e:
            logger.error(f"Error reading file: {str(e)}")
            return jsonify({'error': 'Error reading uploaded file'}), 400

        if len(image_data) > MAX_FILE_SIZE:
            logger.error(f"File too large: {len(image_data)} bytes")
            return jsonify({'error': 'File size exceeds 5MB limit'}), 400

        context = request.form.get('context', '').strip()
        if len(context) > 500:
            logger.error("Context too long")
            return jsonify({'error': 'Context must be less than 500 characters'}), 400

        logger.debug(f"Processing with context: {context[:100]}...")

        # Get user status and generate review
        email = session.get('email', '')
        is_supporter_flag = False

        if email:
            supporter_status = bmac_api.get_supporter_status(email)
            is_supporter_flag = supporter_status.get('is_supporter', False)
        else:
            supporter_status = None

        try:
            base64_image = encode_image(image_data)
            review_response = generate_design_review(
                base64_image,
                context or 'No context provided',
                is_supporter=is_supporter_flag
            )

            logger.debug("Successfully generated review")

            rate_info = {
                'requests_used': 0,  # Implement actual tracking if needed
                'requests_limit': 15 if is_supporter_flag else 5
            }

            return jsonify({
                'review': review_response,
                'rate_info': rate_info
            }), 200

        except Exception as e:
            logger.error(f"Error generating review: {str(e)}")
            return jsonify({
                'error': 'Failed to generate review',
                'message': str(e)
            }), 500

    except Exception as e:
        logger.error(f"Unexpected error in analyze_design: {str(e)}")
        return jsonify({
            'error': 'An unexpected error occurred',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=False  # Disable debug mode for production
    )
