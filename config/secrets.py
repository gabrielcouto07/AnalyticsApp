"""Configuration for sensitive API keys and secrets."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def get_openai_config():
    """Returns OpenAI configuration dictionary."""
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found in .env file!")
    return {
        "api_key": OPENAI_API_KEY,
    }
