#!/usr/bin/env python3
"""Update bot.py to use Google Gemini instead of Groq"""

import re

bot_file = "/Users/vipulpawar/projects/pipecat-outbound/bot.py"

with open(bot_file, 'r') as f:
    content = f.read()

# Replace Groq import with Gemini
content = re.sub(
    r'from pipecat\.services\.groq\.llm import GroqLLMService',
    'from pipecat.services.google import GoogleLLMService',
    content
)

# Replace create_llm function
old_create_llm = '''def create_llm(provider: str, model: str) -> GroqLLMService:
    return GroqLLMService(
        api_key=os.getenv("GROQ_API_KEY"),
        model=model if provider == "groq" else "llama-3.3-70b-versatile",
    )'''

new_create_llm = '''def create_llm(provider: str, model: str):
    if provider == "google" or provider == "gemini":
        return GoogleLLMService(
            api_key=os.getenv("GOOGLE_API_KEY"),
            model=model if model else "gemini-2.0-flash-exp",
        )
    # Fallback to Groq if specified
    from pipecat.services.groq.llm import GroqLLMService
    return GroqLLMService(
        api_key=os.getenv("GROQ_API_KEY"),
        model=model if model else "llama-3.3-70b-versatile",
    )'''

content = content.replace(old_create_llm, new_create_llm)

# Update the main() function to use google provider
content = re.sub(
    r'llm_provider\s*=\s*os\.getenv\("AGENT_LLM_PROVIDER",\s*"groq"\)',
    'llm_provider     = os.getenv("AGENT_LLM_PROVIDER", "google")',
    content
)

# Update default model
content = re.sub(
    r'llm_model\s*=\s*os\.getenv\("AGENT_LLM_MODEL",\s*"[^"]+"\)',
    'llm_model        = os.getenv("AGENT_LLM_MODEL", "gemini-2.0-flash-exp")',
    content
)

# Update deprecation warning check
content = re.sub(
    r'DeprecationWarning: The `model` parameter is deprecated\.',
    'Note: Using Google Gemini.',
    content
)

with open(bot_file, 'w') as f:
    f.write(content)

print("✅ Updated bot.py to use Google Gemini")
print("   Model: gemini-2.0-flash-exp")
print("   Provider: google")
