# utils.py
import base64
import os
import logging
import re  # Add this import
from openai import OpenAI, OpenAIError
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

Provide your analysis in this exact structure:

# Overview
Provide a clear 2-3 sentence summary that covers:
- Design's main purpose and target users
- Key interface elements and functionality
- Initial impression and visual style

# Strengths
Analyze 3-4 specific strengths:

- Visual Design Elements
  - Layout effectiveness and organization
  - Color scheme and its purpose
  - Typography choices and readability

- User Interface Components
  - Element organization and hierarchy
  - Button and control placement
  - Interactive element clarity

- Navigation and User Flow
  - Menu structure and organization
  - Page transitions and feedback
  - User path clarity

- Content Presentation
  - Information hierarchy
  - Content readability
  - Visual balance

For each strength, explain WHY it works well, not just WHAT works.

# Areas for Improvement
Identify 3-4 specific areas needing attention:

- Usability Considerations
  - Interaction pain points
  - User feedback elements
  - Accessibility concerns

- Visual Hierarchy
  - Element prominence
  - Content organization
  - Layout structure

- User Interaction
  - Control responsiveness
  - Action feedback
  - Error handling

- Information Structure
  - Content flow
  - Data presentation
  - Navigation clarity

For each point, explain both the issue AND its impact on users.

# Suggestions
Provide 3-4 actionable improvements that would enhance:

- User Experience
  - Specific interface changes
  - Interaction improvements
  - Navigation enhancements

- Visual Design
  - Layout refinements
  - Color and typography adjustments
  - Spacing improvements

- Functionality
  - Feature enhancements
  - Process streamlining
  - Error prevention

Make each suggestion specific and implementable.

Context: {context}

Keep feedback constructive and focused on practical improvements that will make a real difference to users.
""",

    'supporter': """
You are a senior UX/UI expert conducting a comprehensive design analysis. Provide detailed, strategic insights.

Deliver your analysis in this exact structure:

# Overview
Provide a thorough analysis covering:

- Design Purpose and Objectives
  - Primary user goals
  - Business objectives
  - Key success metrics
  - Target audience definition

- Core Design Patterns
  - Interface architecture
  - Navigation systems
  - Interaction models
  - Content structure

- Technical Implementation
  - Component hierarchy
  - Responsive considerations
  - Performance factors
  - System scalability

Include specific examples and rationale for each point.

# Strengths
Analyze 5-6 key strengths in detail:

- Visual Design Implementation
  - Color theory application
  - Typography system
  - Spacing principles
  - Visual rhythm
  - Brand alignment
  - Design consistency

- UX/UI Pattern Effectiveness
  - Navigation structure
  - User flow logic
  - Interaction patterns
  - State management
  - Error handling
  - System feedback

- Information Architecture
  - Content organization
  - Data hierarchy
  - Wayfinding elements
  - Search/filter systems
  - Category structure
  - Metadata usage

- Interaction Design
  - Input methods
  - Gesture support
  - Transition effects
  - Loading states
  - Progress indication
  - Action confirmation

- Accessibility Features
  - Color contrast
  - Text scaling
  - Keyboard navigation
  - Screen reader support
  - Focus management
  - ARIA implementation

- Technical Excellence
  - Performance optimization
  - Responsive behavior
  - Component structure
  - Code organization
  - Asset management
  - Cache strategy

For each strength, provide:
- Detailed analysis of implementation
- User benefit explanation
- Business value alignment
- Technical considerations

# Areas for Enhancement
Analyze 5-6 areas for improvement:

- UX Flow Optimization
  - User journey gaps
  - Process bottlenecks
  - Navigation issues
  - Content accessibility

- Visual Hierarchy Refinement
  - Element prominence
  - Content organization
  - Layout structure
  - Visual relationships

- Interaction Pattern Improvements
  - User feedback systems
  - Error prevention
  - Help mechanisms
  - Progressive disclosure

- Accessibility Compliance
  - WCAG guidelines
  - Keyboard navigation
  - Screen reader optimization
  - Color contrast issues

