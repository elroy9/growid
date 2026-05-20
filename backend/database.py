from supabase import create_client, Client
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    supabase_service_key: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    class Config:
        env_file = ".env"

settings = Settings()
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)