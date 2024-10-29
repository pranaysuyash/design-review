# utils.py (with our better prompts)
import base64
import os
import logging
import json
from openai import OpenAI, OpenAIError, BadRequestError, APIError
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def validate_api_key():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is required")
    return api_key

openai_client = OpenAI(api_key=validate_api_key())

def encode_image(image_data):
    return base64.b64encode(image_data).decode('utf-8')

PROMPTS = {
    'free': """
You are a design expert providing valuable feedback. Analyze this design using core UX/UI principles.

Provide your analysis in this structure:
1. Overview:
   - Design's main purpose and target users
   - Key interface elements and functions
   - Initial impression and visual style
   (2-3 informative sentences)

2. Strengths (3-4 specific points):
   • Visual design (layout, color, typography)
   • User interface elements and organization
   • Navigation and user flow
   • Content presentation and clarity

3. Areas for Improvement (3-4 points):
   • Usability considerations
   • Visual hierarchy and consistency
   • User interaction elements
   • Information organization

4. Recommendations:
   3-4 specific, actionable improvements that would enhance:
   - User experience and usability
   - Visual design and consistency
   - Interface functionality
   - Overall effectiveness

Context: {context}

Keep feedback constructive and actionable. Focus on practical improvements that would make a real difference to users.
""",
    
    'supporter': """
You are a senior UX/UI expert conducting a comprehensive design analysis. Provide detailed, professional insights.

Perform an expert analysis considering:
1. UX/UI Best Practices
2. Information Architecture
3. Visual Design Systems
4. Interaction Patterns
5. Accessibility Standards
6. Responsive Design
7. Industry Standards

Structure your analysis as follows:

1. Overview:
   - Design purpose and objectives
   - Target audience and user needs
   - Key design patterns and systems
   - Technical implementation considerations
   (Provide thorough, insight-rich analysis)

2. Strengths (5-6 detailed points):
   • Visual Design (color theory, typography, spacing)
   • UX/UI Pattern Implementation
   • Information Architecture
   • Interaction Design
   • Accessibility Considerations
   • Technical Implementation
   (For each point, explain both the WHAT and the WHY)

3. Areas for Enhancement (5-6 points):
   • UX Flow Optimizations
   • Visual Hierarchy
   • Interaction Patterns
   • Accessibility Compliance
   • Responsive Design
   • Technical Implementation
   (For each point, explain the issue AND its user impact)

4. Strategic Recommendations:
   A. Immediate Improvements:
      - Quick UX wins
      - Visual refinements
      - Interaction enhancements
      
   B. Long-term Optimizations:
      - UX/UI system improvements
      - Component structure
      - Design system recommendations
      
   C. Technical Guidelines:
      - Implementation best practices
      - Accessibility requirements
      - Performance considerations

Context: {context}

Provide specific, actionable insights supported by design principles and industry standards.
Focus on strategic improvements that enhance both user experience and business value.
Include technical considerations and implementation guidelines where relevant.
"""}

def generate_design_review(base64_image, context, is_supporter=False):
    """Generate a design review based on user tier"""
    try:
        logger.debug(f"Generating {'premium' if is_supporter else 'free'} review")
        
        prompt = PROMPTS['supporter' if is_supporter else 'free'].format(
            context=context
        )
        
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional design expert providing detailed, constructive feedback."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=4000,
            temperature=0.7
        )
        
        review_content = response.choices[0].message.content
        logger.debug("Received review content")
        
        # Parse the review content
        sections = {
            'overview': '',
            'strengths': [],
            'improvements': [],
            'recommendations': []
        }
        
        current_section = None
        current_list = []
        
        for line in review_content.split('\n'):
            line = line.strip()
            if not line:
                continue
                
            # Detect sections
            lower_line = line.lower()
            if 'overview' in lower_line and ':' in line:
                current_section = 'overview'
                continue
            elif any(x in lower_line for x in ['strength', 'pros']):
                current_section = 'strengths'
                current_list = []
                continue
            elif any(x in lower_line for x in ['areas', 'improvement', 'cons']):
                current_section = 'improvements'
                current_list = []
                continue
            elif any(x in lower_line for x in ['recommend', 'suggestion']):
                current_section = 'recommendations'
                continue
            
            # Process content based on section
            if current_section == 'overview':
                sections['overview'] += ' ' + line
            elif current_section in ['strengths', 'improvements']:
                if line.startswith(('•', '-', '*', '1.', '2.', '3.', 'A.', 'B.', 'C.')):
                    line = line.lstrip('•-*123ABC. ')
                    if line:
                        current_list.append(line)
                        sections[current_section] = current_list
            elif current_section == 'recommendations':
                sections['recommendations'] += ' ' + line
        
        # Clean up the sections
        sections['overview'] = sections['overview'].strip()
        sections['recommendations'] = sections['recommendations'].strip()
        
        # Add premium status
        sections['is_premium'] = is_supporter
        
        return sections
        
    except Exception as e:
        logger.error(f"Error generating review: {e}")
        return {
            'overview': 'Failed to generate review',
            'strengths': ['Error generating review'],
            'improvements': ['Please try again'],
            'recommendations': 'Service temporarily unavailable',
            'is_premium': is_supporter
        }