- Responsive Design
  - Breakpoint strategy
  - Content adaptation
  - Touch targets
  - Layout flexibility

- Technical Implementation
  - Performance metrics
  - Code efficiency
  - Asset optimization
  - Cache strategy

For each area:
- Detail current implementation
- Explain user impact
- Identify potential risks
- Outline improvement approach

# Strategic Recommendations

Immediate Improvements:
- Quick UX Wins
  - Highest impact changes
  - Low implementation effort
  - Immediate user benefits

- Visual Refinements
  - Critical UI updates
  - Brand alignment fixes
  - Consistency improvements

- Interaction Enhancements
  - Feedback mechanisms
  - Error prevention
  - User guidance

Long-term Optimizations:
- System Architecture
  - Component structure
  - Code organization
  - Performance optimization

- Design System Evolution
  - Pattern library
  - Style guide
  - Component documentation

- Scalability Planning
  - Future feature support
  - Technical debt reduction
  - Maintenance strategy

Technical Guidelines:
- Implementation Standards
  - Coding practices
  - Performance targets
  - Quality metrics

- Accessibility Requirements
  - WCAG compliance
  - Assistive technology
  - Testing protocols

- Performance Optimization
  - Loading strategies
  - Asset management
  - Caching policies

Context: {context}

Provide specific, actionable insights backed by UX principles and industry standards. Focus on strategic improvements that enhance both user experience and business value. Include technical considerations and implementation guidelines where relevant.
"""
}

def clean_review_content(content):
    """Clean up any markdown or unwanted formatting in the review content"""
    try:
        # Convert dashes to bullet points if they're being used as list items
        cleaned = re.sub(r'^\s*-\s+', '• ', content, flags=re.MULTILINE)
        
        # Remove any markdown formatting
        cleaned = cleaned.replace('**', '')
        cleaned = cleaned.replace('__', '')
        cleaned = cleaned.replace('*', '• ')
        
        # Fix section headers
        cleaned = re.sub(r'^[-\s]*#\s*', '# ', cleaned, flags=re.MULTILINE)
        
        # Remove any other potential markdown elements
        cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', cleaned)
        cleaned = cleaned.replace('`', '')
        
        # Fix multiple consecutive newlines
        cleaned = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned)
        
        # Ensure consistent bullet point style
        cleaned = cleaned.replace('- ', '• ')
        
        # Fix spacing around bullet points
        cleaned = re.sub(r'•\s+', '• ', cleaned)
        
        return cleaned.strip()
    except Exception as e:
        logger.error(f"Error cleaning content: {e}")
        return content  # Return original content if cleaning fails

def generate_design_review(base64_image, context, is_supporter=False):
    """Generate a design review based on user tier"""
    try:
        logger.debug(f"Generating {'premium' if is_supporter else 'free'} review")
        
        system_prompt = """
You are a professional design expert providing detailed, constructive feedback.

Important formatting rules:
1. Use ONLY plain text - no markdown or special formatting
2. Format sections with '# ' prefix (Example: '# Overview')
3. Use bullet points with '• ' prefix (NOT with '-' or '*')
4. Use indentation with spaces for sub-points
5. Keep paragraphs well-spaced with single blank lines
6. Do not use any styling characters (*, **, _, __, etc.)
7. Keep section headers clean without any additional formatting

Your review should be thorough and valuable while maintaining clean, consistent formatting.
Structure your response exactly according to the sections in the prompt.
"""
        
        prompt = PROMPTS['supporter' if is_supporter else 'free'].format(
            context=context
        )
        
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
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
        
        # Clean up the content
        cleaned_content = clean_review_content(review_content)
        
        # Ensure there's an overview section
        if not cleaned_content.startswith('# '):
            cleaned_content = '# Overview\n' + cleaned_content
            
        return {
            'review_content': cleaned_content,
            'is_premium': is_supporter,
            'status': 'success'
        }
        
    except Exception as e:
        logger.error(f"Error generating review: {e}")
        return {
            'error': 'Failed to generate review',
            'message': str(e),
            'is_premium': is_supporter,
            'status': 'error'
        }