import os
from langchain_core.language_models.chat_models import BaseChatModel

def get_llm() -> BaseChatModel:
    """
    Returns the appropriate ChatModel based on the LLM_PROVIDER environment variable.
    Defaults to OpenAI if none is specified, or uses whatever key is available.
    """
    provider = os.getenv("LLM_PROVIDER", "").lower()

    if provider == "openrouter" or (not provider and os.getenv("OPENROUTER_API_KEY")):
        from langchain_openai import ChatOpenAI
        # OpenRouter uses the OpenAI API format
        return ChatOpenAI(
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            model=os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-opus"), # Default to a strong model
            temperature=0.2,
            max_tokens=2000
        )
        
    elif provider == "anthropic" or (not provider and os.getenv("ANTHROPIC_API_KEY")):
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model_name="claude-3-opus-20240229", temperature=0.2)
        
    elif provider in ["gemini", "google"] or (not provider and os.getenv("GOOGLE_API_KEY")):
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", 
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.2, 
            max_retries=5
        )
        
    else:
        # Default to OpenAI if key exists, otherwise fallback to Gemini if key exists
        if os.getenv("GOOGLE_API_KEY"):
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model="gemini-2.5-flash", 
                google_api_key=os.getenv("GOOGLE_API_KEY"),
                temperature=0.2, 
                max_retries=5
            )
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model="gpt-4o", temperature=0.2)
